/**
 * Dynamic scenario builders for the trade quality eval harness.
 *
 * Instead of hardcoding player names, each archetype queries the live DB
 * and selects real teams/players that match its criteria. This means:
 *   - Scenarios stay realistic as rosters change (no manual maintenance)
 *   - The eval always tests the current state of the game
 *   - Results across runs stay comparable because selection is deterministic
 *     (sort by a stable key, take top-N)
 *
 * Each archetype returns either a fully-resolved scenario or a skip with
 * a reason (e.g. "no rebuilding team has a Superstar right now").
 */

import type { DraftPick, Player, SelectedAsset, Team } from "~/types";
import {
  computePlayerRating,
  computeContractValue,
  getCapTier,
  type CapTier,
} from "~/lib/server-utils";
import {
  getNBATeams,
  getNBATeamWithRosterAndDraftPicks,
} from "~/actions/nbaTeams";

export type EvalCategory =
  | "2-team-star"
  | "2-team-role"
  | "3-team"
  | "4plus-team"
  | "salary-dump"
  | "expiring"
  | "young-swap"
  | "pick-driven";

export interface ResolvedScenario {
  scenarioId: string;
  label: string;
  category: EvalCategory;
  selectedAssets: SelectedAsset[];
  /** Fully-hydrated primary teams (assets come from these). */
  teams: Team[];
  /** Additional-team shells passed to the generator as trade partners. */
  additionalTeams: Team[];
}

export interface ScenarioSkip {
  scenarioId: string;
  skipped: true;
  reason: string;
}

export type ScenarioResult = ResolvedScenario | ScenarioSkip;

interface BuilderContext {
  /** All teams, fully hydrated with roster + picks. */
  allTeams: Team[];
  /**
   * Which ranked candidate to pick. 0 = top pick, 1 = 2nd best, etc.
   * Archetypes use this to emit multiple variants of themselves so the
   * eval has better sample size without duplicating code.
   */
  rank: number;
}

interface Archetype {
  id: string;
  label: string;
  category: EvalCategory;
  build(ctx: BuilderContext): ScenarioResult;
}

/**
 * Register an archetype with a specific rank. The scenarioId gets "-rN"
 * appended for rank > 0 so each variant is distinct in the output.
 */
interface ArchetypeVariant {
  archetype: Archetype;
  rank: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function teamWinPct(team: Team): number {
  const r: any = (team as any).record;
  if (!r) return 0.5;
  if (typeof r === "string") {
    const [w, l] = r.split("-").map(Number);
    return (w ?? 0) / Math.max(1, (w ?? 0) + (l ?? 0));
  }
  if (typeof r.winPercentage === "number") return r.winPercentage;
  const w = r.wins ?? 0;
  const l = r.losses ?? 0;
  return w / Math.max(1, w + l);
}

function isContender(team: Team): boolean {
  return teamWinPct(team) >= 0.6;
}

function isRebuilding(team: Team): boolean {
  return teamWinPct(team) < 0.4;
}

function isMidTier(team: Team): boolean {
  const p = teamWinPct(team);
  return p >= 0.4 && p < 0.6;
}

function hasCapSpace(team: Team): boolean {
  return getCapTier(team) === "UNDER_CAP";
}

function capTierOf(team: Team): CapTier {
  return getCapTier(team);
}

/** Stable sort: highest rating first, tiebreak by player id for determinism. */
function ratedPlayers(team: Team): { player: Player; rating: number }[] {
  const players = (team.players ?? []) as Player[];
  const withRating = players.map((p) => ({
    player: p,
    rating: computePlayerRating(p).rating,
  }));
  withRating.sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    return a.player.id - b.player.id;
  });
  return withRating;
}

/** Top-rated player on a team (stable choice). */
function topPlayer(team: Team): { player: Player; rating: number } | null {
  return ratedPlayers(team)[0] ?? null;
}

/** All players meeting a predicate, sorted best-first. */
function playersWhere(
  team: Team,
  fn: (p: Player, rating: number) => boolean
): { player: Player; rating: number }[] {
  return ratedPlayers(team).filter((x) => fn(x.player, x.rating));
}

/** Best first-round pick on a team, preferring soonest year and best value. */
function bestFirstRoundPick(team: Team): DraftPick | null {
  const picks = ((team.draftPicks ?? []) as DraftPick[]).filter(
    (p) => p.round === 1
  );
  if (picks.length === 0) return null;
  picks.sort((a, b) => {
    // Prefer higher estimated value, then earlier year, then lower id
    const va = a.estimatedValue ?? 0;
    const vb = b.estimatedValue ?? 0;
    if (vb !== va) return vb - va;
    if (a.year !== b.year) return a.year - b.year;
    return a.id - b.id;
  });
  return picks[0] ?? null;
}

