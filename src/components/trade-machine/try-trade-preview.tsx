"use client";

import {
  ArrowLeft,
  UsersIcon,
  FileTextIcon,
  AlertCircle,
  PencilIcon,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import Image from "next/image";
import type { SelectedAsset, Team, Player, DraftPick } from "~/types";
import SaveTradeModal from "./save-trade-modal";

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

      // Second apron check - teams over second apron cannot take back more salary
      if (
        team.secondApronSpace &&
        team.secondApronSpace < 0 &&
        capDifference > 0
      ) {
        return {
          isValid: false,
          message: `Invalid Trade: ${team.displayName} is over the second apron and cannot take on additional salary`,
        };
      }

      // First apron check - 110% + $100k rule
      if (
        team.firstApronSpace &&
        team.firstApronSpace < 0 &&
        outgoingSalary &&
        incomingSalary &&
        incomingSalary > outgoingSalary * 1.1 + 100000
      ) {
        return {
          isValid: false,
          message: `Invalid Trade: ${team.displayName} exceeds the salary matching rules for first apron teams`,
        };
      }
    }

    return { isValid: true, message: "" };
  };

  const { isValid, message } = validateTrade();

  // Build TradeInfo format for SaveTradeModal
  const tradeInfoForModal = tradeInfo.map((info) => ({
    team: info.team,
    playersReceived: info.playersReceived,
    picksReceived: info.picksReceived.map((pick) => ({
      name: `${pick.year} ${pick.round === 1 ? "1st" : "2nd"} Round Pick`,
      type: "pick" as const,
      from: info.team.displayName,
    })),
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
    <div className="flex-grow p-4 md:p-6 lg:p-8">
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

      {!isValid && (
        <div
          className="flex items-center gap-2 py-3 px-4 mb-4 rounded-md border border-destructive/50 bg-destructive/10 text-destructive
          justify-center w-fit mx-auto md:mx-0 md:justify-start"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <div className="text-sm font-medium">{message}</div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 justify-center">
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
                            ? (info.team.totalCapAllocation / 1000000).toFixed(
                                1
                              )
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
                            className="group relative flex items-center justify-between p-3 rounded-md border-2 border-border bg-slate-950"
                          >
                            <div className="flex items-center gap-3">
                              {player.headshot && (
                                <div className="bg-white/20 p-1 rounded-full">
                                  <Image
                                    src={player.headshot.href}
                                    alt={player.displayName}
                                    width={48}
                                    height={48}
                                    className="rounded-full object-cover w-12 h-12"
                                  />
                                </div>
                              )}
                              <div>
                                <div className="font-medium text-sm">
                                  {player.displayName}{" "}
                                  <span className="text-xs text-muted-foreground">
                                    (
                                    {player.position?.abbreviation || "Unknown"}
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
    </div>
  );
}
