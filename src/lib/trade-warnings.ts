/**
 * Shared trade-warning collection.
 *
 * Both the AI-generated trade view (`trade-card.tsx`) and the user-built Try
 * Trade preview (`try-trade-preview.tsx`) need to surface the same set of
 * issues when a proposal violates league rules or just looks lopsided. This
 * module centralizes that logic so the two views can stay in sync and so we
 * can collect *all* applicable warnings instead of stopping at the first one.
 *
 * Pure functions — safe to import from client components.
 */

import type { DraftPick, Player, Team } from "~/types";
import { getOwnStepienBlockedYears, isOwnPick } from "./stepien";

export type WarningSeverity = "blocker" | "soft";

export type TradeWarning = {
  severity: WarningSeverity;
  message: string;
};

/**
 * Per-team view of a proposed trade. Each side gives some assets, receives
 * others, and ends up with a `capDifference` (incoming minus outgoing
 * salary). Both view layers normalize their data into this shape before
 * calling `collectTradeWarnings`.
 */
export type TeamTradeMove = {
  team: Team;
  playersSent: Player[];
  picksSent: DraftPick[];
  playersReceived: Player[];
  picksReceived: DraftPick[];
  outgoingSalary: number;
  incomingSalary: number;
  capDifference: number;
};

const STANDARD_ROSTER_LIMIT = 15;
const ROSTER_IMBALANCE_THRESHOLD = 2;

/**
 * Run every warning check against the proposed trade and return the full set,
 * ordered blockers-first then soft warnings. Empty array means the trade is
 * clean — show the green verdict.
 */
export function collectTradeWarnings(moves: TeamTradeMove[]): TradeWarning[] {
  const warnings: TradeWarning[] = [];
  for (const move of moves) {
    warnings.push(...checkCapRules(move));
    warnings.push(...checkStepien(move));
    warnings.push(...checkRosterImbalance(move));
    warnings.push(...checkRosterOverflow(move));
  }
  // Blockers first so the verdict reads top-down.
  return warnings.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "blocker" ? -1 : 1
  );
}

/**
 * Cap-rule violations: 2nd apron strict, 1st apron 110%, over cap 125%.
 * Equivalent to the existing in-component validators but returns all
 * applicable issues at once rather than stopping at the first.
 */
function checkCapRules(move: TeamTradeMove): TradeWarning[] {
  const { team, capDifference, outgoingSalary, incomingSalary } = move;
  if (outgoingSalary === 0 && incomingSalary === 0) return [];

  const secondApronSpace = team.secondApronSpace || 0;
  const firstApronSpace = team.firstApronSpace || 0;
  const capSpace = team.capSpace || 0;

  // Second apron: cannot take on any new salary if already over or would cross.
  const postTradeSecondApron = secondApronSpace - capDifference;
  const isOverSecondApron = secondApronSpace < 0;
  const wouldCrossSecondApron =
    secondApronSpace >= 0 && postTradeSecondApron < 0;

  if ((isOverSecondApron || wouldCrossSecondApron) && capDifference > 0) {
    const excess = (capDifference / 1_000_000).toFixed(1);
    return [
      {
        severity: "blocker",
        message: `${team.displayName} (2nd apron): must send $${excess}M more or receive $${excess}M less.`,
      },
    ];
  }

  // First apron: 110% + $100K match required.
  const postTradeFirstApron = firstApronSpace - capDifference;
  const isOverFirstApron = firstApronSpace < 0;
  const wouldCrossFirstApron =
    firstApronSpace >= 0 && postTradeFirstApron < 0;
  const maxAllowedFirstApron = outgoingSalary * 1.1 + 100_000;

  if (
    (isOverFirstApron || wouldCrossFirstApron) &&
    incomingSalary > maxAllowedFirstApron
  ) {
    const excess = ((incomingSalary - maxAllowedFirstApron) / 1_000_000).toFixed(1);
    const cap = (maxAllowedFirstApron / 1_000_000).toFixed(1);
    return [
      {
        severity: "blocker",
        message: `${team.displayName} (1st apron): incoming exceeds limit by $${excess}M — need $${cap}M max.`,
      },
    ];
  }

  // Over cap but under aprons: 125% + $100K match required.
  if (capSpace < 0 && firstApronSpace >= 0) {
    const maxAllowedOverCap = outgoingSalary * 1.25 + 100_000;
    if (incomingSalary > maxAllowedOverCap) {
      const excess = ((incomingSalary - maxAllowedOverCap) / 1_000_000).toFixed(1);
      const cap = (maxAllowedOverCap / 1_000_000).toFixed(1);
      return [
        {
          severity: "blocker",
          message: `${team.displayName} (over cap): incoming exceeds limit by $${excess}M — need $${cap}M max.`,
        },
      ];
    }
  }

  return [];
}

/**
 * Stepien rule: a team can't trade its own R1 in a year it's already
 * committed an adjacent R1 elsewhere. Acquired R1s aren't affected — only
 * picks the team still owns.
 */
