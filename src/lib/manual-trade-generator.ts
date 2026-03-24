import type {
  DraftPick,
  Player,
  SelectedAsset,
  Team,
  TradeScenario,
  TeamInTradeScenario,
  TradeAssetInScenario,
} from "~/types";
import {
  getCapTier,
  computeMatchingBounds,
  MIN_SALARY_THRESHOLD,
} from "./server-utils";
import type { CapTier } from "./server-utils";

type TeamMovement = {
  teamId: number;
  team: any;
  outgoing: { asset: SelectedAsset; player?: Player; pick?: DraftPick }[];
  incoming: { asset: SelectedAsset; player?: Player; pick?: DraftPick }[];
  fillerOutgoing: Player[];
};

/**
 * Generate a single algorithmically-matched trade from the selected assets.
 * Returns null if no valid salary match can be constructed.
 */
export function generateManualTrade(
  selectedAssets: SelectedAsset[],
  involvedTeams: Team[]
): TradeScenario | null {
  // Group assets by team
  const teamMap = new Map<number, TeamMovement>();

  for (const team of involvedTeams) {
    teamMap.set(team.id, {
      teamId: team.id,
      team,
      outgoing: [],
      incoming: [],
      fillerOutgoing: [],
    });
  }

  // Populate outgoing assets for each team
  for (const asset of selectedAssets) {
    const movement = teamMap.get(asset.teamId);
    if (!movement) continue;

    if (asset.type === "player") {
      const player = movement.team.players?.find(
        (p: Player) => p.id === asset.id
      );
      if (player) {
        movement.outgoing.push({ asset, player });
      }
    } else {
      const pick = movement.team.draftPicks?.find(
        (p: DraftPick) => p.id === asset.id
      );
      if (pick) {
        movement.outgoing.push({ asset, pick });
      }
    }
  }

  const teamIds = Array.from(teamMap.keys());

  // Route assets to destinations
  if (teamIds.length === 2) {
    // Simple 2-team swap: everything from A goes to B and vice versa
    const [teamAId, teamBId] = teamIds;
    const teamA = teamMap.get(teamAId!)!;
    const teamB = teamMap.get(teamBId!)!;

    for (const out of teamA.outgoing) {
      // Honor targetTeamId if set, otherwise send to the other team
      const dest =
        out.asset.targetTeamId && teamMap.has(out.asset.targetTeamId)
          ? out.asset.targetTeamId
          : teamBId!;
      teamMap.get(dest)!.incoming.push(out);
    }
    for (const out of teamB.outgoing) {
      const dest =
        out.asset.targetTeamId && teamMap.has(out.asset.targetTeamId)
          ? out.asset.targetTeamId
          : teamAId!;
      teamMap.get(dest)!.incoming.push(out);
    }
  } else {
    // Multi-team: honor targetTeamId, then use salary-fit for unrouted
    const routed: Set<string> = new Set();
    const unrouted: { fromTeamId: number; item: TeamMovement["outgoing"][0] }[] = [];

    // First pass: route assets with explicit destinations
    for (const [teamId, movement] of teamMap) {
      for (const out of movement.outgoing) {
        if (out.asset.targetTeamId && teamMap.has(out.asset.targetTeamId)) {
          teamMap.get(out.asset.targetTeamId)!.incoming.push(out);
          routed.add(`${teamId}-${out.asset.id}-${out.asset.type}`);
        } else {
          unrouted.push({ fromTeamId: teamId, item: out });
        }
      }
    }

    // Second pass: route remaining by best salary fit
    for (const { fromTeamId, item } of unrouted) {
      const salary = item.player?.contract?.salary ?? 0;
      let bestTeamId: number | null = null;
      let bestScore = -Infinity;

      for (const candidateId of teamIds) {
        if (candidateId === fromTeamId) continue;
        const candidate = teamMap.get(candidateId)!;

        // Score: how much this team needs incoming salary
        const currentOutSalary = computeTeamOutgoingSalary(candidate);
        const currentInSalary = computeTeamIncomingSalary(candidate);
        const gap = currentOutSalary - currentInSalary;
        // Prefer teams with larger positive gap (need more incoming)
        const score = gap - Math.abs(gap - salary);

        if (score > bestScore) {
          bestScore = score;
          bestTeamId = candidateId;
        }
      }

      if (bestTeamId !== null) {
        teamMap.get(bestTeamId)!.incoming.push(item);
      } else {
        // Fallback: send to first team that isn't the source
        const fallback = teamIds.find((id) => id !== fromTeamId);
        if (fallback) teamMap.get(fallback)!.incoming.push(item);
      }
    }
  }

  // Salary balancing with filler players (max 3 iterations)
  for (let iteration = 0; iteration < 3; iteration++) {
    let needsBalancing = false;

    for (const [, movement] of teamMap) {
      const capTier = getCapTier(movement.team);
      if (capTier === "UNDER_CAP") continue;

      const outSalary = computeTeamOutgoingSalary(movement);
      const inSalary = computeTeamIncomingSalary(movement);
      const bounds = computeMatchingBounds(outSalary, capTier);

      if (!bounds) continue;

      if (inSalary > bounds.max) {
        // Receiving too much — need to send more salary out
        const deficit = inSalary - bounds.max;
        const filler = findFillerPlayers(
          movement,
          deficit,
          capTier,
          selectedAssets,
          involvedTeams
        );

        if (filler.length > 0) {
          needsBalancing = true;
          movement.fillerOutgoing.push(...filler);

          // Route filler to team with largest salary deficit
          const targetTeamId = findLargestDeficitTeam(
            teamMap,
            movement.teamId
          );
          if (targetTeamId !== null) {
            for (const p of filler) {
              teamMap.get(targetTeamId)!.incoming.push({ asset: { id: p.id, type: "player", teamId: movement.teamId }, player: p });
            }
          }
        }
      } else if (outSalary > 0 && inSalary < bounds.min) {
        // Receiving too little — find filler from the other team(s) to send here
        const shortfall = bounds.min - inSalary;
        const sourceTeamId = findLargestSurplusTeam(teamMap, movement.teamId);
        if (sourceTeamId !== null) {
          const sourceMovement = teamMap.get(sourceTeamId)!;
          const filler = findFillerPlayers(
            sourceMovement,
            shortfall,
            getCapTier(sourceMovement.team),
            selectedAssets,
            involvedTeams
          );

          if (filler.length > 0) {
            needsBalancing = true;
            sourceMovement.fillerOutgoing.push(...filler);
            for (const p of filler) {
              movement.incoming.push({ asset: { id: p.id, type: "player", teamId: sourceTeamId }, player: p });
            }
          }
        }
      }
    }

    if (!needsBalancing) break;
  }

  // Validate final salary matching for all teams
  let valid = true;
  for (const [, movement] of teamMap) {
    const capTier = getCapTier(movement.team);
    if (capTier === "UNDER_CAP") continue;

    const outSalary = computeTeamOutgoingSalary(movement);
    const inSalary = computeTeamIncomingSalary(movement);
    const bounds = computeMatchingBounds(outSalary, capTier);

    if (!bounds) continue;
    if (inSalary > bounds.max || (inSalary < bounds.min && outSalary > 0)) {
      console.log(
        `[manual-trade] Salary validation failed for ${movement.team.displayName}: ` +
        `out=${outSalary}, in=${inSalary}, bounds=${bounds.min}-${bounds.max}, tier=${capTier}`
      );
      valid = false;
      break;
    }
  }

  if (!valid) return null;

  // Build TradeScenario
  return buildTradeScenario(teamMap, involvedTeams);
}

