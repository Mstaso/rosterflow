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
  description: z.string().min(1).max(500),
  rating: z.number().min(0).max(10),
  salaryValid: z.boolean(),
  assets: z.array(tradeAssetSchema),
});

export type SaveTradeInput = z.infer<typeof saveTradeSchema>;

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

  // Create the trade with its assets in a transaction
  const trade = await db.trade.create({
    data: {
      title,
      description,
      rating,
      salaryValid,
      userId: userId ?? null, // Associate with current user if logged in
      assets: {
        create: assets.map((asset) => ({
          type: asset.type,
          teamId: asset.teamId,
          targetTeamId: asset.targetTeamId,
          playerId: asset.playerId ?? null,
          draftPickId: asset.draftPickId ?? null,
        })),
      },
    },
    include: {
      assets: true,
    },
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
    include: {
      assets: {
        include: {
          player: true,
          draftPick: true,
          team: true,
          targetTeam: true,
        },
      },
      votes: true,
    },
  });

  return trades;
}

export async function getAllTrades() {
  const trades = await db.trade.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      assets: {
        include: {
          player: true,
          draftPick: true,
          team: true,
          targetTeam: true,
        },
      },
      votes: true,
    },
  });

  return trades;
}

const TRADES_PER_PAGE = 10;

export type SortOption = "recent" | "popular";

export async function getPaginatedTrades(page: number = 1, sortBy: SortOption = "recent") {
  const skip = (page - 1) * TRADES_PER_PAGE;

  if (sortBy === "popular") {
    // For popular sorting, we need to calculate vote scores
    // First get all trades with votes, then sort by score
    const allTrades = await db.trade.findMany({
      include: {
        assets: {
          include: {
            player: true,
            draftPick: true,
            team: true,
            targetTeam: true,
          },
        },
        votes: true,
      },
    });

    // Calculate score for each trade and sort
    const tradesWithScores = allTrades.map((trade) => {
      const score = trade.votes.reduce((acc, vote) => acc + vote.value, 0);
      return { ...trade, _score: score };
    });

    // Sort by score (descending), then by date (descending) for ties
    tradesWithScores.sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Paginate
    const paginatedTrades = tradesWithScores.slice(skip, skip + TRADES_PER_PAGE);
    // Remove the _score field before returning
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
      include: {
        assets: {
          include: {
            player: true,
            draftPick: true,
            team: true,
            targetTeam: true,
          },
        },
        votes: true,
      },
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

export type PaginatedTradesResult = Awaited<ReturnType<typeof getPaginatedTrades>>;

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
    include: {
      assets: {
        include: {
          player: true,
          draftPick: true,
          team: true,
          targetTeam: true,
        },
      },
      votes: true,
    },
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
      include: {
        assets: {
          include: {
            player: true,
            draftPick: true,
            team: true,
            targetTeam: true,
          },
        },
        votes: true,
      },
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
  // Delete associated assets first, then the trade
  await db.tradeAsset.deleteMany({
    where: { tradeId },
  });

  await db.trade.delete({
    where: { id: tradeId },
  });

  return { success: true };
}

export async function getTradeById(tradeId: number) {
  const trade = await db.trade.findUnique({
    where: { id: tradeId },
    include: {
      assets: {
        include: {
          player: true,
          draftPick: true,
          team: true,
          targetTeam: true,
        },
      },
      votes: true,
    },
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

  // Get all trades the user has upvoted
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
    include: {
      assets: {
        include: {
          player: true,
          draftPick: true,
          team: true,
          targetTeam: true,
        },
      },
      votes: true,
    },
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

  // Get all upvoted trade IDs for this user
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
    include: {
      assets: {
        include: {
          player: true,
          draftPick: true,
          team: true,
          targetTeam: true,
        },
      },
      votes: true,
    },
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
