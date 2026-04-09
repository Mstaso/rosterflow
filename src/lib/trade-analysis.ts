import type { Player, Team, TradeInfo, DraftPick } from "~/types";
import { computePlayerRating, computeContractValue } from "~/lib/player-utils";
import type { ContractValueTag } from "~/lib/player-utils";

// ─────────────────────��──────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export type PositionalGroup = "guards" | "wings" | "bigs";

export type PositionalImpact = {
  before: number;
  after: number;
  delta: number;
};

export type TradeImpactResult = {
  teamPowerBefore: number;
  teamPowerAfter: number;
  projectedWinsBefore: number;
  projectedWinsAfter: number;
  winDelta: number;
  positionalImpact: Record<PositionalGroup, PositionalImpact>;
  rosterFlags: string[];
};

export type CapProjectionYear = {
  year: number;
  projectedCap: number;
  projectedTeamSalary: number;
  projectedCapSpace: number;
  expiringPlayers: { name: string; salary: number }[];
  hasMaxSlot: boolean;
};

export type CapProjectionResult = {
  years: CapProjectionYear[];
};

export type TeamPhase = "contender" | "playoff" | "fringe" | "rebuilding";

export type GradeBreakdownEntry = {
  score: number;
  weight: number;
  label: string;
};

export type TradeGradeResult = {
  grade: string;
  compositeScore: number;
  teamPhase: TeamPhase;
  breakdown: {
    valueExchange: GradeBreakdownEntry;
    contractEfficiency: GradeBreakdownEntry;
    teamContext: GradeBreakdownEntry;
    positionalNeed: GradeBreakdownEntry;
    timelineFit: GradeBreakdownEntry;
  };
  headline: string;
};

// ────────────────────────��───────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const ROLE_WEIGHTS = [1.0, 0.85, 0.72, 0.6, 0.6, 0.45, 0.45, 0.45, 0.25, 0.25, 0.25, 0.25, 0.1, 0.1, 0.1];
const MAX_POSSIBLE_POWER = ROLE_WEIGHTS.reduce((sum, w) => sum + 99 * w, 0);
const WIN_FLOOR = 17;
const WIN_RANGE = 48;

const CAP_GROWTH_RATE = 0.10;
const CURRENT_SALARY_CAP = 140_588_000;

// ────────────────────────────────────────────────────���───────
// Helpers
// ────────────────────────────────────────────────────────────

function classifyPosition(pos: string | undefined): PositionalGroup {
  if (!pos) return "wings";
  const p = pos.toUpperCase();
  if (p === "PG" || p === "SG" || p === "G") return "guards";
  if (p === "PF" || p === "C" || p === "FC") return "bigs";
  return "wings"; // SF, F, GF, and anything else
}

function computeTeamPower(players: Player[]): number {
  const ratings = players
    .map((p) => computePlayerRating(p).rating)
    .sort((a, b) => b - a);

  return ratings.reduce((sum, rating, i) => {
    const weight = i < ROLE_WEIGHTS.length ? (ROLE_WEIGHTS[i] ?? 0.1) : 0.1;
    return sum + rating * weight;
  }, 0);
}

function powerToWins(power: number): number {
  return Math.round((WIN_FLOOR + (power / MAX_POSSIBLE_POWER) * WIN_RANGE) * 10) / 10;
}

function getTeamPhase(team: Team): TeamPhase {
  const r = team.record;
  if (!r) return "fringe";
  const winPct = typeof r === "object" && "winPercentage" in r ? r.winPercentage : 0.5;
  if (winPct >= 0.6) return "contender";
  if (winPct >= 0.5) return "playoff";
  if (winPct >= 0.4) return "fringe";
  return "rebuilding";
}

function filterDefined<T>(arr: (T | undefined)[] | undefined): T[] {
  if (!arr) return [];
  return arr.filter((x): x is T => x !== undefined);
}

function sumPickValue(picks: { draftPick?: DraftPick }[] | undefined): number {
  if (!picks) return 0;
  return picks.reduce((sum, p) => sum + (p.draftPick?.estimatedValue ?? 30), 0);
}

// ────────────────────────���───────────────────────────────────
// Feature 1: Trade Impact Analysis
// ────────────────────────────────────────────────────────────