function skip(id: string, reason: string): ScenarioSkip {
  return { scenarioId: id, skipped: true, reason };
}

// ---------------------------------------------------------------------------
// Archetypes
// ---------------------------------------------------------------------------

/**
 * Superstar on a rebuilding team → contender.
 * Classic star-trade scenario where the seller wants picks + youth back.
 */
const starRebuilderToContender: Archetype = {
  id: "star-rebuilder-to-contender",
  label: "Star on rebuilder traded to contender",
  category: "2-team-star",
  build(ctx) {
    const rebuilders = ctx.allTeams.filter(isRebuilding);
    // For each rebuilder, find their best player with rating >= 75 (All-Star+)
    const candidates = rebuilders
      .map((t) => ({ team: t, top: topPlayer(t) }))
      .filter((x): x is { team: Team; top: { player: Player; rating: number } } =>
        !!x.top && x.top.rating >= 75
      );
    // Sort by star rating desc, then team id for determinism
    candidates.sort(
      (a, b) => b.top.rating - a.top.rating || a.team.id - b.team.id
    );
    const seller = candidates[ctx.rank];
    if (!seller) return skip(this.id, `no rank-${ctx.rank} rebuilding team with player rated 75+`);

    const contenders = ctx.allTeams.filter(
      (t) => isContender(t) && t.id !== seller.team.id
    );
    contenders.sort((a, b) => teamWinPct(b) - teamWinPct(a) || a.id - b.id);
    const buyer = contenders[0];
    if (!buyer) return skip(this.id, "no contender available as buyer");

    return {
      scenarioId: this.id,
      label: `${seller.top.player.fullName} (${seller.team.abbreviation}) shopped to ${buyer.abbreviation}`,
      category: this.category,
      selectedAssets: [
        { id: seller.top.player.id, type: "player", teamId: seller.team.id },
      ],
      teams: [seller.team, buyer],
      additionalTeams: [],
    };
  },
};

/**
 * Contender shopping a starter for a younger piece — inverse direction.
 */
const contenderShopsVeteran: Archetype = {
  id: "contender-shops-veteran",
  label: "Contender trades a veteran for youth/picks",
  category: "2-team-star",
  build(ctx) {
    const contenders = ctx.allTeams.filter(isContender);
    // Find a contender whose best 30+ year-old player is rated 70-85.
    // Upper bound excludes untouchable superstars (Jokic, LeBron-tier) — no
    // real GM is shopping those.
    const candidates: { team: Team; top: { player: Player; rating: number } }[] = [];
    for (const t of contenders) {
      const vets = playersWhere(t, (p, r) => p.age >= 30 && r >= 70 && r <= 85);
      if (vets.length > 0) candidates.push({ team: t, top: vets[0]! });
    }
    candidates.sort(
      (a, b) => b.top.rating - a.top.rating || a.team.id - b.team.id
    );
    const seller = candidates[ctx.rank];
    if (!seller)
      return skip(this.id, `no rank-${ctx.rank} contender with 30+ year-old rated 70-85`);

    const rebuilders = ctx.allTeams.filter(
      (t) => isRebuilding(t) && t.id !== seller.team.id
    );
    rebuilders.sort((a, b) => teamWinPct(a) - teamWinPct(b) || a.id - b.id);
    const buyer = rebuilders[0];
    if (!buyer) return skip(this.id, "no rebuilder available as buyer");

    return {
      scenarioId: this.id,
      label: `${seller.team.abbreviation} shops ${seller.top.player.fullName} to ${buyer.abbreviation}`,
      category: this.category,
      selectedAssets: [
        { id: seller.top.player.id, type: "player", teamId: seller.team.id },
      ],
      teams: [seller.team, buyer],
      additionalTeams: [],
    };
  },
};

/**
 * Mid-tier role-player change-of-scenery swap.
 */
