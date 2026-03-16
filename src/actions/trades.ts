"use server";

import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { db } from "~/server/db";

const tradeAssetSchema = z.object({
  type: z.enum(["player", "pick"]),
  teamId: z.number().int().positive(),
  targetTeamId: z.number().int().positive(),
  playerId: z.number().int().positive().optional(),
  draftPickId: z.number().int().positive().optional(),
});

const saveTradeSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500),
  rating: z.number().min(0).max(10),
  salaryValid: z.boolean(),
  assets: z.array(tradeAssetSchema),
});

export type SaveTradeInput = z.infer<typeof saveTradeSchema>;

// Standard include for trade queries
const tradeInclude = {
  tradeTeams: true,
  assets: {
    include: {
      tradeTeam: true,
      targetTradeTeam: true,
      player: true,
      draftPick: true,
    },
  },
  votes: true,
} as const;

const tradeIncludeWithComments = {
  ...tradeInclude,
  comments: {
    orderBy: { createdAt: "desc" as const },
  },
} as const;

export async function saveTradeAction(input: SaveTradeInput) {
  const { userId } = await auth();

  const parseResult = saveTradeSchema.safeParse(input);

  if (!parseResult.success) {
    console.error("Validation errors:", parseResult.error.errors);
    throw new Error(
      `Invalid trade data: ${JSON.stringify(parseResult.error.errors)}`
    );
  }

  const { title, description, rating, salaryValid, assets } = parseResult.data;

  // Collect unique team IDs from all assets
  const teamIds = new Set<number>();
  assets.forEach((a) => {
    teamIds.add(a.teamId);
    teamIds.add(a.targetTeamId);
  });

  // Fetch teams, players, and draft picks
  const [teams, players, draftPicks] = await Promise.all([
    db.team.findMany({
      where: { id: { in: Array.from(teamIds) } },
    }),
    db.player.findMany({
      where: {
        id: {
          in: assets
            .filter((a) => a.type === "player" && a.playerId)
            .map((a) => a.playerId!),
        },
      },
    }),
    db.draftPick.findMany({
      where: {
        id: {
          in: assets
            .filter((a) => a.type === "pick" && a.draftPickId)
            .map((a) => a.draftPickId!),
        },
      },
    }),
  ]);

  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const playerMap = new Map(players.map((p) => [p.id, p]));
  const pickMap = new Map(draftPicks.map((p) => [p.id, p]));

  // Create trade with snapshots in a transaction
  const trade = await db.$transaction(async (tx) => {
    // Create the Trade
    const newTrade = await tx.trade.create({
      data: {
        title,
        description: description || null,
        rating,
        salaryValid,
        userId: userId ?? null,
      },
    });

    // Create TradeTeam records for each team
    const tradeTeamMap = new Map<number, number>(); // teamId -> tradeTeamId
    for (const teamId of teamIds) {
      const team = teamMap.get(teamId);
      if (!team) continue;
      const logos = team.logos as { href: string; alt: string }[];
      const tradeTeam = await tx.tradeTeam.create({
        data: {
          tradeId: newTrade.id,
          teamId: team.id,
          teamDisplayName: team.displayName,
          teamAbbreviation: team.abbreviation,
          teamLogo: logos?.[0] ?? {},
          totalCapAllocation: team.totalCapAllocation,
          capSpace: team.capSpace,
          firstApronSpace: team.firstApronSpace,
          secondApronSpace: team.secondApronSpace,
        },
      });
      tradeTeamMap.set(teamId, tradeTeam.id);
    }

    // Create TradeAsset records with snapshot fields
    for (const asset of assets) {
      const tradeTeamId = tradeTeamMap.get(asset.teamId)!;
      const targetTradeTeamId = tradeTeamMap.get(asset.targetTeamId)!;

      if (asset.type === "player" && asset.playerId) {
        const player = playerMap.get(asset.playerId);
        const contract = player?.contract as { salary?: number; yearsRemaining?: number } | null;
        const position = player?.position as { abbreviation?: string } | null;
        const headshot = player?.headshot as { href?: string; alt?: string } | null;
        await tx.tradeAsset.create({
          data: {
            type: "player",
            tradeId: newTrade.id,
            tradeTeamId,
            targetTradeTeamId,
            playerId: asset.playerId,
            playerName: player?.displayName ?? null,
            playerHeadshot: headshot ?? undefined,
            playerPosition: position?.abbreviation ?? null,
            playerSalary: contract?.salary ?? null,
            playerContractYears: contract?.yearsRemaining ?? null,
            playerEspnId: player?.espnId ?? null,
          },
        });
      } else if (asset.type === "pick" && asset.draftPickId) {
        const pick = pickMap.get(asset.draftPickId);
        await tx.tradeAsset.create({
          data: {
            type: "pick",
            tradeId: newTrade.id,
            tradeTeamId,
            targetTradeTeamId,
            draftPickId: asset.draftPickId,
            pickYear: pick?.year ?? null,
            pickRound: pick?.round ?? null,
            pickIsProtected: pick?.isProtected ?? null,
            pickIsSwap: pick?.isSwap ?? null,
            pickDescription: pick?.description ?? null,
          },
        });
      }
    }

    return tx.trade.findUniqueOrThrow({
      where: { id: newTrade.id },
      include: tradeInclude,
    });
  });

  return trade;
}