export function computeTradeImpact(
  tradeInfo: TradeInfo,
  team: Team
): TradeImpactResult | null {
  if (!team.players) return null;

  const currentRoster = [...team.players];
  const sentPlayers = filterDefined(tradeInfo.playersSent);
  const receivedPlayers = filterDefined(tradeInfo.playersReceived);

  const sentIds = new Set(sentPlayers.map((p) => p.id));
  const postTradeRoster = [
    ...currentRoster.filter((p) => !sentIds.has(p.id)),
    ...receivedPlayers,
  ];

  const teamPowerBefore = computeTeamPower(currentRoster);
  const teamPowerAfter = computeTeamPower(postTradeRoster);
  const projectedWinsBefore = powerToWins(teamPowerBefore);
  const projectedWinsAfter = powerToWins(teamPowerAfter);

  // Positional impact
  const groups: PositionalGroup[] = ["guards", "wings", "bigs"];
  const positionalImpact = {} as Record<PositionalGroup, PositionalImpact>;

  for (const group of groups) {
    const beforePlayers = currentRoster.filter(
      (p) => classifyPosition(p.position?.abbreviation) === group
    );
    const afterPlayers = postTradeRoster.filter(
      (p) => classifyPosition(p.position?.abbreviation) === group
    );
    const before = beforePlayers.reduce((s, p) => s + computePlayerRating(p).rating, 0);
    const after = afterPlayers.reduce((s, p) => s + computePlayerRating(p).rating, 0);
    positionalImpact[group] = { before, after, delta: after - before };
  }

  // Roster flags
  const rosterFlags: string[] = [];
  for (const group of groups) {
    const count = postTradeRoster.filter(
      (p) => classifyPosition(p.position?.abbreviation) === group
    ).length;
    const label = group.charAt(0).toUpperCase() + group.slice(1);

    if (positionalImpact[group].delta < -20) {
      rosterFlags.push(`Weakened ${label.toLowerCase()}`);
    }
    if (count < 2) {
      rosterFlags.push(`Thin at ${label.toLowerCase()}`);
    }
    if (count > 6) {
      rosterFlags.push(`${label}-heavy roster`);
    }
  }

  // Detect role collision: same tier in same position group
  for (const group of groups) {
    const incoming = receivedPlayers.filter(
      (p) => classifyPosition(p.position?.abbreviation) === group
    );
    for (const newP of incoming) {
      const newTier = computePlayerRating(newP).tier;
      if (newTier === "Superstar" || newTier === "All-Star") {
        const existing = postTradeRoster.filter(
          (p) =>
            p.id !== newP.id &&
            classifyPosition(p.position?.abbreviation) === group &&
            computePlayerRating(p).tier === newTier
        );
        if (existing.length > 0) {
          const label = group.charAt(0).toUpperCase() + group.slice(1);
          rosterFlags.push(`Redundant ${newTier.toLowerCase()} ${label.toLowerCase()}`);
        }
      }
    }
  }

  return {
    teamPowerBefore,
    teamPowerAfter,
    projectedWinsBefore,
    projectedWinsAfter,
    winDelta: Math.round((projectedWinsAfter - projectedWinsBefore) * 10) / 10,
    positionalImpact,
    rosterFlags: [...new Set(rosterFlags)],
  };
}

// ────────────────────────────────────────────────────────────
// Feature 2: Multi-Year Cap Projections
// ────────────────────────────────────────────────────────────

