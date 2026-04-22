/**
 * Pure grader for generated trades. No I/O, no DB lookups.
 *
 * Given a trade (gives/receives shape) and the hydrated teams that
 * participated in the generation, compute:
 *   - per-team salary validity (using existing cap-tier + matching-bounds logic)
 *   - per-team value balance (player ratings + pick values)
 *   - integrity (did any player/pick name fail to resolve back to a team?)
 *
 * The grader intentionally reads the same data structures the generator
 * consumed so measurements reflect reality.
 */

import type { DraftPick, Player, Team } from "~/types";
import {
  computeMatchingBounds,
  computePlayerRating,
  getCapTier,
  type CapTier,
} from "~/lib/server-utils";

/**
 * Calibration for summing pick-value into the per-team valueDelta.
 *
 * Pick estimatedValues are on a 1-100 scale, as are player ratings. But a
 * "pick value" of 100 (e.g. the #1 pick) represents future upside, not a
 * current-day 100-rated player. Empirically a top-10 pick tends to produce
 * a starter-caliber NBA player (rating ~55-65), so we scale raw pick value
 * by this factor when comparing to player ratings. Keeps star-for-picks
 * trades from looking artificially lopsided in the metrics.
 */
const PICK_VALUE_WEIGHT = 0.6;

/**
 * Warning thresholds for trade shape / realism (not hard-blocked — just flagged).
 *
 * Calibrated against real 2020s NBA trades:
 *   - Siakam → IND (2024): 6 assets (3p + 3pk), 2-team
 *   - Gobert → MIN (2022): 7 assets (4p + 3pk), 2-team
 *   - Westbrook-era Lakers moves: typically 5-8 assets
 *   - Kyrie → DAL (2023): 5 assets
 *   - KD → PHX (2023): ~13 assets, 4-team
 *
 * MAX_ASSETS_2_TEAM=7 accepts the realistic 3p+3pk / 4p+3pk shape.
 * MAX_ASSETS_MULTI_TEAM=10 accepts large but plausible multi-team deals
 * while still flagging the 13+ asset mega-trades as outliers.
 *
 * Teams rarely gain or shed more than 2 players net in a single trade —
 * that threshold stays.
 */
const MAX_PLAYER_COUNT_DELTA_PER_TEAM = 2;
const MAX_ASSETS_2_TEAM = 7;
const MAX_ASSETS_MULTI_TEAM = 10;

export interface TeamGrade {
  teamName: string;
  capTier: CapTier;
  outgoingSalary: number;
  incomingSalary: number;
  bounds: { min: number; max: number } | null;
  salaryValid: boolean;
  /** 0 if valid, else signed distance outside bounds (positive = over max, negative = under min). */
  salaryDelta: number;

  outgoingRating: number;
  incomingRating: number;
  outgoingPickValue: number;
  incomingPickValue: number;
  /** Pick values are weighted by PICK_VALUE_WEIGHT before summing into valueDelta. */
  valueDelta: number;

  /** Number of players the team is giving up. */
  outgoingPlayerCount: number;
  /** Number of players the team is receiving. */
  incomingPlayerCount: number;
  /** in - out. Positive = roster growing, negative = shrinking. */
  playerCountDelta: number;
  /** True if |playerCountDelta| > MAX_PLAYER_COUNT_DELTA_PER_TEAM. */
  rosterImbalanceWarning: boolean;

  /** Names of assets that couldn't be resolved to real players/picks on any team. */
  unresolvedGiven: string[];
  unresolvedReceived: string[];
}

export interface TradeGrade {
  source: "manual" | "ai";
  teamCount: number;
  integrityValid: boolean;
  perTeam: TeamGrade[];
  salaryValidAllTeams: boolean;
  maxAbsValueDelta: number;
  avgAbsValueDelta: number;