function computeTeamOutgoingSalary(movement: TeamMovement): number {
  let salary = 0;
  for (const out of movement.outgoing) {
    salary += out.player?.contract?.salary ?? 0;
  }
  for (const p of movement.fillerOutgoing) {
    salary += p.contract?.salary ?? 0;
  }
  return salary;
}

function computeTeamIncomingSalary(movement: TeamMovement): number {
  let salary = 0;
  for (const inc of movement.incoming) {
    salary += inc.player?.contract?.salary ?? 0;
  }
  return salary;
}

function findFillerPlayers(
  movement: TeamMovement,
  deficit: number,
  capTier: CapTier,
  selectedAssets: SelectedAsset[],
  involvedTeams: Team[]
): Player[] {
  const selectedPlayerIds = new Set(
    selectedAssets.filter((a) => a.type === "player").map((a) => a.id)
  );
  const fillerIds = new Set(movement.fillerOutgoing.map((p) => p.id));

  const candidates = (movement.team.players || []).filter(
    (p: Player) =>
      !selectedPlayerIds.has(p.id) &&
      !fillerIds.has(p.id) &&
      (p.contract?.salary ?? 0) >= MIN_SALARY_THRESHOLD
  );

  if (capTier === "SECOND_APRON") {
    // One-for-one: find single player closest to deficit
    let bestPlayer: Player | null = null;
    let bestDiff = Infinity;
    for (const p of candidates) {
      const sal = p.contract?.salary ?? 0;
      const diff = Math.abs(sal - deficit);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestPlayer = p;
      }
    }
    return bestPlayer ? [bestPlayer] : [];
  }

  // Prefer a single player whose salary covers the deficit without massive overshoot (within 120%)
  const maxSingle = deficit * 1.2;
  let bestSingle: Player | null = null;
  let bestSingleDiff = Infinity;
  for (const p of candidates) {
    const sal = p.contract?.salary ?? 0;
    if (sal >= deficit && sal <= maxSingle) {
      const diff = sal - deficit;
      if (diff < bestSingleDiff) {
        bestSingleDiff = diff;
        bestSingle = p;
      }
    }
  }
  if (bestSingle) return [bestSingle];

  // Greedy ascending: pick smallest-salary players that cover the gap
  candidates.sort(
    (a: Player, b: Player) =>
      (a.contract?.salary ?? 0) - (b.contract?.salary ?? 0)
  );

  const result: Player[] = [];
  let remaining = deficit;
  for (const p of candidates) {
    if (remaining <= 0) break;
    const sal = p.contract?.salary ?? 0;
    result.push(p);
    remaining -= sal;
  }

  return result;
}