export function computeCapProjection(
  tradeInfo: TradeInfo,
  team: Team
): CapProjectionResult | null {
  if (!team.totalCapAllocation) return null;

  const currentYear = new Date().getFullYear();
  const sentPlayers = filterDefined(tradeInfo.playersSent);
  const receivedPlayers = filterDefined(tradeInfo.playersReceived);

  // Build post-trade roster for salary tracking
  const sentIds = new Set(sentPlayers.map((p) => p.id));
  const currentRoster = (team.players || []).filter((p) => !sentIds.has(p.id));
  const postTradeRoster = [...currentRoster, ...receivedPlayers];

  // Post-trade total salary
  const postTradeSalary = team.totalCapAllocation + (tradeInfo.capDifference ?? 0);

  const years: CapProjectionYear[] = [];

  for (let offset = 0; offset < 3; offset++) {
    const year = currentYear + offset;
    const projectedCap = Math.round(CURRENT_SALARY_CAP * Math.pow(1 + CAP_GROWTH_RATE, offset));

    // Find players whose contracts expire before this season
    const expiringPlayers: { name: string; salary: number }[] = [];
    let salaryDropoff = 0;

    for (const player of postTradeRoster) {
      const yrsRemaining = player.contract?.yearsRemaining ?? 0;
      const salary = player.contract?.salary ?? 0;
      // Contract expires if yearsRemaining - offset <= 0 (but was active in previous year)
      if (offset > 0 && yrsRemaining > 0 && yrsRemaining <= offset) {
        // Only list players expiring THIS offseason (not previously expired)
        if (yrsRemaining === offset) {
          expiringPlayers.push({ name: player.displayName, salary });
        }
        salaryDropoff += salary;
      }
    }

    const projectedTeamSalary = Math.max(0, postTradeSalary - salaryDropoff);
    const projectedCapSpace = projectedCap - projectedTeamSalary;
    const hasMaxSlot = projectedCapSpace > projectedCap * 0.25;

    years.push({
      year,
      projectedCap,
      projectedTeamSalary,
      projectedCapSpace,
      expiringPlayers,
      hasMaxSlot,
    });
  }

  return { years };
}

// ────────────────────────────────────────────────────────────
// Feature 3: Trade Grades (A+ to F)
// ────────────────────────────────────────────────────────────

function scoreToGrade(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 83) return "A";
  if (score >= 76) return "A-";
  if (score >= 70) return "B+";
  if (score >= 63) return "B";
  if (score >= 56) return "B-";
  if (score >= 50) return "C+";
  if (score >= 43) return "C";
  if (score >= 36) return "C-";
  if (score >= 30) return "D+";
  if (score >= 23) return "D";
  if (score >= 16) return "D-";
  return "F";
}

function computeValueExchangeScore(tradeInfo: TradeInfo): number {
  const receivedPlayers = filterDefined(tradeInfo.playersReceived);
  const sentPlayers = filterDefined(tradeInfo.playersSent);

  const receivedPlayerValue = receivedPlayers.reduce(
    (s, p) => s + computePlayerRating(p).rating, 0
  );
  const sentPlayerValue = sentPlayers.reduce(
    (s, p) => s + computePlayerRating(p).rating, 0
  );

  const receivedPickValue = sumPickValue(tradeInfo.picksReceived);
  const sentPickValue = sumPickValue(tradeInfo.picksSent);

  const totalReceived = receivedPlayerValue + receivedPickValue;
  const totalSent = sentPlayerValue + sentPickValue;

  if (totalSent === 0 && totalReceived === 0) return 50;
  if (totalSent === 0) return 95;

  const ratio = totalReceived / totalSent;
  return Math.max(0, Math.min(100, Math.round(ratio * 50)));
}

