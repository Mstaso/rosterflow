/**
 * ESPN data fetching + the scheduled league refresh.
 *
 * The fetchers are shared by `prisma/seed.ts` (first-time setup) and
 * `/api/cron/refresh-players` (recurring refresh). Every fetcher returns
 * `null` on failure so callers decide what a failure means: the seed falls
 * back to defaults, the refresh leaves the existing rows alone.
 *
 * Kept free of `~/` imports so the seed script can import it directly.
 */

import type { PrismaClient } from "@prisma/client";

type FetchFn = typeof fetch;

const ESPN_INIT: RequestInit = {
  headers: {
    Accept: "application/json",
    "User-Agent": "Mozilla/5.0 (compatible; RosterFlows/1.0)",
  },
  cache: "no-store",
};

/**
 * Below this many games a season's numbers are noise. A 2-1 team is not a
 * contender and a 30ppg two-game sample is not a superstar, so until a
 * team/player has played this many games we keep the previous numbers.
 */
export const MIN_GAMES = 10;

/** A roster fetch returning fewer athletes than this is treated as a failure. */
const MIN_ROSTER_SIZE = 10;
/** Never prune more than this share of the league in one run (ESPN anomaly guard). */
const MAX_PRUNE_SHARE = 0.25;
const TEAM_CONCURRENCY = 6;

export interface TeamRecord {
  wins: number;
  losses: number;
  winPercentage: number;
  conferenceRank: number;
  divisionRank: number;
}

export const DEFAULT_RECORD: TeamRecord = {
  wins: 41,
  losses: 41,
  winPercentage: 0.5,
  conferenceRank: 15,
  divisionRank: 5,
};

