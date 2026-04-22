/**
 * Post-generation salary refinement.
 *
 * After the AI generates a trade, we check each team's salary-matching
 * bounds. If any team is out of bounds, attempt to fix it by adding a
 * small filler player. Supports 2-team and multi-team (3/4+) trades.
 *
 * Multi-team routing is preserved: filler is added between teams that
 * already exchange assets (based on `receives.from`). The refiner only
 * ADDS filler players; it never removes the AI's chosen assets.
 */

import type { Player, Team } from "~/types";
import {
  computeMatchingBounds,
  getCapTier,
  MIN_SALARY_THRESHOLD,
  type CapTier,
} from "~/lib/server-utils";

/**
 * Tuned empirically against the eval harness.
 *
 * We tried MAX_ITERATIONS=2 / MAX_OUTGOING=3 but lost ~14pp of salary
 * validity to gain only ~12pp of "realism" — a bad trade. Real NBA
 * trades like Siakam-to-IND (6 assets) and Gobert-to-MIN (7 assets)
 * routinely hit these sizes.
 *
 * Multi-team trades use more iterations because fixing one team's
 * balance can cascade into another's (filler from A→B raises B's
 * incoming). A few extra passes let the fixed point settle.
 */
const MAX_ITERATIONS_2TEAM = 3;
const MAX_ITERATIONS_MULTI = 5;
const MAX_OUTGOING_PLAYERS_PER_TEAM = 4;

interface TeamState {
  teamName: string;
  hydrated: Team;
  capTier: CapTier;
  outgoingSalary: number;
  incomingSalary: number;
  bounds: { min: number; max: number } | null;
  valid: boolean;
  /** Signed delta: positive = over max, negative = under min, 0 = valid. */
  delta: number;
  /** Player objects currently in this team's `gives` (for filler exclusion). */
  outgoingPlayers: Player[];
}

export interface RefinementResult {
  trade: any;
  /** True if the trade was invalid and we successfully fixed it. */
  refined: boolean;
  /** True if the trade is salary-valid after refinement (or was already). */
  valid: boolean;
  /** Human-readable notes about what the refiner did. */
  notes: string[];
}

/** Normalize for name lookups. */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .trim();
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

function findPlayerOnTeam(team: Team, name: string): Player | null {
  const target = norm(name);
  return (
    ((team.players ?? []) as Player[]).find(
      (p) => norm(p.fullName) === target
    ) ?? null
  );
}

function computeTeamState(
  tt: any,
  hydrated: Team,
  allTeams: Team[]
): TeamState {
  let outgoingSalary = 0;
  const outgoingPlayers: Player[] = [];
  for (const p of tt.gives?.players ?? []) {
    const found = findPlayerOnTeam(hydrated, p.name);
    if (found) {
      outgoingSalary += found.contract?.salary ?? 0;
      outgoingPlayers.push(found);
    }
  }

  let incomingSalary = 0;
  const otherTeams = allTeams.filter((t) => t.id !== hydrated.id);
  for (const p of tt.receives?.players ?? []) {
    for (const other of otherTeams) {
      const found = findPlayerOnTeam(other, p.name);
      if (found) {
        incomingSalary += found.contract?.salary ?? 0;
        break;
      }
    }
  }

  const capTier = getCapTier(hydrated);
  const bounds = computeMatchingBounds(outgoingSalary, capTier);
  let valid = true;
  let delta = 0;
  if (capTier !== "UNDER_CAP" && bounds) {
    if (incomingSalary > bounds.max) {
      valid = false;
      delta = incomingSalary - bounds.max;
    } else if (outgoingSalary > 0 && incomingSalary < bounds.min) {
      valid = false;
      delta = incomingSalary - bounds.min; // negative
    }
  }

  return {
    teamName: tt.teamName,
    hydrated,
    capTier,
    outgoingSalary,
    incomingSalary,
    bounds,
    valid,
    delta,
    outgoingPlayers,
  };
}

/**
 * Pick a filler player from `team`'s roster that isn't already involved in
 * the trade. Prefer a single player near `targetSalary` without overshooting
 * by more than 20%.
 */