function computeContractEfficiencyScore(tradeInfo: TradeInfo): number {
  const received = filterDefined(tradeInfo.playersReceived);
  if (received.length === 0) return 60; // Picks-only trade, neutral

  const tagScores: Record<ContractValueTag, number> = {
    "elite value": 100,
    "good value": 80,
    "fair": 55,
    "overpaid": 30,
    "negative": 10,
    "expiring": 60,
  };

  const scores = received.map((p) => {
    const rating = computePlayerRating(p).rating;
    const tag = computeContractValue(p, rating);
    return tagScores[tag];
  });

  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function computeTeamContextScore(tradeInfo: TradeInfo, phase: TeamPhase): number {
  const received = filterDefined(tradeInfo.playersReceived);
  const sent = filterDefined(tradeInfo.playersSent);
  const receivedPicks = tradeInfo.picksReceived ?? [];
  const sentPicks = tradeInfo.picksSent ?? [];

  let score = 50; // baseline

  if (phase === "contender") {
    // Reward getting high-rated players
    for (const p of received) {
      const r = computePlayerRating(p).rating;
      if (r >= 72) score += 15;
      else if (r >= 58) score += 8;
      if (p.age <= 30) score += 3;
    }
    // Penalize losing high-rated players
    for (const p of sent) {
      const r = computePlayerRating(p).rating;
      if (r >= 72) score -= 20;
      else if (r >= 58) score -= 10;
    }
    // Mild penalty for receiving picks (delayed value)
    score -= receivedPicks.length * 3;
    // Bonus for sending picks (converting future to now)
    score += sentPicks.length * 3;
  } else if (phase === "rebuilding") {
    // Reward receiving picks
    for (const pick of receivedPicks) {
      const round = pick.draftPick?.round ?? 2;
      score += round === 1 ? 15 : 8;
    }
    // Reward receiving young players
    for (const p of received) {
      if (p.age <= 23) score += 15;
      else if (p.age <= 25) score += 8;
      if (p.age >= 30) score -= 10;
    }
    // Bonus for shedding salary
    const outgoing = tradeInfo.outGoingSalary ?? 0;
    const incoming = tradeInfo.inComingSalary ?? 0;
    if (outgoing - incoming > 10_000_000) score += 10;
    // Penalty for sending picks
    for (const pick of sentPicks) {
      const round = pick.draftPick?.round ?? 2;
      score -= round === 1 ? 15 : 8;
    }
  } else {
    // Playoff / fringe — balanced
    for (const p of received) {
      const r = computePlayerRating(p).rating;
      if (r >= 72) score += 10;
      if (p.age <= 25) score += 5;
    }
    for (const p of sent) {
      const r = computePlayerRating(p).rating;
      if (r >= 72) score -= 12;
    }
    for (const pick of receivedPicks) {
      score += (pick.draftPick?.round ?? 2) === 1 ? 8 : 4;
    }
  }

  return Math.max(0, Math.min(100, score));
}

function computePositionalNeedScore(impact: TradeImpactResult): number {
  let score = 50;
  const groups: PositionalGroup[] = ["guards", "wings", "bigs"];

  // Find weakest and strongest groups before trade
  let weakest: PositionalGroup = "guards";
  let strongest: PositionalGroup = "guards";
  for (const g of groups) {
    if (impact.positionalImpact[g].before < impact.positionalImpact[weakest].before) weakest = g;
    if (impact.positionalImpact[g].before > impact.positionalImpact[strongest].before) strongest = g;
  }

  // Reward improving weakest group
  if (impact.positionalImpact[weakest].delta > 0) score += 30;
  else if (impact.positionalImpact[weakest].delta < -10) score -= 20;

  // Less reward for improving already-strong group
  if (impact.positionalImpact[strongest].delta > 0) score += 5;

  // Penalty for creating holes
  for (const g of groups) {
    if (impact.positionalImpact[g].delta < -20) score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}

function computeTimelineFitScore(tradeInfo: TradeInfo, phase: TeamPhase): number {
  const received = filterDefined(tradeInfo.playersReceived);
  if (received.length === 0) return 60; // Picks-only — generally timeline-neutral

  let score = 50;

  for (const p of received) {
    const yrs = p.contract?.yearsRemaining ?? 1;
    const age = p.age;

    if (phase === "contender") {
      // Want players ready now with 1-3 year contracts, age 25-31
      if (yrs >= 1 && yrs <= 3 && age >= 25 && age <= 31) score += 20;
      else if (yrs >= 1 && yrs <= 2 && age <= 24) score += 10; // young and cheap
      else if (age >= 33) score -= 8;
      else if (yrs >= 4 && age <= 23) score += 5; // ok but not ideal for win-now
    } else if (phase === "rebuilding") {
      // Want young players on long contracts
      if (age <= 24 && yrs >= 3) score += 20;
      else if (age <= 24 && yrs >= 2) score += 12;
      else if (age >= 30 && yrs <= 1) score -= 5; // expiring vet, low future value
      else if (age >= 30 && yrs >= 3) score -= 15; // locked into aging player
    } else {
      // Balanced
      if (age >= 24 && age <= 28 && yrs >= 2 && yrs <= 4) score += 15;
      else if (age <= 23 && yrs >= 3) score += 10;
      else if (age >= 33) score -= 8;
    }
  }

  return Math.max(0, Math.min(100, Math.round(score / received.length * received.length)));
}

type WeightSet = { value: number; contract: number; context: number; positional: number; timeline: number };

const PHASE_WEIGHTS: Record<TeamPhase, WeightSet> = {
  contender:  { value: 0.30, contract: 0.15, context: 0.25, positional: 0.15, timeline: 0.15 },
  playoff:    { value: 0.30, contract: 0.20, context: 0.15, positional: 0.20, timeline: 0.15 },
  fringe:     { value: 0.30, contract: 0.20, context: 0.15, positional: 0.20, timeline: 0.15 },
  rebuilding: { value: 0.25, contract: 0.10, context: 0.30, positional: 0.10, timeline: 0.25 },
};

function generateHeadline(
  grade: string,
  breakdown: TradeGradeResult["breakdown"],
  phase: TeamPhase
): string {
  const isGood = grade.startsWith("A") || grade.startsWith("B");
  const isBad = grade.startsWith("D") || grade === "F";

  // Find dominant sub-score
  const entries = Object.entries(breakdown) as [string, GradeBreakdownEntry][];
  const best = entries.reduce((a, b) => (a[1].score * a[1].weight > b[1].score * b[1].weight ? a : b));
  const worst = entries.reduce((a, b) => (a[1].score * a[1].weight < b[1].score * b[1].weight ? a : b));

  if (isGood) {
    if (best[0] === "positionalNeed") return "Fills a key roster gap";
    if (best[0] === "valueExchange") return "Great value return";
    if (best[0] === "teamContext" && phase === "rebuilding") return "Smart long-term play";
    if (best[0] === "teamContext" && phase === "contender") return "Strong win-now move";
    if (best[0] === "contractEfficiency") return "Acquiring team-friendly deals";
    if (best[0] === "timelineFit") return "Perfect window alignment";
    return "Solid trade overall";
  }

  if (isBad) {
    if (worst[0] === "valueExchange") return "Overpay for the return";
    if (worst[0] === "positionalNeed") return "Creates a roster hole";
    if (worst[0] === "teamContext" && phase === "contender") return "Doesn't fit the win-now window";
    if (worst[0] === "teamContext" && phase === "rebuilding") return "Sacrifices the future";
    if (worst[0] === "contractEfficiency") return "Taking on bad contracts";
    if (worst[0] === "timelineFit") return "Timeline mismatch";
    return "Questionable trade";
  }

  // C-range
  if (best[0] === "valueExchange") return "Fair swap, nothing flashy";
  if (best[0] === "teamContext") return "Mixed bag for the team direction";
  return "Reasonable but risky trade";
}

export function computeTradeGrade(
  tradeInfo: TradeInfo,
  allTradeInfos: TradeInfo[],
  team: Team,
  impactResult: TradeImpactResult
): TradeGradeResult {
  const phase = getTeamPhase(team);
  const weights = PHASE_WEIGHTS[phase];

  const valueScore = computeValueExchangeScore(tradeInfo);
  const contractScore = computeContractEfficiencyScore(tradeInfo);
  const contextScore = computeTeamContextScore(tradeInfo, phase);
  const positionalScore = computePositionalNeedScore(impactResult);
  const timelineScore = computeTimelineFitScore(tradeInfo, phase);

  const compositeScore = Math.round(
    valueScore * weights.value +
    contractScore * weights.contract +
    contextScore * weights.context +
    positionalScore * weights.positional +
    timelineScore * weights.timeline
  );

  const grade = scoreToGrade(compositeScore);

  const breakdown = {
    valueExchange: { score: valueScore, weight: weights.value, label: "Value" },
    contractEfficiency: { score: contractScore, weight: weights.contract, label: "Contracts" },
    teamContext: { score: contextScore, weight: weights.context, label: "Context" },
    positionalNeed: { score: positionalScore, weight: weights.positional, label: "Fit" },
    timelineFit: { score: timelineScore, weight: weights.timeline, label: "Timeline" },
  };

  const headline = generateHeadline(grade, breakdown, phase);

  return { grade, compositeScore, teamPhase: phase, breakdown, headline };
}