const roleSwap: Archetype = {
  id: "role-swap-midtier",
  label: "Mid-tier role-player swap",
  category: "2-team-role",
  build(ctx) {
    const mids = ctx.allTeams.filter(isMidTier);
    // Pick two different mid-tier teams; selected asset = each team's top rotation player
    mids.sort((a, b) => a.id - b.id);
    if (mids.length < 2) return skip(this.id, "need at least 2 mid-tier teams");

    const pickRotationPlayer = (team: Team) => {
      const rotation = playersWhere(team, (_, r) => r >= 55 && r <= 70);
      return rotation[0] ?? null;
    };

    const teamA = mids[ctx.rank];
    if (!teamA) return skip(this.id, `no rank-${ctx.rank} mid-tier team`);
    const rpA = pickRotationPlayer(teamA);
    if (!rpA)
      return skip(this.id, `${teamA.abbreviation} has no rotation player rated 55-70`);

    const teamB = mids.find((t) => t.id !== teamA.id);
    if (!teamB) return skip(this.id, "only one mid-tier team available");

    return {
      scenarioId: this.id,
      label: `${rpA.player.fullName} (${teamA.abbreviation}) ↔ ${teamB.abbreviation} swap`,
      category: this.category,
      selectedAssets: [
        { id: rpA.player.id, type: "player", teamId: teamA.id },
      ],
      teams: [teamA, teamB],
      additionalTeams: [],
    };
  },
};

/**
 * Salary dump: player with "negative" or "overpaid" contract tag moving to
 * teams with cap space. Tests the generator's ability to include picks as
 * sweetener and route filler correctly.
 */
const salaryDump: Archetype = {
  id: "salary-dump",
  label: "Salary dump of a bad contract",
  category: "salary-dump",
  build(ctx) {
    // Find the worst mid-player contract in the league. Rating cap excludes
    // franchise players whose contracts merely LOOK bad on paper (e.g. Curry
    // at $55M is "negative" by raw-dollar math but nobody is dumping him).
    // A real salary dump is a rotation/role player on a long deal.
    const candidates: { team: Team; player: Player; rating: number }[] = [];
    for (const team of ctx.allTeams) {
      for (const { player, rating } of ratedPlayers(team)) {
        const tag = computeContractValue(player, rating);
        const salary = player.contract?.salary ?? 0;
        if (
          (tag === "negative" || tag === "overpaid") &&
          salary >= 15_000_000 &&
          rating < 75 &&
          (player.contract?.yearsRemaining ?? 0) >= 2
        ) {
          candidates.push({ team, player, rating });
        }
      }
    }
    // Sort by salary desc (worst dumps first), then stable by id
    candidates.sort(
      (a, b) =>
        (b.player.contract?.salary ?? 0) - (a.player.contract?.salary ?? 0) ||
        a.player.id - b.player.id
    );
    const target = candidates[ctx.rank];
    if (!target) return skip(this.id, `no rank-${ctx.rank} sufficiently-bad contract`);

    // Two realistic absorbers: any team below the first apron (room to take
    // on salary without triggering hard-cap restrictions). More permissive
    // than under-cap-only since cap-space teams are rare mid-season.
    const canAbsorb = (t: Team) => {
      const tier = capTierOf(t);
      return tier === "UNDER_CAP" || tier === "OVER_CAP";
    };
    const capTeams = ctx.allTeams
      .filter((t) => canAbsorb(t) && t.id !== target.team.id)
      .sort(
        (a, b) =>
          (b.firstApronSpace ?? 0) - (a.firstApronSpace ?? 0) || a.id - b.id
      );
    if (capTeams.length < 2)
      return skip(this.id, "need 2 teams below the first apron to absorb");

    return {
      scenarioId: this.id,
      label: `${target.team.abbreviation} dumps ${target.player.fullName}`,
      category: this.category,
      selectedAssets: [
        { id: target.player.id, type: "player", teamId: target.team.id },
      ],
      teams: [target.team],
      additionalTeams: [capTeams[0]!, capTeams[1]!],
    };
  },
};

/**
 * Expiring veteran on a non-contender → contender trading future assets.
 */
const expiringForFuture: Archetype = {
  id: "expiring-for-future",
  label: "Expiring contract traded for future assets",
  category: "expiring",
  build(ctx) {
    const sellers = ctx.allTeams.filter((t) => !isContender(t));
    const candidates: { team: Team; player: Player; rating: number }[] = [];
    for (const team of sellers) {
      for (const { player, rating } of ratedPlayers(team)) {
        const yrs = player.contract?.yearsRemaining ?? 0;
        const salary = player.contract?.salary ?? 0;
        if (yrs <= 1 && rating >= 55 && salary >= 3_000_000) {
          candidates.push({ team, player, rating });
        }
      }
    }
    candidates.sort(
      (a, b) => b.rating - a.rating || a.player.id - b.player.id
    );
    const target = candidates[ctx.rank];
    if (!target)
      return skip(this.id, `no rank-${ctx.rank} expiring veteran (yrs<=1, rating>=55, $3M+)`);

    const buyer = ctx.allTeams
      .filter((t) => isContender(t) && t.id !== target.team.id)
      .sort((a, b) => teamWinPct(b) - teamWinPct(a) || a.id - b.id)[0];
    if (!buyer) return skip(this.id, "no contender buyer available");

    return {
      scenarioId: this.id,
      label: `${target.team.abbreviation} sends expiring ${target.player.fullName} to ${buyer.abbreviation}`,
      category: this.category,
      selectedAssets: [
        { id: target.player.id, type: "player", teamId: target.team.id },
      ],
      teams: [target.team, buyer],
      additionalTeams: [],
    };
  },
};