async function getJson(url: string, f: FetchFn): Promise<any | null> {
  try {
    const response = await f(url, ESPN_INIT);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function fetchTeams(f: FetchFn = fetch): Promise<any[] | null> {
  const data = await getJson(
    "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams",
    f
  );
  const teams = data?.sports?.[0]?.leagues?.[0]?.teams;
  if (!Array.isArray(teams) || teams.length === 0) return null;
  return teams.map((teamData: any) => ({
    id: teamData.team.id,
    slug: teamData.team.slug,
    abbreviation: teamData.team.abbreviation,
    displayName: teamData.team.displayName,
    shortDisplayName: teamData.team.shortDisplayName,
    name: teamData.team.name,
    location: teamData.team.location,
    color: teamData.team.color,
    alternateColor: teamData.team.alternateColor,
    isActive: teamData.team.isActive,
    logos: teamData.team.logos,
    record: teamData.team.record,
    venue: teamData.team.venue,
    nickname: teamData.team.nickname,
    links: teamData.team.links,
  }));
}

export async function fetchTeamRecord(
  teamId: string,
  f: FetchFn = fetch
): Promise<TeamRecord | null> {
  const data = await getJson(
    `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}`,
    f
  );
  const recordItem = data?.team?.record?.items?.[0];
  if (!recordItem) return null;

  const statsMap: Record<string, number> = {};
  for (const stat of recordItem.stats || []) {
    statsMap[stat.name] = stat.value;
  }

  return {
    wins: statsMap.wins ?? DEFAULT_RECORD.wins,
    losses: statsMap.losses ?? DEFAULT_RECORD.losses,
    winPercentage: statsMap.winPercent ?? DEFAULT_RECORD.winPercentage,
    conferenceRank: statsMap.playoffSeed ?? DEFAULT_RECORD.conferenceRank,
    divisionRank: statsMap.divisionRank ?? DEFAULT_RECORD.divisionRank,
  };
}

export async function fetchPlayerStats(
  espnId: string,
  f: FetchFn = fetch
): Promise<any | null> {
  const data = await getJson(
    `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${espnId}/stats`,
    f
  );
  const avgCategory = data?.categories?.find((c: any) => c.name === "averages");
  if (!avgCategory) return null;

  const labels: string[] = avgCategory.labels || [];
  const gpIndex = labels.indexOf("GP");
  const seasons: any[] = (avgCategory.statistics || []).filter(
    (s: any) => s?.stats
  );
  // Most recent season with a real sample; early in a season that is last
  // year. Rookies (no season with MIN_GAMES) fall back to whatever exists.
  const season =
    [...seasons]
      .reverse()
      .find((s) => parseFloat(s.stats[gpIndex] || "0") >= MIN_GAMES) ??
    seasons[seasons.length - 1];
  if (!season) return null;

  const statMap: Record<string, string> = {};
  for (let i = 0; i < labels.length; i++) {
    statMap[labels[i]!] = season.stats[i];
  }

  return {
    points: parseFloat(statMap["PTS"] || "0"),
    rebounds: parseFloat(statMap["REB"] || "0"),
    assists: parseFloat(statMap["AST"] || "0"),
    steals: parseFloat(statMap["STL"] || "0"),
    blocks: parseFloat(statMap["BLK"] || "0"),
    fieldGoalPercentage: parseFloat(statMap["FG%"] || "0"),
    threePointPercentage: parseFloat(statMap["3P%"] || "0"),
    freeThrowPercentage: parseFloat(statMap["FT%"] || "0"),
    minutesPerGame: parseFloat(statMap["MIN"] || "0"),
    gamesPlayed: parseFloat(statMap["GP"] || "0"),
    turnovers: parseFloat(statMap["TO"] || "0"),
    fieldGoalAttempts: parseFloat(statMap["FGA"] || "0"),
    fieldGoalsMade: parseFloat(statMap["FGM"] || "0"),
    threePointAttempts: parseFloat(statMap["3PA"] || "0"),
    threePointMade: parseFloat(statMap["3PM"] || "0"),
    freeThrowAttempts: parseFloat(statMap["FTA"] || "0"),
    freeThrowsMade: parseFloat(statMap["FTM"] || "0"),
  };
}

export async function fetchTeamRoster(
  teamId: string,
  f: FetchFn = fetch
): Promise<{ athletes: any[]; team: string } | null> {
  const data = await getJson(
    `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/roster`,
    f
  );
  if (!Array.isArray(data?.athletes)) return null;
  return { athletes: data.athletes, team: data.team?.displayName || "Unknown" };
}

/** ESPN only attaches a usable contract to players signed for the current season. */
export function hasContract(athlete: any): boolean {
  return !!athlete.contract && athlete.contract.salary > 0;
}

/** ESPN athlete → Player columns (everything except contract/statistics/team). */
export function toPlayerFields(athlete: any) {
  return {
    espnId: athlete.id.toString(),
    firstName: athlete.firstName,
    lastName: athlete.lastName,
    fullName: athlete.fullName,
    displayName: athlete.displayName,
    shortName: athlete.shortName,
    weight: athlete.weight,
    displayWeight: athlete.displayWeight,
    height: athlete.height,
    displayHeight: athlete.displayHeight,
    age: athlete.age,
    dateOfBirth: athlete.dateOfBirth || "1990-01-01T00:00:00Z",
    // Optional Json columns: omit rather than pass null (Prisma rejects a bare null).
    birthPlace: athlete.birthPlace ?? undefined,
    slug: athlete.slug,
    headshot: athlete.headshot ?? undefined,
    jersey: athlete.jersey,
    position: athlete.position ?? {},
    injuries: athlete.injuries || [],
    experience: athlete.experience || { years: 0 },
    status: athlete.status ?? {},
  };
}

export interface RefreshResult {
  teamsRefreshed: number;
  /** Teams left untouched because ESPN failed or the write failed. */
  teamsFailed: string[];
  /** Teams whose record was kept (ESPN failed, or fewer than MIN_GAMES played). */
  recordsKept: string[];
  playersUpserted: number;
  /** On an ESPN roster with no current-season contract; existing contract kept. */
  contractsKept: number;
  /** On an ESPN roster, not in our DB, and no contract to create them with. */
  playersSkippedNoContract: number;
  playersPruned: number;
  pruneSkippedReason: string | null;
  durationMs: number;
}

/**
 * Refresh records, rosters, contracts, injuries and stats from ESPN.
 *
 * Network first, writes second, one transaction per team: any ESPN failure
 * for a team means zero writes for that team. Nothing is truncated. Players
 * who left the league are pruned only when every roster was fetched (so a
 * player traded onto a team whose fetch failed is never mistaken for waived).
 *
 * Throws only if the ESPN team list itself is unavailable — before any write.
 */
export async function refreshLeagueData(
  prisma: PrismaClient,
  f: FetchFn = fetch
): Promise<RefreshResult> {
  const started = Date.now();
  const espnTeams = await fetchTeams(f);
  if (!espnTeams) throw new Error("ESPN team list unavailable");

  const dbTeams = await prisma.team.findMany({
    select: { id: true, slug: true, abbreviation: true },
  });
  const existing = await prisma.player.findMany({
    select: { id: true, espnId: true },
  });
  const existingEspnIds = new Set(existing.map((p) => p.espnId));

  const result: RefreshResult = {
    teamsRefreshed: 0,
    teamsFailed: [],
    recordsKept: [],
    playersUpserted: 0,
    contractsKept: 0,
    playersSkippedNoContract: 0,
    playersPruned: 0,
    pruneSkippedReason: null,
    durationMs: 0,
  };
  const seenEspnIds = new Set<string>();

  const refreshTeam = async (dbTeam: (typeof dbTeams)[number]) => {
    const espnTeam = espnTeams.find((t) => t.slug === dbTeam.slug);
    const roster = espnTeam ? await fetchTeamRoster(espnTeam.id, f) : null;
    if (!espnTeam || !roster || roster.athletes.length < MIN_ROSTER_SIZE) {
      result.teamsFailed.push(dbTeam.abbreviation);
      return;
    }
    for (const a of roster.athletes) seenEspnIds.add(a.id.toString());

    const record = await fetchTeamRecord(espnTeam.id, f);
    const recordUsable = !!record && record.wins + record.losses >= MIN_GAMES;
    if (!recordUsable) result.recordsKept.push(dbTeam.abbreviation);

    const writes: any[] = [
      // Always written so Team.updatedAt marks the last successful refresh.
      prisma.team.update({
        where: { id: dbTeam.id },
        data: {
          updatedAt: new Date(),
          ...(recordUsable ? { record: { ...record } } : {}),
        },
      }),
    ];
    let upserts = 0;
    let kept = 0;
    let skipped = 0;

    for (const athlete of roster.athletes) {
      const espnId = athlete.id.toString();
      const known = existingEspnIds.has(espnId);
      const signed = hasContract(athlete);
      if (!signed && !known) {
        skipped++;
        continue;
      }
      const stats = await fetchPlayerStats(espnId, f);
      const fields = { ...toPlayerFields(athlete), teamId: dbTeam.id };
      // Failed stats / missing contract never overwrite what we already have.
      const update = {
        ...fields,
        ...(signed ? { contract: athlete.contract } : {}),
        ...(stats ? { statistics: stats } : {}),
      };
      if (!signed) kept++;
      upserts++;
      writes.push(
        signed
          ? prisma.player.upsert({
              where: { espnId },
              update,
              create: {
                ...fields,
                contract: athlete.contract,
                statistics: stats ?? undefined,
              },
            })
          : prisma.player.update({ where: { espnId }, data: update })
      );
    }

    try {
      await prisma.$transaction(writes);
      result.teamsRefreshed++;
      result.playersUpserted += upserts;
      result.contractsKept += kept;
      result.playersSkippedNoContract += skipped;
    } catch (error) {
      console.error(`[refresh] write failed for ${dbTeam.abbreviation}:`, error);
      result.teamsFailed.push(dbTeam.abbreviation);
    }
  };

  for (let i = 0; i < dbTeams.length; i += TEAM_CONCURRENCY) {
    await Promise.all(dbTeams.slice(i, i + TEAM_CONCURRENCY).map(refreshTeam));
  }

  const departed = existing.filter((p) => !seenEspnIds.has(p.espnId));
  if (result.teamsFailed.length > 0) {
    result.pruneSkippedReason = "not every team refreshed";
  } else if (departed.length > existing.length * MAX_PRUNE_SHARE) {
    result.pruneSkippedReason = `${departed.length} of ${existing.length} players missing from ESPN — looks like an ESPN problem`;
  } else if (departed.length > 0) {
    const ids = departed.map((p) => p.id);
    // Saved trades keep their own snapshot of the player; only the live link goes.
    await prisma.$transaction([
      prisma.tradeAsset.updateMany({
        where: { playerId: { in: ids } },
        data: { playerId: null },
      }),
      prisma.player.deleteMany({ where: { id: { in: ids } } }),
    ]);
    result.playersPruned = ids.length;
  }

  result.durationMs = Date.now() - started;
  return result;
}

/** Regular season + playoffs: refresh daily. July–September: Mondays only. */
export function shouldRefreshOn(date: Date): boolean {
  const month = date.getUTCMonth(); // 0-based
  const offSeason = month >= 6 && month <= 8;
  return !offSeason || date.getUTCDay() === 1;
}

/** Oldest/newest per-team refresh time. Oldest is the honest "data as of". */
export async function getDataFreshness(prisma: PrismaClient) {
  const agg = await prisma.team.aggregate({
    _min: { updatedAt: true },
    _max: { updatedAt: true },
  });
  const oldest = agg._min.updatedAt;
  const ageHours = oldest ? (Date.now() - oldest.getTime()) / 3_600_000 : null;
  return {
    oldestTeamRefresh: oldest,
    newestTeamRefresh: agg._max.updatedAt,
    ageHours: ageHours === null ? null : Math.round(ageHours),
    // Off-season cadence is weekly, so anything past 8 days is overdue.
    stale: ageHours === null || ageHours > 8 * 24,
  };
}
