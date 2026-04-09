import { getNBATeamWithRosterAndDraftPicks } from "~/actions/nbaTeams";
import type { DraftPick, Player, SelectedAsset, Team } from "~/types";
import { computePlayerRating, computeContractValue, MIN_SALARY_THRESHOLD } from "~/lib/player-utils";

export { computePlayerRating, computeContractValue, MIN_SALARY_THRESHOLD };
export type { PlayerTier, ContractValueTag } from "~/lib/player-utils";

export async function setupAdditionalTeamsForTrade(additionalTeams: Team[]) {
  const teamWithRosterAndPicks = await Promise.all(
    additionalTeams.map(async (team: Team) => {
      const teamWithRosterAndPicks = await getNBATeamWithRosterAndDraftPicks(
        team.id
      );
      return teamWithRosterAndPicks;
    })
  );

  return teamWithRosterAndPicks;
}

function getPlayerCompact(player: Player) {
  const salary = player.contract?.salary
    ? (player.contract.salary / 1000000).toFixed(1)
    : "0";
  const yrs = player.contract?.yearsRemaining ?? 0;
  let line = `${player.fullName} | ${player.position?.abbreviation ?? "?"} | $${salary}M | ${yrs}yr | ${player.age}yo`;
  const s = player.statistics;
  if (s) {
    line += ` | ${s.points}ppg/${s.rebounds}rpg/${s.assists}apg`;
  }
  const { rating, tier } = computePlayerRating(player);
  const contractTag = computeContractValue(player, rating);
  line += ` | [rating:${rating} ${tier}] [contract: ${contractTag}]`;
  return line;
}

function getPickCompact(pick: DraftPick) {
  let text = `${pick.year} R${pick.round}`;

  if (pick.isProtected) text += " (P)";
  if (pick.isSwap) text += " (Swap)";
  if (pick.description) text += ` - ${pick.description}`;
  if (pick.estimatedValue) text += ` [val:${pick.estimatedValue}]`;

  return text;
}

// Legacy verbose formats used for selected assets display
function getPlayerInfo(player: Player) {
  return getPlayerCompact(player);
}

function getPickInfo(pick: DraftPick) {
  return getPickCompact(pick);
}

function isTradeRelevantPlayer(player: Player): boolean {
  const salary = player.contract?.salary ?? 0;
  return salary >= MIN_SALARY_THRESHOLD;
}

export function getTeamOutlookContext(involvedTeams: Team[]) {
  return involvedTeams
    .map((team: any) => {
      const name = team.displayName || team.name;
      const r = team.record;
      if (!r) return `${name}: record unknown`;

      // Handle legacy string format (e.g. "41-41")
      let wins: number, losses: number, winPct: number, confRank: number | string;
      if (typeof r === "string") {
        const parts = r.split("-").map(Number);
        wins = parts[0] ?? 41;
        losses = parts[1] ?? 41;
        winPct = wins / (wins + losses);
        confRank = "?";
      } else {
        wins = r.wins ?? 41;
        losses = r.losses ?? 41;
        winPct = r.winPercentage ?? wins / (wins + losses);
        confRank = r.conferenceRank ?? "?";
      }

      let outlook = "mid-tier";
      if (winPct >= 0.6) outlook = "contender (win-now)";
      else if (winPct >= 0.5) outlook = "playoff team";
      else if (winPct >= 0.4) outlook = "fringe playoff";
      else outlook = "rebuilding (future-focused)";
      return `${name}: ${wins}-${losses} (${outlook}, conf rank #${confRank})`;
    })
    .join("\n");
}

const MAX_PLAYERS_PER_TEAM = 10;