/**
 * Young-player change-of-scenery swap: both ≤24 years old, rated 55-72.
 */
const youngSwap: Archetype = {
  id: "young-swap",
  label: "Young-player change-of-scenery swap",
  category: "young-swap",
  build(ctx) {
    const picks: { team: Team; player: Player; rating: number }[] = [];
    for (const team of ctx.allTeams) {
      const youngRotation = playersWhere(
        team,
        (p, r) => p.age <= 24 && r >= 55 && r <= 72
      );
      if (youngRotation[0]) {
        picks.push({
          team,
          player: youngRotation[0].player,
          rating: youngRotation[0].rating,
        });
      }
    }
    // Sort by rating desc, then team id
    picks.sort((a, b) => b.rating - a.rating || a.team.id - b.team.id);
    if (picks.length < 2) return skip(this.id, "need 2 young rotation players");

    const a = picks[ctx.rank];
    if (!a) return skip(this.id, `no rank-${ctx.rank} young rotation player`);
    const b = picks.find((x) => x.team.id !== a.team.id);
    if (!b) return skip(this.id, "need two different teams for young swap");

    return {
      scenarioId: this.id,
      label: `${a.player.fullName} (${a.team.abbreviation}) ↔ ${b.team.abbreviation}`,
      category: this.category,
      selectedAssets: [{ id: a.player.id, type: "player", teamId: a.team.id }],
      teams: [a.team, b.team],
      additionalTeams: [],
    };
  },
};

/**
 * Pick-driven 2-team trade: best 1st-round pick moved for a rotation player.
 */
const pickDriven: Archetype = {
  id: "pick-driven",
  label: "Pick-driven 2-team trade",
  category: "pick-driven",
  build(ctx) {
    // Find the team with the most valuable owned 1st-rounder
    const withBestPick = ctx.allTeams
      .map((t) => ({ team: t, pick: bestFirstRoundPick(t) }))
      .filter((x): x is { team: Team; pick: DraftPick } => !!x.pick);
    withBestPick.sort(
      (a, b) =>
        (b.pick.estimatedValue ?? 0) - (a.pick.estimatedValue ?? 0) ||
        a.team.id - b.team.id
    );
    const seller = withBestPick[ctx.rank];
    if (!seller) return skip(this.id, `no rank-${ctx.rank} team with a 1st-round pick`);

    const buyer = ctx.allTeams
      .filter((t) => t.id !== seller.team.id && !isRebuilding(t))
      .sort((a, b) => teamWinPct(b) - teamWinPct(a) || a.id - b.id)[0];
    if (!buyer) return skip(this.id, "no viable non-rebuilder buyer");

    return {
      scenarioId: this.id,
      label: `${seller.team.abbreviation} ${seller.pick.year} R1 pick → ${buyer.abbreviation}`,
      category: this.category,
      selectedAssets: [
        { id: seller.pick.id, type: "pick", teamId: seller.team.id },
      ],
      teams: [seller.team, buyer],
      additionalTeams: [],
    };
  },
};

/**
 * 3-team star trade with a facilitator to absorb salary.
 */
const threeTeamStar: Archetype = {
  id: "3team-star-facilitator",
  label: "3-team star trade with a facilitator",
  category: "3-team",
  build(ctx) {
    // Reuse star-rebuilder-to-contender selection
    const base = starRebuilderToContender.build(ctx);
    if ("skipped" in base) return skip(this.id, `no star seller (${base.reason})`);

    const [seller, buyer] = base.teams;
    // Find an under-cap facilitator not already in the deal
    const facilitator = ctx.allTeams
      .filter(
        (t) =>
          hasCapSpace(t) && t.id !== seller!.id && t.id !== buyer!.id
      )
      .sort((a, b) => (b.capSpace ?? 0) - (a.capSpace ?? 0) || a.id - b.id)[0];
    if (!facilitator) return skip(this.id, "no under-cap facilitator available");

    return {
      scenarioId: this.id,
      label: `${base.label} (+ ${facilitator.abbreviation} facilitator)`,
      category: this.category,
      selectedAssets: base.selectedAssets,
      teams: base.teams,
      additionalTeams: [facilitator],
    };
  },
};