function findLargestSurplusTeam(
  teamMap: Map<number, TeamMovement>,
  excludeTeamId: number
): number | null {
  let bestTeamId: number | null = null;
  let bestSurplus = -Infinity;

  for (const [teamId, movement] of teamMap) {
    if (teamId === excludeTeamId) continue;
    const outSalary = computeTeamOutgoingSalary(movement);
    const inSalary = computeTeamIncomingSalary(movement);
    // Surplus = how much more this team is receiving than sending
    const surplus = inSalary - outSalary;
    if (surplus > bestSurplus) {
      bestSurplus = surplus;
      bestTeamId = teamId;
    }
  }

  return bestTeamId;
}

function findLargestDeficitTeam(
  teamMap: Map<number, TeamMovement>,
  excludeTeamId: number
): number | null {
  let bestTeamId: number | null = null;
  let bestDeficit = -Infinity;

  for (const [teamId, movement] of teamMap) {
    if (teamId === excludeTeamId) continue;
    const outSalary = computeTeamOutgoingSalary(movement);
    const inSalary = computeTeamIncomingSalary(movement);
    const deficit = outSalary - inSalary;
    if (deficit > bestDeficit) {
      bestDeficit = deficit;
      bestTeamId = teamId;
    }
  }

  return bestTeamId;
}

function buildTradeScenario(
  teamMap: Map<number, TeamMovement>,
  involvedTeams: Team[]
): TradeScenario | null {
  const teams: TeamInTradeScenario[] = [];

  for (const [teamId, movement] of teamMap) {
    const team = involvedTeams.find((t) => t.id === teamId);
    if (!team) continue;
    const teamName = team.displayName || team.name;

    // Build gives
    const givesPlayers: TradeAssetInScenario[] = [];
    const givesPicks: TradeAssetInScenario[] = [];

    for (const out of movement.outgoing) {
      if (out.player) {
        givesPlayers.push({ name: out.player.fullName, type: "player", from: teamName });
      }
      if (out.pick) {
        givesPicks.push({
          name: `${out.pick.year} R${out.pick.round}`,
          type: "pick",
          from: teamName,
          id: out.pick.id,
        });
      }
    }
    for (const p of movement.fillerOutgoing) {
      givesPlayers.push({ name: p.fullName, type: "player", from: teamName });
    }

    // Build receives - need to figure out which team each incoming asset came from
    const receivesPlayers: TradeAssetInScenario[] = [];
    const receivesPicks: TradeAssetInScenario[] = [];

    for (const inc of movement.incoming) {
      const fromTeam = involvedTeams.find((t) => t.id === inc.asset.teamId);
      const fromName = fromTeam?.displayName || fromTeam?.name || "Unknown";

      if (inc.player) {
        receivesPlayers.push({ name: inc.player.fullName, type: "player", from: fromName });
      }
      if (inc.pick) {
        receivesPicks.push({
          name: `${inc.pick.year} R${inc.pick.round}`,
          type: "pick",
          from: fromName,
          id: inc.pick.id,
        });
      }
    }

    // Only include teams that actually participate
    if (
      givesPlayers.length === 0 &&
      givesPicks.length === 0 &&
      receivesPlayers.length === 0 &&
      receivesPicks.length === 0
    ) {
      continue;
    }

    teams.push({
      teamName,
      explanation: "",
      salaryMatch: "",
      gives: {
        players: givesPlayers.length > 0 ? givesPlayers : undefined,
        picks: givesPicks.length > 0 ? givesPicks : undefined,
      },
      receives: {
        players: receivesPlayers.length > 0 ? receivesPlayers : undefined,
        picks: receivesPicks.length > 0 ? receivesPicks : undefined,
      },
    });
  }

  if (teams.length < 2) return null;

  return { teams };
}

/**
 * Generate a concise text description of a manual trade for exclusion in AI prompt.
 */
export function describeManualTrade(trade: TradeScenario): string {
  const parts: string[] = [];
  for (const team of trade.teams) {
    const gives = [
      ...(team.gives.players?.map((p) => p.name) ?? []),
      ...(team.gives.picks?.map((p) => p.name) ?? []),
    ];
    const receives = [
      ...(team.receives.players?.map((p) => p.name) ?? []),
      ...(team.receives.picks?.map((p) => p.name) ?? []),
    ];
    parts.push(
      `${team.teamName} sends ${gives.join(", ")} and receives ${receives.join(", ")}`
    );
  }
  return parts.join("; ");
}