export function getRosterContext(involvedTeams: Team[], selectedAssets?: SelectedAsset[]) {
  const selectedPlayerIds = new Set(
    (selectedAssets || []).filter(a => a.type === "player").map(a => a.id)
  );

  let rosterContext = "";
  involvedTeams.forEach((team: any) => {
    const teamName = team.displayName || team.name;

    // Filter to trade-relevant players, sort by rating, cap at top N
    const relevantPlayers = (team.players || []).filter(isTradeRelevantPlayer);
    const withRatings = relevantPlayers.map((p: Player) => ({
      player: p,
      rating: computePlayerRating(p).rating,
    }));
    withRatings.sort((a: { rating: number }, b: { rating: number }) => b.rating - a.rating);

    const top = withRatings.slice(0, MAX_PLAYERS_PER_TEAM);
    const topIds = new Set(top.map((wr: { player: Player }) => wr.player.id));

    // Always include selected asset players even if below cutoff
    for (const wr of withRatings) {
      if (!topIds.has(wr.player.id) && selectedPlayerIds.has(wr.player.id)) {
        top.push(wr);
      }
    }

    const playersInfo = top
      .map((wr: { player: Player }) => getPlayerCompact(wr.player))
      .join("; ");

    const picksFormatted = (team.draftPicks || [])
      .map((pick: DraftPick) => getPickCompact(pick))
      .join("; ");

    rosterContext += `${teamName}: ${playersInfo} || Picks: ${picksFormatted}\n`;
  });
  return rosterContext;
}

export function getStepienContext(involvedTeams: Team[]): string {
  const warnings: string[] = [];

  for (const team of involvedTeams) {
    const teamName = (team as any).displayName || (team as any).name;
    const firstRoundPicks = ((team as any).draftPicks || []).filter(
      (p: DraftPick) => p.round === 1
    );

    // Identify which first-round picks the team owns (vs acquired via trade)
    // Picks with description "Own" or empty are the team's own picks
    const ownPickYears = new Set<number>();

    for (const pick of firstRoundPicks) {
      const desc = (pick.description ?? "").trim();
      if (desc === "" || desc.toLowerCase() === "own" || desc.toLowerCase().startsWith("own")) {
        ownPickYears.add(pick.year);
      }
    }

    // Check years 2025-2031: if team doesn't own their R1 in year Y,
    // the adjacent years' R1 picks can't be traded (Stepien rule)
    for (let y = 2025; y <= 2031; y++) {
      if (!ownPickYears.has(y)) {
        // This year's R1 is not owned — check adjacent years
        if (ownPickYears.has(y - 1)) {
          warnings.push(
            `${teamName} cannot trade their ${y - 1} R1 pick (they do not control their ${y} R1)`
          );
        }
        if (ownPickYears.has(y + 1)) {
          warnings.push(
            `${teamName} cannot trade their ${y + 1} R1 pick (they do not control their ${y} R1)`
          );
        }
      }
    }
  }

  if (warnings.length === 0) return "";
  // Deduplicate warnings
  const unique = [...new Set(warnings)];
  return "\nSTEPIEN RULE (teams cannot trade first-round picks in consecutive years):\n" +
    unique.map(w => `- ${w}`).join("\n") + "\n";
}

export function getCapContext(involvedTeams: Team[]) {
  const capEntries = involvedTeams.map((team: any) => {
    const firstApronSpace = ((team.firstApronSpace || 0) / 1000000).toFixed(1);

    let capStatus = "";
    if ((team.secondApronSpace || 0) < 0) {
      capStatus = "SECOND APRON (no aggregation, can't receive more than sent)";
    } else if ((team.firstApronSpace || 0) < 0) {
      capStatus = "FIRST APRON (110% + $100K matching)";
    } else if ((team.capSpace || 0) < 0) {
      capStatus = `OVER CAP (125% + $100K matching, ${firstApronSpace}M to apron)`;
    } else {
      capStatus = `UNDER CAP (${firstApronSpace}M available)`;
    }

    return `${team.displayName || team.name}: ${capStatus}`;
  });

  return capEntries.join("\n");
}

export type CapTier = "UNDER_CAP" | "OVER_CAP" | "FIRST_APRON" | "SECOND_APRON";

export function getCapTier(team: any): CapTier {
  if ((team.secondApronSpace || 0) < 0) return "SECOND_APRON";
  if ((team.firstApronSpace || 0) < 0) return "FIRST_APRON";
  if ((team.capSpace || 0) < 0) return "OVER_CAP";
  return "UNDER_CAP";
}