/**
 * 4-team deal: star trade + two facilitators with different cap situations.
 */
const fourTeamStar: Archetype = {
  id: "4team-star-two-facilitators",
  label: "4-team star trade with two facilitators",
  category: "4plus-team",
  build(ctx) {
    const base = starRebuilderToContender.build(ctx);
    if ("skipped" in base) return skip(this.id, `no star seller (${base.reason})`);

    const [seller, buyer] = base.teams;
    const remaining = ctx.allTeams.filter(
      (t) => t.id !== seller!.id && t.id !== buyer!.id
    );
    const facilitators: Team[] = [];
    // One under-cap team + one over-cap team for variety
    const underCap = remaining
      .filter(hasCapSpace)
      .sort((a, b) => (b.capSpace ?? 0) - (a.capSpace ?? 0) || a.id - b.id)[0];
    const overCap = remaining
      .filter((t) => capTierOf(t) === "OVER_CAP")
      .sort((a, b) => a.id - b.id)[0];
    if (underCap) facilitators.push(underCap);
    if (overCap && overCap.id !== underCap?.id) facilitators.push(overCap);
    if (facilitators.length < 2)
      return skip(this.id, "need 2 distinct facilitator teams");

    return {
      scenarioId: this.id,
      label: `${base.label} (+ ${facilitators.map((f) => f.abbreviation).join(", ")} facilitators)`,
      category: this.category,
      selectedAssets: base.selectedAssets,
      teams: base.teams,
      additionalTeams: facilitators,
    };
  },
};

/**
 * 5-team mega deal: two separate star-for-pick moves plus facilitators.
 */
const fiveTeamMega: Archetype = {
  id: "5team-mega",
  label: "5-team mega deal",
  category: "4plus-team",
  build(ctx) {
    // Two different star-rebuilders
    const rebuilders = ctx.allTeams.filter(isRebuilding);
    const sellers: { team: Team; player: Player; rating: number }[] = [];
    for (const t of rebuilders) {
      const top = topPlayer(t);
      if (top && top.rating >= 72) sellers.push({ team: t, ...top });
    }
    sellers.sort(
      (a, b) => b.rating - a.rating || a.team.id - b.team.id
    );
    if (sellers.length < 2)
      return skip(this.id, "need 2 rebuilders with stars rated 72+");

    const sellerA = sellers[ctx.rank];
    if (!sellerA) return skip(this.id, `no rank-${ctx.rank} rebuilder with star`);
    const sellerB = sellers.find((s) => s.team.id !== sellerA.team.id)!;
    if (!sellerB) return skip(this.id, "only one rebuilder with a star");

    // Two contender buyers, different from each other
    const contenders = ctx.allTeams
      .filter(
        (t) =>
          isContender(t) &&
          t.id !== sellerA.team.id &&
          t.id !== sellerB.team.id
      )
      .sort((a, b) => teamWinPct(b) - teamWinPct(a) || a.id - b.id);
    if (contenders.length < 2)
      return skip(this.id, "need 2 contender buyers");
    const buyerA = contenders[0]!;
    const buyerB = contenders[1]!;

    // One facilitator
    const used = new Set([sellerA.team.id, sellerB.team.id, buyerA.id, buyerB.id]);
    const facilitator = ctx.allTeams
      .filter((t) => hasCapSpace(t) && !used.has(t.id))
      .sort((a, b) => (b.capSpace ?? 0) - (a.capSpace ?? 0) || a.id - b.id)[0];
    if (!facilitator) return skip(this.id, "no facilitator available");

    return {
      scenarioId: this.id,
      label: `${sellerA.player.fullName} + ${sellerB.player.fullName} 5-team deal`,
      category: this.category,
      selectedAssets: [
        {
          id: sellerA.player.id,
          type: "player",
          teamId: sellerA.team.id,
        },
        {
          id: sellerB.player.id,
          type: "player",
          teamId: sellerB.team.id,
        },
      ],
      teams: [sellerA.team, sellerB.team, buyerA, buyerB],
      additionalTeams: [facilitator],
    };
  },
};

// (star-rebuilder-to-contender-alt removed — now handled by running
//  starRebuilderToContender at rank=1 in the registry.)

/**
 * Two-star swap between two similar-caliber teams. Tests value-balancing
 * when both sides give up a star.
 */