export async function getSavedTrades(options?: { userOnly?: boolean }) {
  const { userId } = await auth();

  const trades = await db.trade.findMany({
    where: options?.userOnly && userId ? { userId } : undefined,
    orderBy: {
      createdAt: "desc",
    },
    include: tradeInclude,
  });

  return trades;
}

export async function getAllTrades() {
  const trades = await db.trade.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: tradeInclude,
  });

  return trades;
}

const TRADES_PER_PAGE = 10;

export type SortOption = "recent" | "popular";

export async function getPaginatedTrades(
  page: number = 1,
  sortBy: SortOption = "recent"
) {
  const skip = (page - 1) * TRADES_PER_PAGE;

  if (sortBy === "popular") {
    const allTrades = await db.trade.findMany({
      include: tradeInclude,
    });

    const tradesWithScores = allTrades.map((trade) => {
      const score = trade.votes.reduce((acc, vote) => acc + vote.value, 0);
      return { ...trade, _score: score };
    });

    tradesWithScores.sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const paginatedTrades = tradesWithScores.slice(
      skip,
      skip + TRADES_PER_PAGE
    );
    const trades = paginatedTrades.map(({ _score, ...trade }) => trade);

    return {
      trades,
      totalCount: allTrades.length,
      totalPages: Math.ceil(allTrades.length / TRADES_PER_PAGE),
      currentPage: page,
      hasMore: skip + trades.length < allTrades.length,
    };
  }

  // Default: sort by recent
  const [trades, totalCount] = await Promise.all([
    db.trade.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: tradeInclude,
      skip,
      take: TRADES_PER_PAGE,
    }),
    db.trade.count(),
  ]);

  return {
    trades,
    totalCount,
    totalPages: Math.ceil(totalCount / TRADES_PER_PAGE),
    currentPage: page,
    hasMore: skip + trades.length < totalCount,
  };
}

export type PaginatedTradesResult = Awaited<
  ReturnType<typeof getPaginatedTrades>
>;

// Export the trade type for use in components
export type TradeWithAssets = Awaited<ReturnType<typeof getAllTrades>>[number];

export async function getUserTrades() {
  const { userId } = await auth();

  if (!userId) {
    return [] as Awaited<ReturnType<typeof getAllTrades>>;
  }

  const trades = await db.trade.findMany({
    where: { userId },
    orderBy: {
      createdAt: "desc",
    },
    include: tradeInclude,
  });

  return trades;
}

export async function getPaginatedUserTrades(page: number = 1) {
  const { userId } = await auth();

  if (!userId) {
    return {
      trades: [] as TradeWithAssets[],
      totalCount: 0,
      totalPages: 0,
      currentPage: 1,
      hasMore: false,
    };
  }

  const skip = (page - 1) * TRADES_PER_PAGE;

  const [trades, totalCount] = await Promise.all([
    db.trade.findMany({
      where: { userId },
      orderBy: {
        createdAt: "desc",
      },
      include: tradeInclude,
      skip,
      take: TRADES_PER_PAGE,
    }),
    db.trade.count({ where: { userId } }),
  ]);

  return {
    trades,
    totalCount,
    totalPages: Math.ceil(totalCount / TRADES_PER_PAGE),
    currentPage: page,
    hasMore: skip + trades.length < totalCount,
  };
}

export async function deleteTrade(tradeId: number) {
  await db.trade.delete({
    where: { id: tradeId },
  });

  return { success: true };
}