  /** Total players moving across all teams in the trade. */
  totalPlayersMoving: number;
  /** Total picks moving across all teams. */
  totalPicksMoving: number;
  /** totalPlayers + totalPicks. */
  totalAssetsMoving: number;
  /** True if at least one team has |playerCountDelta| > threshold. */
  anyRosterImbalance: boolean;
  /** True if totalAssetsMoving exceeds the size threshold for this teamCount. */
  oversizedTrade: boolean;
}

/** Normalize player / pick names for matching across the trade and hydrated rosters. */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .trim();
}

function findPlayerByName(
  teams: Team[],
  name: string
): { player: Player; team: Team } | null {
  const target = norm(name);
  for (const team of teams) {
    const players = (team.players ?? []) as Player[];
    const hit = players.find((p) => norm(p.fullName) === target);
    if (hit) return { player: hit, team };
  }
  return null;
}

/** Parse "2026 R1" → { year: 2026, round: 1 }. Returns null if format is off. */
function parsePickName(name: string): { year: number; round: number } | null {
  const m = name.trim().match(/^(\d{4})\s+R([12])/i);
  if (!m) return null;
  return { year: parseInt(m[1]!, 10), round: parseInt(m[2]!, 10) };
}

function findPickByName(
  teams: Team[],
  name: string
): { pick: DraftPick; team: Team } | null {
  const parsed = parsePickName(name);
  if (!parsed) return null;
  for (const team of teams) {
    const picks = (team.draftPicks ?? []) as DraftPick[];
    const hit = picks.find(
      (p) => p.year === parsed.year && p.round === parsed.round
    );
    if (hit) return { pick: hit, team };
  }
  return null;
}

function findTeamByName(teams: Team[], name: string): Team | null {
  const target = norm(name);
  return (
    teams.find((t) => {
      const disp = norm((t as any).displayName ?? "");
      const plain = norm(t.name ?? "");
      return disp === target || plain === target;
    }) ?? null
  );
}

/**
 * Grade a single trade against the hydrated teams used during generation.
 */
export function gradeTrade(
  trade: any,
  involvedTeams: Team[],
  source: "manual" | "ai"
): TradeGrade {
  const perTeam: TeamGrade[] = [];
  let integrityValid = true;

  const tradeTeams: any[] = Array.isArray(trade?.teams) ? trade.teams : [];

  for (const tt of tradeTeams) {
    const teamName: string = tt.teamName;
    const hydrated = findTeamByName(involvedTeams, teamName);

    // If we can't match the team name to a hydrated team, we can't grade this
    // side. Record a stub so the trade-level integrity check flips false.
    if (!hydrated) {
      integrityValid = false;
      perTeam.push({
        teamName,
        capTier: "UNDER_CAP",
        outgoingSalary: 0,
        incomingSalary: 0,
        bounds: null,
        salaryValid: false,
        salaryDelta: 0,
        outgoingRating: 0,
        incomingRating: 0,
        outgoingPickValue: 0,
        incomingPickValue: 0,
        valueDelta: 0,
        outgoingPlayerCount: 0,
        incomingPlayerCount: 0,
        playerCountDelta: 0,
        rosterImbalanceWarning: false,
        unresolvedGiven: [],
        unresolvedReceived: [],
      });
      continue;
    }

    const grade = gradeTeamSide(tt, hydrated, involvedTeams);
    if (grade.unresolvedGiven.length > 0 || grade.unresolvedReceived.length > 0) {
      integrityValid = false;
    }
    perTeam.push(grade);
  }

  const absValueDeltas = perTeam.map((t) => Math.abs(t.valueDelta));
  const maxAbsValueDelta = absValueDeltas.length
    ? Math.max(...absValueDeltas)
    : 0;
  const avgAbsValueDelta = absValueDeltas.length
    ? absValueDeltas.reduce((a, b) => a + b, 0) / absValueDeltas.length
    : 0;

  // --- Trade-shape realism ---
  const totalPlayersMoving = perTeam.reduce(
    (a, t) => a + t.outgoingPlayerCount,
    0
  );
  const totalPicksMoving = tradeTeams.reduce(
    (a: number, tt: any) => a + (tt.gives?.picks?.length ?? 0),
    0
  );
  const totalAssetsMoving = totalPlayersMoving + totalPicksMoving;
  const anyRosterImbalance = perTeam.some((t) => t.rosterImbalanceWarning);
  const sizeThreshold =
    tradeTeams.length <= 2 ? MAX_ASSETS_2_TEAM : MAX_ASSETS_MULTI_TEAM;
  const oversizedTrade = totalAssetsMoving > sizeThreshold;

  return {
    source,
    teamCount: tradeTeams.length,
    integrityValid,
    perTeam,
    salaryValidAllTeams: perTeam.every((t) => t.salaryValid),
    maxAbsValueDelta,
    avgAbsValueDelta,
    totalPlayersMoving,
    totalPicksMoving,
    totalAssetsMoving,
    anyRosterImbalance,
    oversizedTrade,
  };
}