const twoStarSwap: Archetype = {
  id: "two-star-swap",
  label: "Two-star swap between similar teams",
  category: "2-team-star",
  build(ctx) {
    // Collect teams' top player if rating ≥ 78
    const candidates: { team: Team; player: Player; rating: number }[] = [];
    for (const t of ctx.allTeams) {
      const top = topPlayer(t);
      if (top && top.rating >= 78 && top.rating <= 90) {
        candidates.push({ team: t, ...top });
      }
    }
    candidates.sort(
      (a, b) => b.rating - a.rating || a.team.id - b.team.id
    );
    if (candidates.length < 2)
      return skip(this.id, "need 2 teams with a star rated 78-90");

    // Pair the rank-th star with another team whose star has a similar rating
    const a = candidates[ctx.rank];
    if (!a) return skip(this.id, `no rank-${ctx.rank} team with a star 78-90`);
    const partner = candidates
      .filter((c) => c.team.id !== a.team.id)
      .sort(
        (x, y) =>
          Math.abs(x.rating - a.rating) - Math.abs(y.rating - a.rating) ||
          x.team.id - y.team.id
      )[0];
    if (!partner) return skip(this.id, "no viable partner team");

    return {
      scenarioId: this.id,
      label: `${a.player.fullName} (${a.team.abbreviation}) ↔ ${partner.player.fullName} (${partner.team.abbreviation})`,
      category: this.category,
      selectedAssets: [
        { id: a.player.id, type: "player", teamId: a.team.id },
        {
          id: partner.player.id,
          type: "player",
          teamId: partner.team.id,
        },
      ],
      teams: [a.team, partner.team],
      additionalTeams: [],
    };
  },
};

/**
 * Second-apron team sheds salary: a mid-rated rotation player moves off a
 * second-apron roster to dodge luxury tax / hard-cap restrictions.
 */
const secondApronDump: Archetype = {
  id: "second-apron-dump",
  label: "Second-apron team sheds a mid-rated contract",
  category: "salary-dump",
  build(ctx) {
    const apronTeams = ctx.allTeams.filter(
      (t) => capTierOf(t) === "SECOND_APRON"
    );
    if (apronTeams.length === 0)
      return skip(this.id, "no teams currently in the second apron");

    const candidates: { team: Team; player: Player; rating: number }[] = [];
    for (const team of apronTeams) {
      for (const { player, rating } of ratedPlayers(team)) {
        const salary = player.contract?.salary ?? 0;
        const yrs = player.contract?.yearsRemaining ?? 0;
        if (rating >= 55 && rating <= 75 && salary >= 8_000_000 && yrs >= 1) {
          candidates.push({ team, player, rating });
        }
      }
    }
    candidates.sort(
      (a, b) =>
        (b.player.contract?.salary ?? 0) - (a.player.contract?.salary ?? 0) ||
        a.player.id - b.player.id
    );
    const target = candidates[ctx.rank];
    if (!target)
      return skip(this.id, `no rank-${ctx.rank} mid-rated contract on an apron team`);

    // Buyer: any team under the first apron
    const buyer = ctx.allTeams
      .filter(
        (t) =>
          t.id !== target.team.id &&
          (capTierOf(t) === "UNDER_CAP" || capTierOf(t) === "OVER_CAP")
      )
      .sort(
        (a, b) =>
          (b.firstApronSpace ?? 0) - (a.firstApronSpace ?? 0) || a.id - b.id
      )[0];
    if (!buyer) return skip(this.id, "no sub-apron absorber available");

    return {
      scenarioId: this.id,
      label: `${target.team.abbreviation} sheds ${target.player.fullName} → ${buyer.abbreviation}`,
      category: this.category,
      selectedAssets: [
        { id: target.player.id, type: "player", teamId: target.team.id },
      ],
      teams: [target.team, buyer],
      additionalTeams: [],
    };
  },
};

/**
 * Deadline rental: a contender buys an expiring mid-tier vet from a
 * non-contender for minimal future capital.
 */