export async function getTradeById(tradeId: number) {
  const trade = await db.trade.findUnique({
    where: { id: tradeId },
    include: tradeIncludeWithComments,
  });

  return trade;
}

// ============ VOTING ACTIONS ============

export async function voteOnTrade(tradeId: number, value: 1 | -1) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("You must be logged in to vote");
  }

  // Check if user already voted on this trade
  const existingVote = await db.tradeVote.findUnique({
    where: {
      userId_tradeId: {
        userId,
        tradeId,
      },
    },
  });

  if (existingVote) {
    if (existingVote.value === value) {
      // Same vote - remove it (toggle off)
      await db.tradeVote.delete({
        where: { id: existingVote.id },
      });
      return { action: "removed", value: 0 };
    } else {
      // Different vote - update it
      await db.tradeVote.update({
        where: { id: existingVote.id },
        data: { value },
      });
      return { action: "changed", value };
    }
  } else {
    // No existing vote - create new one
    await db.tradeVote.create({
      data: {
        userId,
        tradeId,
        value,
      },
    });
    return { action: "created", value };
  }
}

export async function getTradeVotes(tradeId: number) {
  const { userId } = await auth();

  const votes = await db.tradeVote.findMany({
    where: { tradeId },
  });

  const upvotes = votes.filter((v) => v.value === 1).length;
  const downvotes = votes.filter((v) => v.value === -1).length;
  const score = upvotes - downvotes;
  const userVote = userId
    ? votes.find((v) => v.userId === userId)?.value ?? 0
    : 0;

  return { upvotes, downvotes, score, userVote };
}

export async function getUserUpvotedTrades() {
  const { userId } = await auth();

  if (!userId) {
    return [] as Awaited<ReturnType<typeof getAllTrades>>;
  }

  const upvotedTradeIds = await db.tradeVote.findMany({
    where: {
      userId,
      value: 1,
    },
    select: {
      tradeId: true,
    },
  });

  const trades = await db.trade.findMany({
    where: {
      id: {
        in: upvotedTradeIds.map((v) => v.tradeId),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    include: tradeInclude,
  });

  return trades;
}

export async function getPaginatedUpvotedTrades(page: number = 1) {
  const { userId } = await auth();

  if (!userId) {
    return {
      trades: [] as TradeWithAssets[],
      totalCount: 0,
      totalPages: 0,
      currentPage: 1,
      hasMore: false,
    };
  }

  const skip = (page - 1) * TRADES_PER_PAGE;

  const upvotedTradeIds = await db.tradeVote.findMany({
    where: {
      userId,
      value: 1,
    },
    select: {
      tradeId: true,
    },
  });

  const tradeIds = upvotedTradeIds.map((v) => v.tradeId);
  const totalCount = tradeIds.length;

  const trades = await db.trade.findMany({
    where: {
      id: {
        in: tradeIds,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    include: tradeInclude,
    skip,
    take: TRADES_PER_PAGE,
  });

  return {
    trades,
    totalCount,
    totalPages: Math.ceil(totalCount / TRADES_PER_PAGE),
    currentPage: page,
    hasMore: skip + trades.length < totalCount,
  };
}

// ============ COMMENT ACTIONS ============

const commentSchema = z.object({
  tradeId: z.number().int().positive(),
  content: z.string().min(1).max(1000),
  userName: z.string().min(1).max(100),
});

export type CreateCommentInput = z.infer<typeof commentSchema>;

export async function createComment(input: CreateCommentInput) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("You must be logged in to comment");
  }

  const parseResult = commentSchema.safeParse(input);

  if (!parseResult.success) {
    throw new Error(
      `Invalid comment data: ${JSON.stringify(parseResult.error.errors)}`
    );
  }

  const { tradeId, content, userName } = parseResult.data;

  const comment = await db.tradeComment.create({
    data: {
      userId,
      userName,
      content,
      tradeId,
    },
  });

  return comment;
}

export async function getTradeComments(tradeId: number) {
  const comments = await db.tradeComment.findMany({
    where: { tradeId },
    orderBy: { createdAt: "desc" },
  });

  return comments;
}

export async function deleteComment(commentId: number) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("You must be logged in to delete a comment");
  }

  const comment = await db.tradeComment.findUnique({
    where: { id: commentId },
  });

  if (!comment) {
    throw new Error("Comment not found");
  }

  if (comment.userId !== userId) {
    throw new Error("You can only delete your own comments");
  }

  await db.tradeComment.delete({
    where: { id: commentId },
  });

  return { success: true };
}
