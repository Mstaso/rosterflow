"use client";

import { useState } from "react";
import type { Team, TradeScenario, TradeInfo, EnrichedPick, Player } from "~/types";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import {
  UsersIcon,
  FileTextIcon,
  AlertCircle,
  CheckCircle,
  PencilIcon,
  BarChart3Icon,
} from "lucide-react";
import Image from "next/image";
import SaveTradeModal from "../save-trade-modal";
import { Button } from "~/components/ui/button";
import { PlayerStatsModal } from "~/components/player-stats-modal";

export default function TradeCard({
  trade,
  involvedTeams,
  onEditTrade,
}: {
  trade: TradeScenario;
  involvedTeams: Team[];
  onEditTrade: (tradeToEdit: TradeInfo[], involvedTeams: Team[]) => void;
}) {
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

  let isValidTrade = true;
  let salaryRationale = "";

  // Helper function to map AI-generated pick to real draft pick
  const mapPickToRealDraftPick = (
    pick: { name?: string; from?: string },
    fromTeam: Team | undefined
  ): EnrichedPick => {
    const enrichedPick: EnrichedPick = {
      name: pick.name || "",
      type: "pick",
      from: pick.from || "",
    };

    if (!fromTeam?.draftPicks || !pick.name) {
      return enrichedPick;
    }

    // Parse year and round from the pick name (e.g., "2025 1st Round Pick")
    const pickName = pick.name;
    const yearMatch = pickName.match(/(\d{4})/);
    const roundMatch = pickName.match(/(\d)(?:st|nd|rd|th)?\s*[Rr]ound/i);

    if (yearMatch?.[1] && roundMatch?.[1]) {
      const year = parseInt(yearMatch[1]);
      const round = parseInt(roundMatch[1]);

      const realDraftPick = fromTeam.draftPicks.find(
        (dp) => dp.year === year && dp.round === round
      );

      if (realDraftPick) {
        enrichedPick.draftPick = realDraftPick;
        enrichedPick.id = realDraftPick.id;
      }
    }

    return enrichedPick;
  };

  const TradesWithInfo: TradeInfo[] = trade.teams.map((tradeTeam) => {
    const findTeam = involvedTeams.find(
      (team) => team.displayName === tradeTeam.teamName
    );

    const findReceivedPlayers = tradeTeam.receives?.players?.map((player) => {
      const findPlayerFromResponse = involvedTeams.find(
        (team) => team.displayName === player.from
      );
      return findPlayerFromResponse?.players?.find(
        (p) => p.fullName === player.name
      );
    });

    // Map AI-generated picks to real draft picks
    const enrichedPicks: EnrichedPick[] | undefined =
      tradeTeam.receives?.picks?.map((pick) => {
        const fromTeam = involvedTeams.find(
          (team) => team.displayName === pick.from
        );
        return mapPickToRealDraftPick(pick, fromTeam);
      });

    const findGivenPlayers = tradeTeam.gives?.players?.map((player) => {
      return findTeam?.players?.find((p) => p.fullName === player.name);
    });

    const outGoingSalary =
      findGivenPlayers?.reduce((acc, player) => {
        return acc + (player?.contract?.salary || 0);
      }, 0) || 0;

    const inComingSalary =
      findReceivedPlayers?.reduce((acc, player) => {
        return acc + (player?.contract?.salary || 0);
      }, 0) || 0;

    const capDifference = inComingSalary - outGoingSalary;

    // Validate salary matching rules
    if (findTeam && outGoingSalary > 0 && inComingSalary > 0) {
      const secondApronSpace = findTeam.secondApronSpace || 0;
      const firstApronSpace = findTeam.firstApronSpace || 0;
      const capSpace = findTeam.capSpace || 0;

      // Calculate if trade would push team into/further into aprons
      const postTradeSecondApronSpace = secondApronSpace - capDifference;
      const postTradeFirstApronSpace = firstApronSpace - capDifference;

      // Check 1: Second Apron - Cannot receive more money than sent out
      // Applies if team is already over second apron OR trade would put them over
      const isOverSecondApron = secondApronSpace < 0;
      const wouldCrossSecondApron =
        secondApronSpace >= 0 && postTradeSecondApronSpace < 0;

      if ((isOverSecondApron || wouldCrossSecondApron) && capDifference > 0) {
        console.log(
          "INVALID TRADE - SECOND APRON",
          findTeam.displayName,
          "Cannot take on more salary"
        );
        isValidTrade = false;
        salaryRationale = `Warning: Invalid: ${findTeam.displayName} is over/would cross second apron and cannot take on additional salary`;
      }
      // Check 2: First Apron - Must match within 110% + $100K
      // Applies if team is already over first apron OR trade would put them over
      else {
        const isOverFirstApron = firstApronSpace < 0;
        const wouldCrossFirstApron =
          firstApronSpace >= 0 && postTradeFirstApronSpace < 0;
        const maxAllowedFirstApron = outGoingSalary * 1.1 + 100000;

        if (
          (isOverFirstApron || wouldCrossFirstApron) &&
          inComingSalary > maxAllowedFirstApron
        ) {
          console.log(
            "INVALID TRADE - FIRST APRON",
            findTeam.displayName,
            `Incoming: ${inComingSalary}, Max allowed: ${maxAllowedFirstApron}`
          );
          isValidTrade = false;
          salaryRationale = `Warning: Invalid: ${findTeam.displayName} exceeds 110% + $100K salary matching rule for first apron teams`;
        }
        // Check 3: Over cap but under aprons - Must match within 125% + $100K
        else if (capSpace < 0 && firstApronSpace >= 0) {
          const maxAllowedOverCap = outGoingSalary * 1.25 + 100000;

          if (inComingSalary > maxAllowedOverCap) {
            console.log(
              "INVALID TRADE - OVER CAP",
              findTeam.displayName,
              `Incoming: ${inComingSalary}, Max allowed: ${maxAllowedOverCap}`
            );
            isValidTrade = false;
            salaryRationale = `Warning: Invalid: ${findTeam.displayName} exceeds 125% + $100K salary matching rule for over-cap teams`;
          }
        }
      }
    }

    return {
      team: findTeam,
      playersReceived: findReceivedPlayers,
      picksReceived: enrichedPicks,
      outGoingSalary,
      inComingSalary,
      capDifference,
    };
  });

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
    <>
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-3 mb-4">
        <SaveTradeModal
          isLoading={false}
          tradeInfo={TradesWithInfo}
          isValidTrade={isValidTrade}
          selectedTeamIds={involvedTeams.map((t) => t.id)}
        />
        <Button
          variant="outline"
          className="w-full sm:w-auto border-white text-white bg-transparent hover:bg-white/10 transition-all duration-150 ease-in-out"
          onClick={() => onEditTrade(TradesWithInfo, involvedTeams)}
        >
          <PencilIcon className="mr-2 h-5 w-5" strokeWidth={1.5} />
          Edit Trade
        </Button>
      </div>
      {isValidTrade && (
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
        {TradesWithInfo.map((tradeInfo, index) => (
          <Card
            key={index}
            className="flex flex-col h-auto overflow-hidden border-indigoMain bg-gradient-to-br from-background via-background/95 to-muted/80 md:flex-1"
          >
            <CardHeader className="flex flex-row items-center justify-center space-y-0 pb-2 pt-4 px-4 bg-muted/60">
              <div className="flex items-center gap-2">
                {tradeInfo.team?.logos?.[0] && (
                  <Image
                    src={tradeInfo.team.logos[0].href}
                    alt={tradeInfo.team.logos[0].alt}
                    width={32}
                    height={32}
                    className="object-contain"
                  />
                )}
                <span className="text-lg font-semibold">
                  {tradeInfo.team?.displayName}
                </span>
              </div>
            </CardHeader>
            <div className="px-4 py-3 bg-muted/10 ">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">
                    Outgoing Salary
                  </div>
                  <div className="text-sm font-medium">
                    $
                    {tradeInfo.outGoingSalary
                      ? (tradeInfo.outGoingSalary / 1000000).toFixed(1)
                      : 0}
                    M
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">
                    Incoming Salary
                  </div>
                  <div className="text-sm font-medium">
                    $
                    {tradeInfo.inComingSalary
                      ? (tradeInfo.inComingSalary / 1000000).toFixed(1)
                      : 0}
                    M
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">
                    Cap Difference
                  </div>
                  <div
                    className={`text-sm font-medium ${
                      tradeInfo.inComingSalary && tradeInfo.outGoingSalary
                        ? (tradeInfo.inComingSalary -
                            tradeInfo.outGoingSalary) /
                            1000000 >
                          0
                          ? "text-red-500"
                          : (tradeInfo.inComingSalary -
                              tradeInfo.outGoingSalary) /
                              1000000 <
                            0
                          ? "text-green-500"
                          : "text-foreground"
                        : "text-foreground"
                    }`}
                  >
                    $
                    {tradeInfo.inComingSalary && tradeInfo.outGoingSalary
                      ? (
                          (tradeInfo.inComingSalary -
                            tradeInfo.outGoingSalary) /
                          1000000
                        ).toFixed(1)
                      : 0}
                    M
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
                          {tradeInfo.team?.totalCapAllocation
                            ? (
                                tradeInfo.team?.totalCapAllocation / 1000000
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
                              tradeInfo.team?.capSpace || 0,
                              tradeInfo.capDifference
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
                              tradeInfo.team?.firstApronSpace || 0,
                              tradeInfo.capDifference
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
                              tradeInfo.team?.secondApronSpace || 0,
                              tradeInfo.capDifference
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
                {tradeInfo.playersReceived &&
                  tradeInfo.playersReceived.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-3 text-sm font-medium text-muted-foreground">
                        <UsersIcon className="w-4 h-4" strokeWidth={1.5} />
                        Players Received
                      </div>
                      <div className="h-auto">
                        <div className="space-y-3">
                          {tradeInfo.playersReceived.map(
                            (player, playerIndex) => {
                              // Find which team this player came from
                              const fromTeam = involvedTeams.find((t) =>
                                t.players?.some((p) => p.id === player?.id)
                              );

                              return (
                                <div
                                  key={playerIndex}
                                  className="group relative flex items-center justify-between p-3 rounded-md border-2 border-border bg-slate-950 hover:border-indigoMain/50 cursor-pointer transition-colors"
                                  onClick={() =>
                                    player &&
                                    handleOpenPlayerStats(
                                      player,
                                      fromTeam?.color,
                                      fromTeam?.alternateColor
                                    )
                                  }
                                >
                                  <div className="flex items-center gap-3">
                                    {player?.headshot && (
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
                                        {player?.displayName}{" "}
                                        <span className="text-xs text-muted-foreground">
                                          (
                                          {player?.position?.abbreviation ||
                                            "Unknown"}
                                          )
                                        </span>
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {player?.contract
                                          ? `Salary: $${(
                                              player.contract.salary / 1000000
                                            ).toFixed(1)}M`
                                          : "No contract"}
                                        {" | "}
                                        {player?.contract?.yearsRemaining}
                                        {` ${
                                          player?.contract?.yearsRemaining === 1
                                            ? "yr"
                                            : "yrs"
                                        }`}
                                      </div>
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-indigoMain"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      player &&
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
                            }
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                {/* Picks Received */}
                {tradeInfo.picksReceived &&
                  tradeInfo.picksReceived.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-3 text-sm font-medium text-muted-foreground">
                        <FileTextIcon className="w-4 h-4 " strokeWidth={1.5} />
                        Picks Received
                      </div>
                      <div className="h-auto">
                        <div className="space-y-3">
                          {tradeInfo.picksReceived.map((pick, pickIndex) => {
                            const realPick = pick.draftPick;
                            const roundSuffix =
                              realPick?.round === 1
                                ? "st"
                                : realPick?.round === 2
                                ? "nd"
                                : "th";

                            return (
                              <div
                                key={pickIndex}
                                className="group relative flex items-center justify-between p-3 rounded-md border-2 border-border bg-slate-950"
                              >
                                <div className="flex flex-col gap-1">
                                  <div className="text-xs text-muted-foreground">
                                    from {pick?.from}
                                  </div>
                                  <div className="font-medium text-sm">
                                    {realPick
                                      ? `${realPick.year} ${realPick.round}${roundSuffix} Round Pick`
                                      : pick?.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {realPick?.isProtected && (
                                      <span className="text-amber-500 mr-2">
                                        Protected
                                      </span>
                                    )}
                                    {realPick?.isSwap && (
                                      <span className="text-blue-400 mr-2">
                                        Swap Rights
                                      </span>
                                    )}
                                    {realPick?.description ? (
                                      <span>{realPick.description}</span>
                                    ) : (
                                      <span>Draft pick</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                {/* No assets received */}
                {(!tradeInfo.playersReceived ||
                  tradeInfo.playersReceived.length === 0) &&
                  (!tradeInfo.picksReceived ||
                    tradeInfo.picksReceived.length === 0) && (
                    <div className="text-center py-6 text-muted-foreground">
                      <div className="text-sm">No assets received</div>
                    </div>
                  )}
              </div>
            </CardContent>
            {/* <CardFooter className="flex flex-col gap-2 px-4 pb-4">
            <div className="text-sm text-muted-foreground">
              <strong>Trade Rationale:</strong>{" "}
              {trade.teams[index]?.explanation}
            </div>
            <div className="text-sm text-muted-foreground">
              <strong>Salary Details:</strong> {trade.teams[index]?.salaryMatch}
            </div>
          </CardFooter> */}
          </Card>
        ))}
      </div>
      {!isValidTrade && (
        <div
          className="flex items-center gap-2 py-3 px-4 rounded-md border border-orange-500/50 bg-orange-500/10 text-orange-500
          justify-center w-full md:w-fit md:mx-0 md:justify-start"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <div className="text-sm font-medium">
            {salaryRationale || "Invalid trade"}
          </div>
        </div>
      )}

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
    </>
  );
}