function formatM(val: number): string {
  return `$${(val / 1_000_000).toFixed(1)}M`;
}

export function computeMatchingBounds(
  outgoingSalary: number,
  capTier: CapTier
): { min: number; max: number } | null {
  if (capTier === "UNDER_CAP") return null; // no matching needed
  if (capTier === "SECOND_APRON") {
    // Can't receive more than sent, no aggregation
    return { min: 0, max: outgoingSalary };
  }
  if (capTier === "FIRST_APRON") {
    // 110% + $100K
    return {
      min: Math.round((outgoingSalary - 100_000) / 1.1),
      max: Math.round(outgoingSalary * 1.1 + 100_000),
    };
  }
  // OVER_CAP: 125% + $100K
  return {
    min: Math.round((outgoingSalary - 100_000) / 1.25),
    max: Math.round(outgoingSalary * 1.25 + 100_000),
  };
}

export function getSalaryMatchingContext(
  selectedAssets: SelectedAsset[],
  involvedTeams: Team[]
) {
  let context = "";

  // Group selected player assets by team and compute outgoing salary
  const teamOutgoing = new Map<number, { team: any; salary: number; players: string[] }>();

  for (const asset of selectedAssets) {
    if (asset.type !== "player") continue;
    const team = involvedTeams.find((t: Team) => t.id === asset.teamId) as any;
    if (!team) continue;

    const player = team.players?.find((p: Player) => p.id === asset.id);
    if (!player) continue;

    const salary = player.contract?.salary ?? 0;
    const existing = teamOutgoing.get(team.id) || { team, salary: 0, players: [] };
    existing.salary += salary;
    existing.players.push(`${player.fullName} (${formatM(salary)})`);
    teamOutgoing.set(team.id, existing);
  }

  context += "SALARY MATCHING GUIDE:\n";

  for (const [teamId, info] of teamOutgoing) {
    const capTier = getCapTier(info.team);
    const teamName = info.team.displayName || info.team.name;

    context += `\n${teamName}:\n`;
    context += `  Already sending: ${info.players.join(" + ")} = ${formatM(info.salary)}\n`;

    if (capTier === "UNDER_CAP") {
      context += `  Cap status: UNDER CAP — no salary matching required\n`;
    } else if (capTier === "SECOND_APRON") {
      context += `  Cap status: SECOND APRON — one-for-one trades only, cannot receive more salary than sent\n`;
      context += `  With current outgoing (${formatM(info.salary)}): can receive up to ${formatM(info.salary)}\n`;
      context += `  Formula if adding more outgoing: max_incoming = total_outgoing\n`;
    } else if (capTier === "FIRST_APRON") {
      const bounds = computeMatchingBounds(info.salary, capTier)!;
      context += `  Cap status: FIRST APRON — 110% + $100K matching\n`;
      context += `  With current outgoing (${formatM(info.salary)}): can receive ${formatM(bounds.min)} - ${formatM(bounds.max)}\n`;
      context += `  Formula if adding more outgoing: min = total_out / 1.1 - 0.1M, max = total_out × 1.1 + 0.1M\n`;
    } else {
      const bounds = computeMatchingBounds(info.salary, capTier)!;
      context += `  Cap status: OVER CAP — 125% + $100K matching\n`;
      context += `  With current outgoing (${formatM(info.salary)}): can receive ${formatM(bounds.min)} - ${formatM(bounds.max)}\n`;
      context += `  Formula if adding more outgoing: min = total_out / 1.25 - 0.1M, max = total_out × 1.25 + 0.1M\n`;
    }
  }

  // Add context for teams that are only receiving (no selected outgoing players)
  for (const team of involvedTeams as any[]) {
    if (teamOutgoing.has(team.id)) continue;
    const capTier = getCapTier(team);
    const teamName = team.displayName || team.name;

    context += `\n${teamName}:\n`;
    context += `  No selected outgoing players yet\n`;

    if (capTier === "UNDER_CAP") {
      context += `  Cap status: UNDER CAP — no salary matching required\n`;
    } else if (capTier === "SECOND_APRON") {
      context += `  Cap status: SECOND APRON — one-for-one only, cannot receive more than sent\n`;
    } else if (capTier === "FIRST_APRON") {
      context += `  Cap status: FIRST APRON — must send back: min = incoming / 1.1 - 0.1M, max = incoming × 1.1 + 0.1M\n`;
    } else {
      context += `  Cap status: OVER CAP — must send back: min = incoming / 1.25 - 0.1M, max = incoming × 1.25 + 0.1M\n`;
    }
  }

  return context;
}