const deadlineRental: Archetype = {
  id: "deadline-rental",
  label: "Contender rents an expiring mid-tier vet",
  category: "expiring",
  build(ctx) {
    const sellers = ctx.allTeams.filter((t) => !isContender(t));
    const candidates: { team: Team; player: Player; rating: number }[] = [];
    for (const team of sellers) {
      for (const { player, rating } of ratedPlayers(team)) {
        const yrs = player.contract?.yearsRemaining ?? 0;
        const salary = player.contract?.salary ?? 0;
        if (
          yrs <= 1 &&
          rating >= 55 &&
          rating <= 72 &&
          salary >= 5_000_000
        ) {
          candidates.push({ team, player, rating });
        }
      }
    }
    candidates.sort(
      (a, b) => b.rating - a.rating || a.player.id - b.player.id
    );
    const target = candidates[ctx.rank];
    if (!target) return skip(this.id, `no rank-${ctx.rank} mid-tier expiring rental`);

    const buyer = ctx.allTeams
      .filter((t) => isContender(t) && t.id !== target.team.id)
      .sort((a, b) => teamWinPct(b) - teamWinPct(a) || a.id - b.id)[1]; // #2 contender for variety
    if (!buyer) return skip(this.id, "no 2nd contender buyer available");

    return {
      scenarioId: this.id,
      label: `${buyer.abbreviation} rents ${target.player.fullName} from ${target.team.abbreviation}`,
      category: this.category,
      selectedAssets: [
        { id: target.player.id, type: "player", teamId: target.team.id },
      ],
      teams: [target.team, buyer],
      additionalTeams: [],
    };
  },
};

/**
 * Rebuilder acquires a young player from a contender who has a logjam.
 * Inverse direction of star-rebuilder: contender gives up youth for help.
 */
const rebuilderBuysYoung: Archetype = {
  id: "rebuilder-buys-young",
  label: "Rebuilder targets a young player on a contender",
  category: "2-team-role",
  build(ctx) {
    const contenders = ctx.allTeams.filter(isContender);
    // Find a contender's best young player (age ≤24, rating 60-75 — a
    // good prospect but not a franchise cornerstone)
    const candidates: { team: Team; player: Player; rating: number }[] = [];
    for (const t of contenders) {
      const young = playersWhere(
        t,
        (p, r) => p.age <= 24 && r >= 60 && r <= 75
      );
      if (young[0]) candidates.push({ team: t, ...young[0] });
    }
    candidates.sort(
      (a, b) => b.rating - a.rating || a.team.id - b.team.id
    );
    const target = candidates[ctx.rank];
    if (!target)
      return skip(this.id, `no rank-${ctx.rank} contender with a young 60-75 player`);

    // Buyer: worst-record rebuilder with picks
    const buyer = ctx.allTeams
      .filter((t) => isRebuilding(t) && t.id !== target.team.id)
      .sort((a, b) => teamWinPct(a) - teamWinPct(b) || a.id - b.id)[0];
    if (!buyer) return skip(this.id, "no rebuilder buyer available");

    return {
      scenarioId: this.id,
      label: `${buyer.abbreviation} targets ${target.player.fullName} from ${target.team.abbreviation}`,
      category: this.category,
      selectedAssets: [
        {
          id: target.player.id,
          type: "player",
          teamId: target.team.id,
          targetTeamId: buyer.id,
        },
      ],
      teams: [target.team, buyer],
      additionalTeams: [],
    };
  },
};

/**
 * Three-team pick-driven deal: a team with picks moves one to a contender
 * while looping in a third team as facilitator.
 */
const threeTeamPickDriven: Archetype = {
  id: "3team-pick-driven",
  label: "3-team deal anchored on a first-round pick",
  category: "3-team",
  build(ctx) {
    // Find a rebuilder with the best pick
    const rebuilders = ctx.allTeams.filter(isRebuilding);
    const withPicks = rebuilders
      .map((t) => ({ team: t, pick: bestFirstRoundPick(t) }))
      .filter((x): x is { team: Team; pick: DraftPick } => !!x.pick);
    withPicks.sort(
      (a, b) =>
        (b.pick.estimatedValue ?? 0) - (a.pick.estimatedValue ?? 0) ||
        a.team.id - b.team.id
    );
    const seller = withPicks[ctx.rank];
    if (!seller)
      return skip(this.id, `no rank-${ctx.rank} rebuilder with a first-round pick`);

    const contender = ctx.allTeams
      .filter((t) => isContender(t) && t.id !== seller.team.id)
      .sort((a, b) => teamWinPct(b) - teamWinPct(a) || a.id - b.id)[0];
    if (!contender) return skip(this.id, "no contender buyer available");

    const facilitator = ctx.allTeams
      .filter(
        (t) =>
          hasCapSpace(t) &&
          t.id !== seller.team.id &&
          t.id !== contender.id
      )
      .sort(
        (a, b) => (b.capSpace ?? 0) - (a.capSpace ?? 0) || a.id - b.id
      )[0];
    if (!facilitator) return skip(this.id, "no under-cap facilitator");

    return {
      scenarioId: this.id,
      label: `${seller.team.abbreviation} ${seller.pick.year} R1 + ${contender.abbreviation} + ${facilitator.abbreviation}`,
      category: this.category,
      selectedAssets: [
        { id: seller.pick.id, type: "pick", teamId: seller.team.id },
      ],
      teams: [seller.team, contender],
      additionalTeams: [facilitator],
    };
  },
};

