"use server";

import { db } from "~/server/db";

export interface RumorFilters {
  page?: number;
  sourceType?: "insider" | "fan" | null;
  playerId?: number | null;
  teamId?: number | null;
}

const PAGE_SIZE = 20;

export async function getRumors(filters: RumorFilters = {}) {
  const { page = 1, sourceType, playerId, teamId } = filters;

  const where: Record<string, unknown> = {};

  if (sourceType) {
    where.sourceType = sourceType;
  }

  if (playerId || teamId) {
    where.entities = {
      some: {
        ...(playerId ? { playerId } : {}),
        ...(teamId ? { teamId } : {}),
      },
    };
  }

  const [rumors, total] = await Promise.all([
    db.rumorItem.findMany({
      where,
      include: {
        entities: {
          select: {
            id: true,
            entityType: true,
            entityName: true,
            playerId: true,
            teamId: true,
          },
        },
      },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.rumorItem.count({ where }),
  ]);

  // For player entities, fetch their current teamId for the Generate Trade button
  const playerIds = rumors
    .flatMap((r) => r.entities)
    .filter((e) => e.entityType === "player" && e.playerId)
    .map((e) => e.playerId!);

  const playerTeamMap = new Map<number, number>();
  if (playerIds.length > 0) {
    const players = await db.player.findMany({
      where: { id: { in: [...new Set(playerIds)] } },
      select: { id: true, teamId: true },
    });
    for (const p of players) {
      playerTeamMap.set(p.id, p.teamId);
    }
  }

  // Enrich entities with player team info
  const enrichedRumors = rumors.map((rumor) => ({
    ...rumor,
    publishedAt: rumor.publishedAt.toISOString(),
    createdAt: rumor.createdAt.toISOString(),
    updatedAt: rumor.updatedAt.toISOString(),
    extractedAt: rumor.extractedAt?.toISOString() ?? null,
    entities: rumor.entities.map((e) => ({
      ...e,
      playerTeamId:
        e.entityType === "player" && e.playerId
          ? playerTeamMap.get(e.playerId) ?? null
          : null,
    })),
  }));

  return {
    rumors: enrichedRumors,
    total,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
  };
}

export type RumorWithEntities = Awaited<
  ReturnType<typeof getRumors>
>["rumors"][number];
export type RumorEntityWithTeam = RumorWithEntities["entities"][number];

export interface BuzzItem {
  id: number;
  name: string;
  type: "player" | "team";
  mentions: number;
  headshot?: string | null;
  logo?: string | null;
}

export async function getBuzzScores(): Promise<{
  players: BuzzItem[];
  teams: BuzzItem[];
}> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Get top mentioned players
  const playerBuzz = await db.rumorEntity.groupBy({
    by: ["playerId", "entityName"],
    where: {
      entityType: "player",
      playerId: { not: null },
      rumor: { publishedAt: { gte: sevenDaysAgo } },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  // Get top mentioned teams
  const teamBuzz = await db.rumorEntity.groupBy({
    by: ["teamId", "entityName"],
    where: {
      entityType: "team",
      teamId: { not: null },
      rumor: { publishedAt: { gte: sevenDaysAgo } },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  // Fetch headshots for top players
  const playerIds = playerBuzz
    .map((p) => p.playerId!)
    .filter(Boolean);
  const playerDetails =
    playerIds.length > 0
      ? await db.player.findMany({
          where: { id: { in: playerIds } },
          select: { id: true, headshot: true },
        })
      : [];
  const playerHeadshots = new Map(
    playerDetails.map((p) => [
      p.id,
      (p.headshot as { href?: string } | null)?.href ?? null,
    ])
  );

  // Fetch logos for top teams
  const teamIds = teamBuzz.map((t) => t.teamId!).filter(Boolean);
  const teamDetails =
    teamIds.length > 0
      ? await db.team.findMany({
          where: { id: { in: teamIds } },
          select: { id: true, logos: true },
        })
      : [];
  const teamLogos = new Map(
    teamDetails.map((t) => [
      t.id,
      (t.logos as Array<{ href?: string }> | null)?.[0]?.href ?? null,
    ])
  );

  return {
    players: playerBuzz.map((p) => ({
      id: p.playerId!,
      name: p.entityName,
      type: "player" as const,
      mentions: p._count.id,
      headshot: playerHeadshots.get(p.playerId!) ?? null,
      logo: null,
    })),
    teams: teamBuzz.map((t) => ({
      id: t.teamId!,
      name: t.entityName,
      type: "team" as const,
      mentions: t._count.id,
      headshot: null,
      logo: teamLogos.get(t.teamId!) ?? null,
    })),
  };
}