function gradeTeamSide(
  tt: any,
  hydrated: Team,
  allTeams: Team[]
): TeamGrade {
  const capTier = getCapTier(hydrated);
  const teamName: string =
    (hydrated as any).displayName ?? hydrated.name ?? tt.teamName;

  // --- Outgoing: players come from this team's own roster, picks from this team ---
  let outgoingSalary = 0;
  let outgoingRating = 0;
  let outgoingPickValue = 0;
  const unresolvedGiven: string[] = [];

  for (const p of tt.gives?.players ?? []) {
    const match = findPlayerByName([hydrated], p.name);
    if (!match) {
      unresolvedGiven.push(`player:${p.name}`);
      continue;
    }
    outgoingSalary += match.player.contract?.salary ?? 0;
    outgoingRating += computePlayerRating(match.player).rating;
  }
  for (const pk of tt.gives?.picks ?? []) {
    const match = findPickByName([hydrated], pk.name);
    if (!match) {
      unresolvedGiven.push(`pick:${pk.name}`);
      continue;
    }
    outgoingPickValue += match.pick.estimatedValue ?? 0;
  }

  // --- Incoming: assets from any other team in the trade ---
  let incomingSalary = 0;
  let incomingRating = 0;
  let incomingPickValue = 0;
  const unresolvedReceived: string[] = [];

  const otherTeams = allTeams.filter((t) => t.id !== hydrated.id);

  for (const p of tt.receives?.players ?? []) {
    const match = findPlayerByName(otherTeams, p.name);
    if (!match) {
      unresolvedReceived.push(`player:${p.name}`);
      continue;
    }
    incomingSalary += match.player.contract?.salary ?? 0;
    incomingRating += computePlayerRating(match.player).rating;
  }
  for (const pk of tt.receives?.picks ?? []) {
    const match = findPickByName(otherTeams, pk.name);
    if (!match) {
      unresolvedReceived.push(`pick:${pk.name}`);
      continue;
    }
    incomingPickValue += match.pick.estimatedValue ?? 0;
  }

  // --- Salary validity ---
  const bounds = computeMatchingBounds(outgoingSalary, capTier);
  let salaryValid = true;
  let salaryDelta = 0;
  if (capTier === "UNDER_CAP") {
    // No matching constraint
    salaryValid = true;
  } else if (bounds) {
    if (incomingSalary > bounds.max) {
      salaryValid = false;
      salaryDelta = incomingSalary - bounds.max;
    } else if (outgoingSalary > 0 && incomingSalary < bounds.min) {
      salaryValid = false;
      salaryDelta = incomingSalary - bounds.min; // negative
    }
  }

  // Pick values are scaled down when summing into valueDelta — see PICK_VALUE_WEIGHT.
  const valueDelta =
    incomingRating +
    incomingPickValue * PICK_VALUE_WEIGHT -
    outgoingRating -
    outgoingPickValue * PICK_VALUE_WEIGHT;

  // --- Player count realism ---
  const outgoingPlayerCount = (tt.gives?.players?.length ?? 0) -
    unresolvedGiven.filter((x) => x.startsWith("player:")).length;
  const incomingPlayerCount = (tt.receives?.players?.length ?? 0) -
    unresolvedReceived.filter((x) => x.startsWith("player:")).length;
  const playerCountDelta = incomingPlayerCount - outgoingPlayerCount;
  const rosterImbalanceWarning =
    Math.abs(playerCountDelta) > MAX_PLAYER_COUNT_DELTA_PER_TEAM;

  return {
    teamName,
    capTier,
    outgoingSalary,
    incomingSalary,
    bounds,
    salaryValid,
    salaryDelta,
    outgoingRating,
    incomingRating,
    outgoingPickValue,
    incomingPickValue,
    valueDelta,
    outgoingPlayerCount,
    incomingPlayerCount,
    playerCountDelta,
    rosterImbalanceWarning,
    unresolvedGiven,
    unresolvedReceived,
  };
}