function checkStepien(move: TeamTradeMove): TradeWarning[] {
  const { team, picksSent } = move;
  const ownR1sBeingSent = picksSent.filter(
    (p) => p.round === 1 && isOwnPick(p)
  );
  if (ownR1sBeingSent.length === 0) return [];

  const blockedYears = getOwnStepienBlockedYears(team);
  const violatingYears = ownR1sBeingSent
    .map((p) => p.year)
    .filter((y) => blockedYears.has(y));

  if (violatingYears.length === 0) return [];

  const yearList = violatingYears.sort((a, b) => a - b).join(", ");
  return [
    {
      severity: "blocker",
      message: `${team.displayName} can't trade their own ${yearList} R1 — would create consecutive future R1s (Stepien).`,
    },
  ];
}

/**
 * Roster imbalance: one team sending considerably more bodies than they
 * receive (or vice versa) usually means the trade is missing role-player
 * filler. Soft warning — doesn't block, just nudges.
 */
function checkRosterImbalance(move: TeamTradeMove): TradeWarning[] {
  const { team, playersSent, playersReceived } = move;
  if (playersSent.length === 0 && playersReceived.length === 0) return [];

  const delta = playersSent.length - playersReceived.length;
  if (Math.abs(delta) < ROSTER_IMBALANCE_THRESHOLD) return [];

  if (delta > 0) {
    return [
      {
        severity: "soft",
        message: `${team.displayName} send ${playersSent.length} players, receive ${playersReceived.length} — lopsided body count.`,
      },
    ];
  }
  return [
    {
      severity: "soft",
      message: `${team.displayName} receive ${playersReceived.length} players, send ${playersSent.length} — lopsided body count.`,
    },
  ];
}

/**
 * NBA standard-roster cap is 15 players. Our seed data can include two-way
 * contracts in `team.players`, so many teams sit above 15 in the DB even
 * without a trade. We only warn when the trade itself *adds* bodies above
 * the limit — a 1-for-1 swap on a team that was already at 17 stays quiet,
 * but adding net +1 to a full roster still surfaces.
 */
function checkRosterOverflow(move: TeamTradeMove): TradeWarning[] {
  const { team, playersSent, playersReceived } = move;
  const currentSize = team.players?.length || 0;
  const postTradeSize = currentSize - playersSent.length + playersReceived.length;
  if (postTradeSize <= STANDARD_ROSTER_LIMIT) return [];
  if (postTradeSize <= currentSize) return [];

  const overflow = postTradeSize - STANDARD_ROSTER_LIMIT;
  return [
    {
      severity: "soft",
      message: `${team.displayName} roster would hold ${postTradeSize} players — ${overflow} over the 15-man standard limit.`,
    },
  ];
}

/**
 * Editorial one-liner ("subdeck") that sits under the scenario eyebrow on
 * the result view. Picks the most newsworthy delta from the trade and
 * states it tightly. Never references AI — derived purely from cap math.
 *
 * Priority ladder:
 *   1. Apron crossing (above or below — both 1st and 2nd)
 *   2. Significant cap relief / additional load (>= $5M)
 *   3. Multi-team or two-team fallback expressing total contract value moved
 */
export function computeSubdeck(moves: TeamTradeMove[]): string {
  // Priority 1: apron crossings, scanned in severity order (2nd > 1st).
  for (const move of moves) {
    const before2 = move.team.secondApronSpace || 0;
    const after2 = before2 - move.capDifference;
    if (before2 < 0 && after2 >= 0) {
      return `${shortTeamName(move.team)} slide back under the second apron.`;
    }
    if (before2 >= 0 && after2 < 0) {
      return `${shortTeamName(move.team)} cross into the second apron.`;
    }
  }
  for (const move of moves) {
    const before1 = move.team.firstApronSpace || 0;
    const after1 = before1 - move.capDifference;
    if (before1 < 0 && after1 >= 0) {
      return `${shortTeamName(move.team)} slide back under the first apron.`;
    }
    if (before1 >= 0 && after1 < 0) {
      return `${shortTeamName(move.team)} cross into the first apron.`;
    }
  }

  // Priority 2: biggest cap delta of >= $5M.
  const sorted = [...moves].sort(
    (a, b) => Math.abs(b.capDifference) - Math.abs(a.capDifference)
  );
  const top = sorted[0];
  if (top && Math.abs(top.capDifference) >= 5_000_000) {
    const amount = (Math.abs(top.capDifference) / 1_000_000).toFixed(1);
    if (top.capDifference < 0) {
      return `${shortTeamName(top.team)} free up $${amount}M against the cap.`;
    }
    return `${shortTeamName(top.team)} take on $${amount}M in incoming salary.`;
  }

  // Priority 3: fall back to the volume of contracts in motion.
  const totalMoved = moves.reduce((acc, m) => acc + m.outgoingSalary, 0);
  const totalMillions = (totalMoved / 1_000_000).toFixed(0);
  if (moves.length >= 3) {
    return `${moves.length}-team swap moves $${totalMillions}M of contracts.`;
  }
  return `Two-team deal worth $${totalMillions}M in moving contracts.`;
}

function shortTeamName(team: Team): string {
  // Prefer the short "Warriors" form over "Golden State Warriors" for tight
  // subdeck copy. ESPN-style data exposes `name` (mascot) and `displayName`
  // (full); fall back to displayName if `name` is missing.
  const maybeName = (team as { name?: string }).name;
  return maybeName && maybeName.length > 0 ? maybeName : team.displayName;
}
