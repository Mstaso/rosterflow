"use client";

import { useState } from "react";
import {
  ArrowLeft,
  UsersIcon,
  FileTextIcon,
  AlertCircle,
  CheckCircle,
  PencilIcon,
  BarChart3Icon,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import Image from "next/image";
import type { SelectedAsset, Team, Player, DraftPick } from "~/types";
import SaveTradeModal from "./save-trade-modal";
import { PlayerStatsModal } from "~/components/player-stats-modal";

interface TryTradePreviewProps {
  selectedTeams: Team[];
  selectedAssets: SelectedAsset[];
  onBack: () => void;
}

type TeamTradeInfo = {
  team: Team;
  playersReceived: Player[];
  picksReceived: DraftPick[];
  playersSent: Player[];
  picksSent: DraftPick[];
  outgoingSalary: number;
  incomingSalary: number;
  capDifference: number;
};

export default function TryTradePreview({
  selectedTeams,
  selectedAssets,
  onBack,
}: TryTradePreviewProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<{
    player: Player;
    teamColor?: string;
    teamAltColor?: string;
  } | null>(null);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);

  const handleOpenPlayerStats = (
    player: Player,
    teamColor?: string,
    teamAltColor?: string
  ) => {
    setSelectedPlayer({ player, teamColor, teamAltColor });
    setIsStatsModalOpen(true);
  };

  // Build trade info for each team
  const buildTradeInfo = (): TeamTradeInfo[] => {
    return selectedTeams.map((team) => {
      // Players this team is sending (assets where teamId matches this team)
      const playersSent: Player[] = [];
      const picksSent: DraftPick[] = [];

      // Players this team is receiving (assets where targetTeamId matches this team)
      const playersReceived: Player[] = [];
      const picksReceived: DraftPick[] = [];

      selectedAssets.forEach((asset) => {
        if (asset.type === "player") {
          // Find the player
          const sourceTeam = selectedTeams.find((t) => t.id === asset.teamId);
          const player = sourceTeam?.players?.find((p) => p.id === asset.id);

          if (player) {
            if (asset.teamId === team.id) {
              // This team is sending this player
              playersSent.push(player);
            }
            if (asset.targetTeamId === team.id) {
              // This team is receiving this player
              playersReceived.push(player);
            }
          }
        } else if (asset.type === "pick") {
          // Find the pick
          const sourceTeam = selectedTeams.find((t) => t.id === asset.teamId);
          const pick = sourceTeam?.draftPicks?.find((p) => p.id === asset.id);

          if (pick) {
            if (asset.teamId === team.id) {
              // This team is sending this pick
              picksSent.push(pick);
            }
            if (asset.targetTeamId === team.id) {
              // This team is receiving this pick
              picksReceived.push(pick);
            }
          }
        }
      });

      const outgoingSalary = playersSent.reduce(
        (acc, player) => acc + (player.contract?.salary || 0),
        0
      );
      const incomingSalary = playersReceived.reduce(
        (acc, player) => acc + (player.contract?.salary || 0),
        0
      );
      const capDifference = incomingSalary - outgoingSalary;

      return {
        team,
        playersReceived,
        picksReceived,
        playersSent,
        picksSent,
        outgoingSalary,
        incomingSalary,
        capDifference,
      };
    });
  };

  const tradeInfo = buildTradeInfo();

  // Validate trade salary rules
  const validateTrade = (): { isValid: boolean; message: string } => {
    for (const info of tradeInfo) {
      const { team, capDifference, outgoingSalary, incomingSalary } = info;

      // Skip validation if no salary movement
      if (outgoingSalary === 0 && incomingSalary === 0) continue;

      const secondApronSpace = team.secondApronSpace || 0;
      const firstApronSpace = team.firstApronSpace || 0;
      const capSpace = team.capSpace || 0;

      // Calculate post-trade apron spaces
      const postTradeSecondApronSpace = secondApronSpace - capDifference;
      const postTradeFirstApronSpace = firstApronSpace - capDifference;

      // Check 1: Second Apron - Cannot receive more money than sent out
      // Applies if team is already over second apron OR trade would put them over
      const isOverSecondApron = secondApronSpace < 0;
      const wouldCrossSecondApron =
        secondApronSpace >= 0 && postTradeSecondApronSpace < 0;

      if ((isOverSecondApron || wouldCrossSecondApron) && capDifference > 0) {
        return {
          isValid: false,
          message: `Waring Invalid: ${team.displayName} is over/would cross second apron and cannot take on additional salary`,
        };
      }

      // Check 2: First Apron - Must match within 110% + $100K
      // Applies if team is already over first apron OR trade would put them over
      const isOverFirstApron = firstApronSpace < 0;
      const wouldCrossFirstApron =
        firstApronSpace >= 0 && postTradeFirstApronSpace < 0;
      const maxAllowedFirstApron = outgoingSalary * 1.1 + 100000;

      if (
        (isOverFirstApron || wouldCrossFirstApron) &&
        incomingSalary > maxAllowedFirstApron
      ) {
        return {
          isValid: false,
          message: `Warning: Invalid: ${team.displayName} exceeds 110% + $100K salary matching rule for first apron teams`,
        };
      }

      // Check 3: Over cap but under aprons - Must match within 125% + $100K
      if (capSpace < 0 && firstApronSpace >= 0) {
        const maxAllowedOverCap = outgoingSalary * 1.25 + 100000;

        if (incomingSalary > maxAllowedOverCap) {
          return {
            isValid: false,
            message: `Warning: Invalid: ${team.displayName} exceeds 125% + $100K salary matching rule for over-cap teams`,
          };
        }
      }
    }

    return { isValid: true, message: "" };
  };

  const { isValid, message } = validateTrade();

  // Build TradeInfo format for SaveTradeModal
  const tradeInfoForModal = tradeInfo.map((info) => ({
    team: info.team,
    playersReceived: info.playersReceived,
    picksReceived: info.picksReceived.map((pick) => {
      // Find the asset to get the sending team (teamId is the sender)
      const asset = selectedAssets.find(
        (a) =>
          a.type === "pick" &&
          a.id === pick.id &&
          a.targetTeamId === info.team.id
      );
      const sendingTeam = selectedTeams.find((t) => t.id === asset?.teamId);

      return {
        name: `${pick.year} ${pick.round === 1 ? "1st" : "2nd"} Round Pick`,
        type: "pick" as const,
        from: sendingTeam?.displayName || "",
        id: pick.id, // Include the draft pick ID for direct lookup
      };
    }),
    outGoingSalary: info.outgoingSalary,
    inComingSalary: info.incomingSalary,
    capDifference: info.capDifference,
  }));

  const calculateUpdatedTaxValue = (
    currentValue: number,
    capDifference: number
  ) => {
    if (currentValue < 0 && capDifference < 0) {
      return currentValue + capDifference;
    } else if (currentValue < 0 && capDifference > 0) {
      return currentValue - capDifference;
    } else if (currentValue > 0 && capDifference > 0) {
      return currentValue - capDifference;
    } else if (currentValue > 0 && capDifference < 0) {
      return currentValue - capDifference;
    } else {
      return 0;
    }
  };

  return (
    <div className="flex-grow">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-6">
        <div className="mb-6 flex gap-4">
          <Button
            onClick={onBack}
            variant="ghost"
            className="text-muted-foreground w-full sm:w-auto p-0 h-auto hover:text-white hover:bg-transparent justify-start sm:justify-center"
          >
            <ArrowLeft className="text-indigoMain mr-2" />
            Back to Trade Machine
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 sm:gap-3 mb-4">
          <SaveTradeModal
            isLoading={false}
            tradeInfo={tradeInfoForModal}
            isValidTrade={isValid}
            selectedAssets={selectedAssets}
            selectedTeamIds={selectedTeams.map((t) => t.id)}
          />
          <Button
            variant="outline"
            className="w-full sm:w-auto flex items-center justify-center gap-2 border-white text-white bg-transparent hover:bg-white/10 transition-all duration-150 ease-in-out"
            onClick={onBack}
          >
            <PencilIcon className="h-4 w-4" strokeWidth={1.5} />
            <span>Edit Trade</span>
          </Button>
        </div>

        {isValid && (
          <div
            className="flex items-center gap-2 py-3 px-4 mb-4 rounded-md border border-green-500/50 bg-green-500/10 text-green-500
          justify-center w-full md:w-fit md:mx-0 md:justify-start"
          >
            <CheckCircle className="w-4 h-4 shrink-0" />
            <div className="text-sm font-medium">
              Valid trade - Salary rules satisfied
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-4 justify-center mb-4">
          {tradeInfo.map((info, index) => (
            <Card
              key={index}
              className="flex flex-col h-auto overflow-hidden border-indigoMain bg-gradient-to-br from-background via-background/95 to-muted/80 md:flex-1"
            >
              <CardHeader className="flex flex-row items-center justify-center space-y-0 pb-2 pt-4 px-4 bg-muted/60">
                <div className="flex items-center gap-2">
                  {info.team.logos?.[0] && (
                    <Image
                      src={info.team.logos[0].href}
                      alt={info.team.logos[0].alt}
                      width={32}
                      height={32}
                      className="object-contain"
                    />
                  )}
                  <span className="text-lg font-semibold">
                    {info.team.displayName}
                  </span>
                </div>
              </CardHeader>

              <div className="px-4 py-3 bg-muted/10">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      Outgoing Salary
                    </div>
                    <div className="text-sm font-medium">
                      ${(info.outgoingSalary / 1000000).toFixed(1)}M
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      Incoming Salary
                    </div>
                    <div className="text-sm font-medium">
                      ${(info.incomingSalary / 1000000).toFixed(1)}M
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">
                      Cap Difference
                    </div>
                    <div
                      className={`text-sm font-medium ${
                        info.capDifference > 0
                          ? "text-red-500"
                          : info.capDifference < 0
                          ? "text-green-500"
                          : "text-foreground"
                      }`}
                    >
                      ${(info.capDifference / 1000000).toFixed(1)}M
                    </div>
                  </div>
                </div>
              </div>

              <CardContent className="px-4 py-4 flex-grow flex flex-col bg-muted/60 border-indigoMain">
                <div>
                  <div className="mb-4">
                    <div className="text-sm font-semibold mb-2">
                      Updated Team Cap Info
                    </div>
                    <table className="w-full border border-border rounded text-xs">
                      <tbody>
                        <tr className="bg-muted/40">
                          <td className="px-2 py-1 text-muted-foreground w-1/2">
                            Total Cap
                          </td>
                          <td className="px-2 py-1 font-medium w-1/2 text-right">
                            $
                            {info.team.totalCapAllocation
                              ? (
                                  info.team.totalCapAllocation / 1000000
                                ).toFixed(1)
                              : "0.0"}
                            M
                          </td>
                        </tr>
                        <tr className="bg-background">
                          <td className="px-2 py-1 text-muted-foreground w-1/2">
                            Cap Space
                          </td>
                          <td className="px-2 py-1 font-medium w-1/2 text-right">
                            $
                            {(
                              calculateUpdatedTaxValue(
                                info.team.capSpace || 0,
                                info.capDifference
                              ) / 1000000
                            ).toFixed(1)}
                            M
                          </td>
                        </tr>
                        <tr className="bg-muted/40">
                          <td className="px-2 py-1 text-muted-foreground w-1/2">
                            1st Apron Space
                          </td>
                          <td className="px-2 py-1 font-medium w-1/2 text-right">
                            $
                            {(
                              calculateUpdatedTaxValue(
                                info.team.firstApronSpace || 0,
                                info.capDifference
                              ) / 1000000
                            ).toFixed(1)}
                            M
                          </td>
                        </tr>
                        <tr className="bg-background">
                          <td className="px-2 py-1 text-muted-foreground w-1/2">
                            2nd Apron Space
                          </td>
                          <td className="px-2 py-1 font-medium w-1/2 text-right">
                            $
                            {(
                              calculateUpdatedTaxValue(
                                info.team.secondApronSpace || 0,
                                info.capDifference
                              ) / 1000000
                            ).toFixed(1)}
                            M
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Players Received */}
                  {info.playersReceived.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-3 text-sm font-medium text-muted-foreground">
                        <UsersIcon className="w-4 h-4" strokeWidth={1.5} />
                        Players Received
                      </div>
                      <div className="space-y-3">
                        {info.playersReceived.map((player, playerIndex) => {
                          // Find which team this player came from
                          const fromTeam = selectedTeams.find((t) =>
                            t.players?.some((p) => p.id === player.id)
                          );

                          return (
                            <div
                              key={playerIndex}
                              className="group relative flex items-center justify-between p-3 rounded-md border-2 border-border bg-slate-950 hover:border-indigoMain/50 cursor-pointer transition-colors"
                              onClick={() =>
                                handleOpenPlayerStats(
                                  player,
                                  fromTeam?.color,
                                  fromTeam?.alternateColor
                                )
                              }
                            >
                              <div className="flex items-center gap-3">
                                {player.headshot && (
                                  <div className="bg-white/20 p-1 rounded-full">
                                    <Image
                                      src={player.headshot.href}
                                      alt={player.displayName}
                                      width={96}
                                      height={96}
                                      className="rounded-full object-cover w-12 h-12"
                                    />
                                  </div>
                                )}
                                <div>
                                  <div className="font-medium text-sm">
                                    {player.displayName}{" "}
                                    <span className="text-xs text-muted-foreground">
                                      (
                                      {player.position?.abbreviation ||
                                        "Unknown"}
                                      )
                                    </span>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {player.contract
                                      ? `Salary: $${(
                                          player.contract.salary / 1000000
                                        ).toFixed(1)}M`
                                      : "No contract"}
                                    {" | "}
                                    {player.contract?.yearsRemaining}
                                    {` ${
                                      player.contract?.yearsRemaining === 1
                                        ? "yr"
                                        : "yrs"
                                    }`}
                                  </div>
                                  {fromTeam && fromTeam.id !== info.team.id && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      from {fromTeam.abbreviation}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-indigoMain"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenPlayerStats(
                                    player,
                                    fromTeam?.color,
                                    fromTeam?.alternateColor
                                  );
                                }}
                              >
                                <BarChart3Icon className="h-4 w-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Picks Received */}
                  {info.picksReceived.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-3 text-sm font-medium text-muted-foreground">
                        <FileTextIcon className="w-4 h-4" strokeWidth={1.5} />
                        Picks Received
                      </div>
                      <div className="space-y-3">
                        {info.picksReceived.map((pick, pickIndex) => {
                          // Find which team this pick came from
                          const fromTeam = selectedTeams.find((t) =>
                            t.draftPicks?.some((p) => p.id === pick.id)
                          );

                          return (
                            <div
                              key={pickIndex}
                              className="group relative flex items-center justify-between p-3 rounded-md border-2 border-border bg-slate-950"
                            >
                              <div className="flex flex-col gap-1">
                                {fromTeam && fromTeam.id !== info.team.id && (
                                  <div className="text-xs text-muted-foreground">
                                    from {fromTeam.abbreviation}
                                  </div>
                                )}
                                <div className="font-medium text-sm">
                                  {pick.year} {pick.round === 1 ? "1st" : "2nd"}{" "}
                                  Round {pick.isSwap ? "Pick Swap" : "Pick"}
                                </div>
                                {pick.description && (
                                  <div className="text-xs text-muted-foreground">
                                    {pick.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* No assets received */}
                  {info.playersReceived.length === 0 &&
                    info.picksReceived.length === 0 && (
                      <div className="text-center py-6 text-muted-foreground">
                        <div className="text-sm">No assets received</div>
                      </div>
                    )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {!isValid && (
          <div
            className="flex items-center gap-2 py-3 px-4 rounded-md border border-orange-500/50 bg-orange-500/10 text-orange-500
          justify-center w-full md:w-fit md:mx-0 md:justify-start"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <div className="text-sm font-medium">{message}</div>
          </div>
        )}
      </div>

      {/* Player Stats Modal */}
      <PlayerStatsModal
        player={selectedPlayer?.player || null}
        espnId={selectedPlayer?.player?.espnId}
        isOpen={isStatsModalOpen}
        onClose={() => {
          setIsStatsModalOpen(false);
          setSelectedPlayer(null);
        }}
        teamColor={selectedPlayer?.teamColor}
        teamAltColor={selectedPlayer?.teamAltColor}
      />
    </div>
  );
}