// --- Aggregators ---------------------------------------------------------

export interface ScenarioSummary {
  scenarioId: string;
  category: string;
  teamCount: number;
  tradeCount: number;
  salaryValidCount: number;
  salaryValidPct: number;
  integrityValidCount: number;
  avgAbsValueDelta: number;
  worstAbsValueDelta: number;
  bySource: Record<
    "manual" | "ai",
    { count: number; salaryValidCount: number; avgAbsValueDelta: number }
  >;
}

export function summarizeScenario(
  scenarioId: string,
  category: string,
  grades: TradeGrade[]
): ScenarioSummary {
  const teamCount = grades[0]?.teamCount ?? 0;
  const validCount = grades.filter((g) => g.salaryValidAllTeams).length;
  const integrityCount = grades.filter((g) => g.integrityValid).length;
  const avgAbs = grades.length
    ? grades.reduce((a, g) => a + g.avgAbsValueDelta, 0) / grades.length
    : 0;
  const worst = grades.length
    ? Math.max(...grades.map((g) => g.maxAbsValueDelta))
    : 0;

  const by = (source: "manual" | "ai") => {
    const subset = grades.filter((g) => g.source === source);
    return {
      count: subset.length,
      salaryValidCount: subset.filter((g) => g.salaryValidAllTeams).length,
      avgAbsValueDelta: subset.length
        ? subset.reduce((a, g) => a + g.avgAbsValueDelta, 0) / subset.length
        : 0,
    };
  };

  return {
    scenarioId,
    category,
    teamCount,
    tradeCount: grades.length,
    salaryValidCount: validCount,
    salaryValidPct: grades.length ? validCount / grades.length : 0,
    integrityValidCount: integrityCount,
    avgAbsValueDelta: avgAbs,
    worstAbsValueDelta: worst,
    bySource: { manual: by("manual"), ai: by("ai") },
  };
}

export interface RunSummary {
  tradeCount: number;
  scenarioCount: number;
  salaryValidPct: { overall: number; manual: number; ai: number };
  avgAbsValueDelta: { overall: number; manual: number; ai: number };
  integrityValidPct: number;
  /**
   * % of trades with at least one team having |playerCountDelta| exceeding
   * the realism threshold (default: |delta| > 2 players).
   */
  rosterImbalancePct: { overall: number; manual: number; ai: number };
  /**
   * % of trades where total assets moving exceeds the realism threshold
   * (6 for 2-team, 8 for multi-team).
   */
  oversizedTradePct: { overall: number; manual: number; ai: number };
  /** Avg total assets (players + picks) moved per trade. */
  avgAssetsPerTrade: { overall: number; manual: number; ai: number };
  byTeamCount: Record<
    string,
    { count: number; salaryValidPct: number; avgAbsValueDelta: number }
  >;
  byCategory: Record<
    string,
    { count: number; salaryValidPct: number; avgAbsValueDelta: number }
  >;
}