function pickFiller(
  team: Team,
  targetSalary: number,
  excludeIds: Set<number>,
  capTier: CapTier
): Player | null {
  const candidates = ((team.players ?? []) as Player[]).filter(
    (p) =>
      !excludeIds.has(p.id) &&
      (p.contract?.salary ?? 0) >= MIN_SALARY_THRESHOLD
  );
  if (candidates.length === 0) return null;

  if (capTier === "SECOND_APRON") {
    // Closest-to-target single player
    let best: Player | null = null;
    let bestDiff = Infinity;
    for (const p of candidates) {
      const sal = p.contract?.salary ?? 0;
      const diff = Math.abs(sal - targetSalary);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = p;
      }
    }
    return best;
  }

  // Prefer smallest player whose salary covers the target without >120% overshoot
  const maxAccept = targetSalary * 1.2;
  let bestCover: Player | null = null;
  let bestCoverDiff = Infinity;
  for (const p of candidates) {
    const sal = p.contract?.salary ?? 0;
    if (sal >= targetSalary && sal <= maxAccept) {
      const diff = sal - targetSalary;
      if (diff < bestCoverDiff) {
        bestCoverDiff = diff;
        bestCover = p;
      }
    }
  }
  if (bestCover) return bestCover;

  // Fall back to the largest-under-target player (partial fix better than none)
  const sorted = [...candidates].sort(
    (a, b) => (b.contract?.salary ?? 0) - (a.contract?.salary ?? 0)
  );
  for (const p of sorted) {
    const sal = p.contract?.salary ?? 0;
    if (sal <= targetSalary) return p;
  }
  return sorted[0] ?? null;
}

/**
 * Add a player to a team's `gives.players` and the counterparty's
 * `receives.players`. Mutates the trade in place.
 */
function addFillerToTrade(
  trade: any,
  fromTeamName: string,
  toTeamName: string,
  player: Player
): void {
  const fromTT = trade.teams.find((t: any) => t.teamName === fromTeamName);
  const toTT = trade.teams.find((t: any) => t.teamName === toTeamName);
  if (!fromTT || !toTT) return;

  fromTT.gives ??= { players: [], picks: [] };
  fromTT.gives.players ??= [];
  fromTT.gives.players.push({
    name: player.fullName,
    type: "player",
  });

  toTT.receives ??= { players: [], picks: [] };
  toTT.receives.players ??= [];
  toTT.receives.players.push({
    name: player.fullName,
    type: "player",
    from: fromTeamName,
  });
}

/**
 * Return team names that currently send an asset to `teamName`
 * (based on `receives.from` entries on teamName's receives).
 */
function sendersTo(trade: any, teamName: string): Set<string> {
  const senders = new Set<string>();
  const tt = trade.teams.find((t: any) => t.teamName === teamName);
  if (!tt) return senders;
  for (const p of tt.receives?.players ?? []) {
    if (p.from) senders.add(p.from);
  }
  for (const pk of tt.receives?.picks ?? []) {
    if (pk.from) senders.add(pk.from);
  }
  return senders;
}

/** Return team names that receive from `teamName`. */
function destinationsFrom(trade: any, teamName: string): Set<string> {
  const dests = new Set<string>();
  const target = norm(teamName);
  for (const tt of trade.teams) {
    if (tt.teamName === teamName) continue;
    for (const p of tt.receives?.players ?? []) {
      if (p.from && norm(p.from) === target) dests.add(tt.teamName);
    }
    for (const pk of tt.receives?.picks ?? []) {
      if (pk.from && norm(pk.from) === target) dests.add(tt.teamName);
    }
  }
  return dests;
}

/**
 * Main entry point. Returns the (possibly refined) trade with a flag.
 */