// ---------------------------------------------------------------------------
// Registry + entry point
// ---------------------------------------------------------------------------

/**
 * Each archetype is registered with a list of ranks (0 = top candidate,
 * 1 = 2nd, 2 = 3rd). The runner emits one scenario per (archetype, rank)
 * pair, producing 3x–4x more data per eval run without duplicating logic.
 */
export const ARCHETYPE_VARIANTS: ArchetypeVariant[] = [
  // Core 2-team star trades — high signal, 3 variants each
  { archetype: starRebuilderToContender, rank: 0 },
  { archetype: starRebuilderToContender, rank: 1 },
  { archetype: starRebuilderToContender, rank: 2 },
  { archetype: twoStarSwap, rank: 0 },
  { archetype: twoStarSwap, rank: 1 },
  { archetype: twoStarSwap, rank: 2 },
  { archetype: contenderShopsVeteran, rank: 0 },
  { archetype: contenderShopsVeteran, rank: 1 },
  { archetype: contenderShopsVeteran, rank: 2 },

  // Other 2-team categories — 2 variants
  { archetype: roleSwap, rank: 0 },
  { archetype: roleSwap, rank: 1 },
  { archetype: youngSwap, rank: 0 },
  { archetype: youngSwap, rank: 1 },
  { archetype: youngSwap, rank: 2 },
  { archetype: pickDriven, rank: 0 },
  { archetype: pickDriven, rank: 1 },
  { archetype: pickDriven, rank: 2 },
  { archetype: rebuilderBuysYoung, rank: 0 },
  { archetype: rebuilderBuysYoung, rank: 1 },

  // Salary-dump / expiring — 2 variants each
  { archetype: salaryDump, rank: 0 },
  { archetype: salaryDump, rank: 1 },
  { archetype: secondApronDump, rank: 0 },
  { archetype: secondApronDump, rank: 1 },
  { archetype: expiringForFuture, rank: 0 },
  { archetype: expiringForFuture, rank: 1 },
  { archetype: deadlineRental, rank: 0 },
  { archetype: deadlineRental, rank: 1 },

  // Multi-team — 2 variants each (where the role classifier actually matters)
  { archetype: threeTeamStar, rank: 0 },
  { archetype: threeTeamStar, rank: 1 },
  { archetype: threeTeamPickDriven, rank: 0 },
  { archetype: threeTeamPickDriven, rank: 1 },
  { archetype: fourTeamStar, rank: 0 },
  { archetype: fourTeamStar, rank: 1 },
  { archetype: fiveTeamMega, rank: 0 },
  { archetype: fiveTeamMega, rank: 1 },
];

/** Unique scenario id = archetype id + "-r{rank}" when rank > 0. */
function variantScenarioId(variant: ArchetypeVariant): string {
  return variant.rank === 0
    ? variant.archetype.id
    : `${variant.archetype.id}-r${variant.rank}`;
}

/**
 * Hydrate every NBA team once, then run each archetype variant.
 * Variants that can't find matching criteria return a skip result.
 *
 * When `ids` is provided, matches against the full scenarioId
 * (e.g. "star-rebuilder-to-contender-r1") OR the bare archetype id
 * (runs all variants of that archetype).
 */
export async function buildAllScenarios(
  ids?: string[]
): Promise<ScenarioResult[]> {
  const baseTeams = (await getNBATeams()) as unknown as Team[];
  // Hydrate fully (rosters + picks) — one DB round per team
  const hydrated = await Promise.all(
    baseTeams.map((t) =>
      getNBATeamWithRosterAndDraftPicks(t.id) as Promise<Team | null>
    )
  );
  const allTeams = hydrated.filter((t): t is Team => !!t);

  const selected = ids?.length
    ? ARCHETYPE_VARIANTS.filter((v) => {
        const sid = variantScenarioId(v);
        return ids.includes(sid) || ids.includes(v.archetype.id);
      })
    : ARCHETYPE_VARIANTS;

  return selected.map((v) => {
    const scenarioId = variantScenarioId(v);
    const ctx: BuilderContext = { allTeams, rank: v.rank };
    try {
      const result = v.archetype.build(ctx);
      // Override the scenarioId so rank > 0 variants are distinct
      if ("skipped" in result) {
        return { ...result, scenarioId };
      }
      return { ...result, scenarioId };
    } catch (err) {
      return skip(
        scenarioId,
        `builder threw: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  });
}
