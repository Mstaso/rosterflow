import { getNBATeamWithRosterAndDraftPicks } from "~/actions/nbaTeams";
import type { DraftPick, Player, SelectedAsset, Team } from "~/types";

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

function getPlayerInfo(player: Player) {
  return `${player.fullName} position: ${player.position?.abbreviation} (${
    player.contract?.salary
      ? (player.contract.salary / 1000000).toFixed(1)
      : "0"
  }M) ${player.contract?.yearsRemaining} ${
    player.contract?.yearsRemaining === 1 ? "yr" : "yrs"
  } remaining, age: ${player.age} years old`;
}

function getPickInfo(pick: DraftPick) {
  let pickText = `${pick.year} ${pick.round} Round Pick`;

  // Add protection status
  if (pick.isProtected) {
    pickText += " (Protected)";
  }

  // Add swap status
  if (pick.isSwap) {
    pickText += " (Swap)";
  }

  // Add description if available
  if (pick.description) {
    pickText += ` - ${pick.description}`;
  }

  return pickText;
}

export function getRosterContext(involvedTeams: Team[]) {
  let rosterContext = "";
  involvedTeams.forEach((team: any) => {
    const teamName = team.displayName || team.name;

    // Format players with salaries
    const playersInfo = involvedTeams
      .map((team: any) => {
        return team.players?.map((player: Player) => {
          return getPlayerInfo(player);
        });
      })
      .join(", ");

    // Format draft picks
    const picksFormatted = team.draftPicks
      ?.map((pick: DraftPick) => {
        return getPickInfo(pick);
      })
      .join(", ");

    rosterContext += `**${teamName}:** Players: ${playersInfo} | Picks: ${picksFormatted}\n`;
  });
  return rosterContext;
}

export function getCapContext(involvedTeams: Team[]) {
  let capContext = "";
  const capEntries = involvedTeams.map((team: any) => {
    const totalCap = ((team.totalCapAllocation || 0) / 1000000).toFixed(1);
    const capSpace = ((team.capSpace || 0) / 1000000).toFixed(1);
    const firstApronSpace = ((team.firstApronSpace || 0) / 1000000).toFixed(1);
    const secondApronSpace = ((team.secondApronSpace || 0) / 1000000).toFixed(
      1
    );

    let capStatus = "";
    if ((team.secondApronSpace || 0) < 0) {
      capStatus = "SECOND APRON (Severe restrictions)";
    } else if ((team.firstApronSpace || 0) < 0) {
      capStatus = "FIRST APRON (Limited flexibility)";
    } else if ((team.capSpace || 0) < 0) {
      capStatus = "OVER CAP (Standard restrictions)";
    } else {
      capStatus = "UNDER CAP (Full flexibility)";
    }

    return `**${
      team.displayName || team.name
    }:** Total Cap: $${totalCap}M, Cap Space: $${capSpace}M, First Apron Space: $${firstApronSpace}M, Second Apron Space: $${secondApronSpace}M - ${capStatus}`;
  });

  if (capEntries.length > 0) {
    capContext = `\n\n**TEAM SALARY CAP POSITIONS:**
${capEntries.join("\n")}

**IMPORTANT: Consider each team's cap position when designing trades. Teams under different cap restrictions have different trade limitations.**`;
  }
  return capContext;
}

function getSelectedAssetByTeam(
  selectedTeam: Team,
  playerOrPickId: string,
  type: "player" | "pick"
) {
  if (type === "player") {
    const findPlayer = selectedTeam.players?.find(
      (player: Player) => playerOrPickId === player.id.toString()
    );
    if (findPlayer) {
      return getPlayerInfo(findPlayer);
    } else {
      console.log(`Player not found: ${playerOrPickId}`);
    }
  } else {
    const findPick = selectedTeam.draftPicks?.find(
      (pick: DraftPick) => playerOrPickId === pick.id.toString()
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
    const team = involvedTeams.find(
      (t: Team) => t.id.toString() === asset.teamId.toString()
    );
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
      assetsDescription += `\n**${teamAssets.displayName} Trading Away:**\n`;

      if (teamAssets.players.length > 0) {
        assetsDescription += `Players: ${teamAssets.players.join(", ")}\n`;
      }

      if (teamAssets.picks.length > 0) {
        assetsDescription += `Picks: ${teamAssets.picks.join(", ")}\n`;
      }
    }
  );

  return assetsDescription;
}

export function getDestinationInfo(
  selectedAssets: SelectedAsset[],
  involvedTeams: Team[]
) {
  let destinationInfo = "";

  destinationInfo = "\n**Destination Preferences:**\n";
  selectedAssets.forEach((asset: SelectedAsset) => {
    if (asset.targetTeamId) {
      // Find the source and destination teams by id (number)
      const fromTeam = involvedTeams.find((t: Team) => t.id === asset.teamId);
      const toTeam = involvedTeams.find(
        (t: Team) => t.id === asset.targetTeamId
      );
      const fromTeamName =
        fromTeam?.displayName || fromTeam?.name || String(asset.teamId);
      const toTeamName =
        toTeam?.displayName || toTeam?.name || String(asset.targetTeamId);

      // Find the asset details from the team roster or draft picks
      let assetName = "";
      if (asset.type === "player") {
        const player = fromTeam?.players?.find(
          (p: Player) => String(p.id) === asset.id
        );
        assetName = player
          ? player.fullName || `Player ${asset.id}`
          : `Player ${asset.id}`;
      } else if (asset.type === "pick") {
        const pick = fromTeam?.draftPicks?.find(
          (p: DraftPick) => String(p.id) === asset.id
        );
        if (pick) {
          let pickText = `${pick.year} ${pick.round} Round Pick`;

          // Add protection status
          if (pick.isProtected) {
            pickText += " (Protected)";
          }

          // Add swap status
          if (pick.isSwap) {
            pickText += " (Swap)";
          }

          // Add description if available
          if (pick.description) {
            pickText += ` - ${pick.description}`;
          }

          assetName = pickText;
        } else {
          assetName = `Pick ${asset.id}`;
        }
      }

      destinationInfo += `- ${assetName} from ${fromTeamName} → ${toTeamName}\n`;
    }
  });

  return destinationInfo;
}