function getSelectedAssetByTeam(
  selectedTeam: Team,
  playerOrPickId: number,
  type: "player" | "pick"
) {
  if (type === "player") {
    const findPlayer = selectedTeam.players?.find(
      (player: Player) => playerOrPickId === player.id
    );
    if (findPlayer) {
      return getPlayerInfo(findPlayer);
    } else {
      console.log(`Player not found: ${playerOrPickId}`);
    }
  } else {
    const findPick = selectedTeam.draftPicks?.find(
      (pick: DraftPick) => playerOrPickId === pick.id
    );
    if (findPick) {
      return getPickInfo(findPick);
    } else {
      console.log(`Pick not found: ${playerOrPickId}`);
    }
  }
}

export function getAssetsByTeam(
  selectedAssets: SelectedAsset[],
  involvedTeams: Team[]
) {
  const assetsByTeam: any = {};

  selectedAssets.forEach((asset: SelectedAsset) => {
    const team = involvedTeams.find((t: Team) => t.id === asset.teamId);
    if (team) {
      if (!assetsByTeam[team.id]) {
        assetsByTeam[team.id] = {
          displayName: team.displayName,
          players: [],
          picks: [],
        };
      }

      const selectedAsset = getSelectedAssetByTeam(team, asset.id, asset.type);
      if (selectedAsset) {
        if (asset.type === "player") {
          assetsByTeam[team.id].players.push(selectedAsset);
        } else {
          assetsByTeam[team.id].picks.push(selectedAsset);
        }
      }
    }
  });

  let assetsDescription = "";

  Object.entries(assetsByTeam).forEach(
    ([teamId, teamAssets]: [string, any]) => {
      assetsDescription += `\n${teamAssets.displayName} trading away:`;

      if (teamAssets.players.length > 0) {
        assetsDescription += ` Players: ${teamAssets.players.join("; ")}`;
      }

      if (teamAssets.picks.length > 0) {
        assetsDescription += ` Picks: ${teamAssets.picks.join("; ")}`;
      }
      assetsDescription += "\n";
    }
  );

  return assetsDescription;
}

export function getDestinationInfo(
  selectedAssets: SelectedAsset[],
  involvedTeams: Team[]
) {
  let destinationInfo = "\nDestination Preferences:\n";

  selectedAssets.forEach((asset: SelectedAsset) => {
    if (asset.targetTeamId) {
      const fromTeam = involvedTeams.find((t: Team) => t.id === asset.teamId);
      const toTeam = involvedTeams.find(
        (t: Team) => t.id === asset.targetTeamId
      );
      const fromTeamName =
        fromTeam?.displayName || fromTeam?.name || asset.teamId;
      const toTeamName =
        toTeam?.displayName || toTeam?.name || asset.targetTeamId;

      let assetName = "";
      if (asset.type === "player") {
        const player = fromTeam?.players?.find(
          (p: Player) => p.id === asset.id
        );
        assetName = player?.fullName || `Player ${asset.id}`;
      } else if (asset.type === "pick") {
        const pick = fromTeam?.draftPicks?.find(
          (p: DraftPick) => p.id === asset.id
        );
        assetName = pick ? getPickCompact(pick) : `Pick ${asset.id}`;
      }

      destinationInfo += `- ${assetName}: ${fromTeamName} → ${toTeamName}\n`;
    }
  });

  return destinationInfo;
}