function bucketByTeamCount(n: number): "2" | "3" | "4plus" {
  if (n <= 2) return "2";
  if (n === 3) return "3";
  return "4plus";
}

export function summarizeRun(
  scenarioSummaries: { summary: ScenarioSummary; grades: TradeGrade[] }[]
): RunSummary {
  const allGrades = scenarioSummaries.flatMap((s) => s.grades);
  const avgAbs = (subset: TradeGrade[]) =>
    subset.length
      ? subset.reduce((a, g) => a + g.avgAbsValueDelta, 0) / subset.length
      : 0;
  const validPct = (subset: TradeGrade[]) =>
    subset.length
      ? subset.filter((g) => g.salaryValidAllTeams).length / subset.length
      : 0;

  const manual = allGrades.filter((g) => g.source === "manual");
  const ai = allGrades.filter((g) => g.source === "ai");

  const byTeamCount: RunSummary["byTeamCount"] = {};
  for (const bucket of ["2", "3", "4plus"] as const) {
    const subset = allGrades.filter(
      (g) => bucketByTeamCount(g.teamCount) === bucket
    );
    byTeamCount[bucket] = {
      count: subset.length,
      salaryValidPct: validPct(subset),
      avgAbsValueDelta: avgAbs(subset),
    };
  }

  const byCategory: RunSummary["byCategory"] = {};
  for (const s of scenarioSummaries) {
    const cat = s.summary.category;
    const existing = byCategory[cat] ?? {
      count: 0,
      salaryValidPct: 0,
      avgAbsValueDelta: 0,
    };
    const merged = [
      ...(existing.count ? [existing] : []),
      {
        count: s.grades.length,
        salaryValidPct: s.summary.salaryValidPct,
        avgAbsValueDelta: s.summary.avgAbsValueDelta,
      },
    ];
    // Weighted by trade count
    const total = merged.reduce((a, b) => a + b.count, 0);
    byCategory[cat] = {
      count: total,
      salaryValidPct: total
        ? merged.reduce((a, b) => a + b.salaryValidPct * b.count, 0) / total
        : 0,
      avgAbsValueDelta: total
        ? merged.reduce((a, b) => a + b.avgAbsValueDelta * b.count, 0) / total
        : 0,
    };
  }

  const rosterImbalancePct = (subset: TradeGrade[]) =>
    subset.length
      ? subset.filter((g) => g.anyRosterImbalance).length / subset.length
      : 0;
  const oversizedPct = (subset: TradeGrade[]) =>
    subset.length
      ? subset.filter((g) => g.oversizedTrade).length / subset.length
      : 0;
  const avgAssets = (subset: TradeGrade[]) =>
    subset.length
      ? subset.reduce((a, g) => a + g.totalAssetsMoving, 0) / subset.length
      : 0;

  return {
    tradeCount: allGrades.length,
    scenarioCount: scenarioSummaries.length,
    salaryValidPct: {
      overall: validPct(allGrades),
      manual: validPct(manual),
      ai: validPct(ai),
    },
    avgAbsValueDelta: {
      overall: avgAbs(allGrades),
      manual: avgAbs(manual),
      ai: avgAbs(ai),
    },
    integrityValidPct: allGrades.length
      ? allGrades.filter((g) => g.integrityValid).length / allGrades.length
      : 0,
    rosterImbalancePct: {
      overall: rosterImbalancePct(allGrades),
      manual: rosterImbalancePct(manual),
      ai: rosterImbalancePct(ai),
    },
    oversizedTradePct: {
      overall: oversizedPct(allGrades),
      manual: oversizedPct(manual),
      ai: oversizedPct(ai),
    },
    avgAssetsPerTrade: {
      overall: avgAssets(allGrades),
      manual: avgAssets(manual),
      ai: avgAssets(ai),
    },
    byTeamCount,
    byCategory,
  };
}