export function refineTradeSalary(
  trade: any,
  involvedTeams: Team[]
): RefinementResult {
  const notes: string[] = [];

  if (!trade?.teams || !Array.isArray(trade.teams)) {
    return { trade, refined: false, valid: false, notes };
  }
  if (trade.teams.length < 2) {
    return { trade, refined: false, valid: false, notes: ["skip: <2 teams"] };
  }

  // Hydrate all teams up front
  const hydratedByName = new Map<string, Team>();
  for (const tt of trade.teams) {
    const h = findTeamByName(involvedTeams, tt.teamName);
    if (!h) {
      return {
        trade,
        refined: false,
        valid: false,
        notes: [`skip: team lookup failed for ${tt.teamName}`],
      };
    }
    hydratedByName.set(tt.teamName, h);
  }
  const allHydrated = Array.from(hydratedByName.values());
  const maxIterations =
    trade.teams.length === 2 ? MAX_ITERATIONS_2TEAM : MAX_ITERATIONS_MULTI;

  let anyChange = false;

  const recomputeAll = (): TeamState[] =>
    trade.teams.map((tt: any) =>
      computeTeamState(tt, hydratedByName.get(tt.teamName)!, allHydrated)
    );

  for (let iter = 0; iter < maxIterations; iter++) {
    const states = recomputeAll();

    if (states.every((s) => s.valid)) {
      return {
        trade,
        refined: anyChange,
        valid: true,
        notes: anyChange
          ? [...notes, `fixed in ${iter} iteration(s)`]
          : notes,
      };
    }

    // Work on the largest offender first.
    const invalid = [...states]
      .filter((s) => !s.valid)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const worst = invalid[0]!;

    // Build exclusion set from ALL teams' current outgoing players.
    const excludeIds = new Set<number>();
    for (const s of states) {
      for (const p of s.outgoingPlayers) excludeIds.add(p.id);
    }

    let fromName: string | null = null;
    let toName: string | null = null;

    if (worst.delta > 0) {
      // Worst received too much → worst sends more (widens its max bound).
      // Route filler to a team worst already sends to; prefer UNDER_CAP
      // or the destination with the most headroom to absorb more incoming.
      const destNames = destinationsFrom(trade, worst.teamName);
      const candidates = states.filter((s) => destNames.has(s.teamName));
      if (candidates.length === 0) {
        notes.push(`abort: no destination from ${worst.teamName}`);
        break;
      }
      candidates.sort((a, b) => {
        const aUnder = a.capTier === "UNDER_CAP" ? 0 : 1;
        const bUnder = b.capTier === "UNDER_CAP" ? 0 : 1;
        if (aUnder !== bUnder) return aUnder - bUnder;
        // Lower delta = more headroom to absorb additional incoming
        return a.delta - b.delta;
      });
      const dest = candidates[0]!;
      fromName = worst.teamName;
      toName = dest.teamName;
    } else {
      // Worst received too little → a sender to worst adds filler.
      const senderNames = sendersTo(trade, worst.teamName);
      const candidates = states.filter((s) => senderNames.has(s.teamName));
      if (candidates.length === 0) {
        notes.push(`abort: no sender to ${worst.teamName}`);
        break;
      }
      // Prefer sender that's still valid and has fewest outgoing so far.
      candidates.sort((a, b) => {
        const aValid = a.valid ? 0 : 1;
        const bValid = b.valid ? 0 : 1;
        if (aValid !== bValid) return aValid - bValid;
        return a.outgoingPlayers.length - b.outgoingPlayers.length;
      });
      const sender = candidates[0]!;
      fromName = sender.teamName;
      toName = worst.teamName;
    }

    const fromState = states.find((s) => s.teamName === fromName)!;
    if (fromState.outgoingPlayers.length >= MAX_OUTGOING_PLAYERS_PER_TEAM) {
      notes.push(`abort: ${fromName} at max outgoing players`);
      break;
    }

    const fromHydrated = hydratedByName.get(fromName)!;
    const target = Math.abs(worst.delta);
    const capTier = getCapTier(fromHydrated);
    const filler = pickFiller(fromHydrated, target, excludeIds, capTier);
    if (!filler) {
      notes.push(
        `abort: no filler on ${fromName} covering ~$${(target / 1e6).toFixed(1)}M`
      );
      break;
    }

    addFillerToTrade(trade, fromName, toName, filler);
    notes.push(
      `added ${filler.fullName} ($${((filler.contract?.salary ?? 0) / 1e6).toFixed(1)}M) from ${fromName} to ${toName}`
    );
    anyChange = true;
  }

  const finalStates = recomputeAll();
  const valid = finalStates.every((s) => s.valid);
  return {
    trade,
    refined: anyChange,
    valid,
    notes: valid
      ? [...notes, "final: valid"]
      : [...notes, "final: still invalid"],
  };
}
