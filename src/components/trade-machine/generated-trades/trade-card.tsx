"use client";

import { useState } from "react";
import type {
  Team,
  TradeScenario,
  TradeInfo,
  EnrichedPick,
  Player,
  DraftPick,
} from "~/types";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { PencilIcon, BarChart3Icon } from "lucide-react";
import Image from "next/image";
import SaveTradeModal from "../save-trade-modal";
import { Button } from "~/components/ui/button";
import { SnapshotButton } from "~/components/ui/snapshot-button";
import { PlayerStatsModal } from "~/components/player-stats-modal";
import { useTradeSnapshot } from "~/hooks/use-trade-snapshot";
import {
  collectTradeWarnings,
  computeSubdeck,
  type TeamTradeMove,
} from "~/lib/trade-warnings";
import { TradeMasthead } from "../trade-masthead";

export default function TradeCard({
  trade,
  involvedTeams,
  onEditTrade,
  scenarioIndex,
  scenarioCount,
}: {
  trade: TradeScenario;
  involvedTeams: Team[];
  onEditTrade: (tradeToEdit: TradeInfo[], involvedTeams: Team[]) => void;
  scenarioIndex: number;
  scenarioCount: number;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<{
    player: Player;
    teamColor?: string;
    teamAltColor?: string;
  } | null>(null);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const { captureRef, capture, isCapturing } = useTradeSnapshot();

  const handleOpenPlayerStats = (
    player: Player,
    teamColor?: string,
    teamAltColor?: string
  ) => {
    setSelectedPlayer({ player, teamColor, teamAltColor });
    setIsStatsModalOpen(true);
  };

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

    // Parse year and round from the pick name (e.g., "2025 1st Round Pick" or "2026 R1")
    const pickName = pick.name;
    const yearMatch = pickName.match(/(\d{4})/);
    const roundMatch =
      pickName.match(/R(\d)/i) ||
      pickName.match(/(\d)(?:st|nd|rd|th)?\s*[Rr]ound/i);

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
      const playerName = player.name.toLowerCase().trim();

      // First try the team the AI says the player is from
      const findPlayerFromResponse = involvedTeams.find(
        (team) => team.displayName === player.from
      );
      const matchOnFromTeam = findPlayerFromResponse?.players?.find(
        (p) =>
          p.fullName.toLowerCase() === playerName ||
          p.displayName.toLowerCase() === playerName ||
          p.shortName.toLowerCase() === playerName
      );
      if (matchOnFromTeam) return matchOnFromTeam;

      // Fallback: search all involved teams (AI may have the wrong "from")
      for (const team of involvedTeams) {
        const match = team.players?.find(
          (p) =>
            p.fullName.toLowerCase() === playerName ||
            p.displayName.toLowerCase() === playerName ||
            p.shortName.toLowerCase() === playerName
        );
        if (match) return match;
      }

      return undefined;
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
      const playerName = player.name.toLowerCase().trim();

      // First try the team's own roster
      const matchOnTeam = findTeam?.players?.find(
        (p) =>
          p.fullName.toLowerCase() === playerName ||
          p.displayName.toLowerCase() === playerName ||
          p.shortName.toLowerCase() === playerName
      );
      if (matchOnTeam) return matchOnTeam;

      // Fallback: search all involved teams
      for (const team of involvedTeams) {
        const match = team.players?.find(
          (p) =>
            p.fullName.toLowerCase() === playerName ||
            p.displayName.toLowerCase() === playerName ||
            p.shortName.toLowerCase() === playerName
        );
        if (match) return match;
      }

      return undefined;
    });

    const enrichedGivesPicks: EnrichedPick[] | undefined =
      tradeTeam.gives?.picks?.map((pick) => {
        return mapPickToRealDraftPick(pick, findTeam);
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

    return {
      team: findTeam,
      playersReceived: findReceivedPlayers,
      picksReceived: enrichedPicks,
      playersSent: findGivenPlayers,
      picksSent: enrichedGivesPicks,
      outGoingSalary,
      inComingSalary,
      capDifference,
    };
  });

  // Normalize TradeInfo (with optional fields and EnrichedPicks) into the
  // strict TeamTradeMove shape the warnings collector expects.
  const moves: TeamTradeMove[] = TradesWithInfo
    .filter((info): info is TradeInfo & { team: Team } => !!info.team)
    .map((info) => ({
      team: info.team,
      playersSent: (info.playersSent || []).filter(
        (p): p is Player => !!p
      ),
      picksSent: (info.picksSent || [])
        .map((p) => p.draftPick)
        .filter((p): p is DraftPick => !!p),
      playersReceived: (info.playersReceived || []).filter(
        (p): p is Player => !!p
      ),
      picksReceived: (info.picksReceived || [])
        .map((p) => p.draftPick)
        .filter((p): p is DraftPick => !!p),
      outgoingSalary: info.outGoingSalary || 0,
      incomingSalary: info.inComingSalary || 0,
      capDifference: info.capDifference,
    }));

  const warnings = collectTradeWarnings(moves);
  const isValidTrade = !warnings.some((w) => w.severity === "blocker");
  const subdeck = computeSubdeck(moves);

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
      <div className="flex flex-row gap-2 sm:gap-3 mb-6">
        <SaveTradeModal
          isLoading={false}
          tradeInfo={TradesWithInfo}
          isValidTrade={isValidTrade}
          selectedTeamIds={involvedTeams.map((t) => t.id)}
        />
        <Button
          variant="edit"
          className="w-full sm:w-auto"
          onClick={() => onEditTrade(TradesWithInfo, involvedTeams)}
        >
          <PencilIcon className="mr-1 h-4 w-4" strokeWidth={1.5} />
          Edit
        </Button>
        <SnapshotButton onClick={capture} isCapturing={isCapturing} />
      </div>
      <div ref={captureRef}>
        <TradeMasthead
          eyebrow={`Scenario ${String(scenarioIndex + 1).padStart(2, "0")} / ${String(scenarioCount).padStart(2, "0")}`}
          subdeck={subdeck}
          warnings={warnings}
        />
      <div className={`flex flex-col gap-4 mb-4 md:grid ${
        TradesWithInfo.length > 3
          ? "md:overflow-x-auto md:pb-4"
          : ""
      }`}
        style={{
          gridTemplateColumns:
            TradesWithInfo.length <= 3
              ? `repeat(${TradesWithInfo.length}, 1fr)`
              : `repeat(${TradesWithInfo.length}, minmax(320px, 1fr))`,
        }}
      >
        {TradesWithInfo.map((tradeInfo, index) => (
          <Card
            key={index}
            className="flex flex-col h-auto overflow-hidden bg-surface-low"
          >
            <CardHeader className="flex flex-row items-center justify-center space-y-0 pt-6 pb-4 px-5 bg-surface-container">
              <div className="flex items-center justify-center gap-2.5 min-w-0 w-full">
                {tradeInfo.team?.logos?.[0] && (
                  <Image
                    src={tradeInfo.team.logos[0].href}
                    alt={tradeInfo.team.logos[0].alt}
                    width={36}
                    height={36}
                    className="object-contain"
                  />
                )}
                <span className="text-lg font-semibold tracking-tight whitespace-nowrap md:inline-block md:max-w-[220px] md:truncate">
                  {tradeInfo.team?.displayName}
                </span>
              </div>
            </CardHeader>
            <div className="px-5 py-4 bg-surface-low">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant mb-1.5">
                    Out
                  </p>
                  <p className="text-sm font-medium tabular-nums">
                    ${((tradeInfo.outGoingSalary ?? 0) / 1_000_000).toFixed(1)}M
                  </p>
                </div>
                <div className="text-center">
                  <p className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant mb-1.5">
                    In
                  </p>
                  <p className="text-sm font-medium tabular-nums">
                    ${((tradeInfo.inComingSalary ?? 0) / 1_000_000).toFixed(1)}M
                  </p>
                </div>
                <div className="text-center">
                  <p className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant mb-1.5">
                    Delta
                  </p>
                  <p
                    className={`text-sm font-medium tabular-nums ${
                      tradeInfo.capDifference > 0
                        ? "text-warning"
                        : tradeInfo.capDifference < 0
                          ? "text-primary"
                          : "text-foreground"
                    }`}
                  >
                    {tradeInfo.capDifference > 0 ? "+" : tradeInfo.capDifference < 0 ? "-" : ""}
                    ${(Math.abs(tradeInfo.capDifference) / 1_000_000).toFixed(1)}M
                  </p>
                </div>
              </div>
            </div>
            <CardContent className="px-5 pt-5 pb-6 flex-grow flex flex-col bg-surface-container">
              <Tabs defaultValue="receives" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="receives">Receives</TabsTrigger>
                  <TabsTrigger value="sends">Sends</TabsTrigger>
                </TabsList>

                <TabsContent value="receives" className="mt-0">
                  <div className="space-y-5">
                    {tradeInfo.playersReceived &&
                      tradeInfo.playersReceived.length > 0 && (
                        <div>
                          <p className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant mb-2.5">
                            Players
                          </p>
                          <div className="space-y-1.5">
                            {tradeInfo.playersReceived.map(
                              (player, playerIndex) => {
                                const fromTeam = involvedTeams.find((t) =>
                                  t.players?.some((p) => p.id === player?.id)
                                );

                                return (
                                  <div
                                    key={playerIndex}
                                    className="group relative flex items-center justify-between p-2.5 rounded-lg bg-surface-high transition-colors"
                                  >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                      {player?.headshot && (
                                        <div className="bg-surface-highest p-1 rounded-full shrink-0">
                                          <Image
                                            src={player.headshot.href}
                                            alt={player.displayName}
                                            width={96}
                                            height={96}
                                            className="rounded-full object-cover w-11 h-11"
                                          />
                                        </div>
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <div className="font-medium text-sm truncate">
                                          {player?.displayName}{" "}
                                          <span className="text-[11px] text-on-surface-variant whitespace-nowrap">
                                            {player?.position?.abbreviation || "—"}
                                            {player?.age ? ` · ${player.age}` : ""}
                                          </span>
                                        </div>
                                        <div className="text-[11px] text-on-surface-variant tabular-nums">
                                          {player?.contract
                                            ? `$${(player.contract.salary / 1_000_000).toFixed(1)}M`
                                            : "No contract"}
                                          {player?.contract?.yearsRemaining
                                            ? ` · ${player.contract.yearsRemaining} ${player.contract.yearsRemaining === 1 ? "yr" : "yrs"}`
                                            : ""}
                                        </div>
                                      </div>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 shrink-0 text-on-surface-variant hover:text-primary"
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
                      )}

                    {tradeInfo.picksReceived &&
                      tradeInfo.picksReceived.length > 0 && (
                        <div>
                          <p className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant mb-2.5">
                            Picks
                          </p>
                          <div className="space-y-1.5">
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
                                  className="group relative flex items-center justify-between p-2.5 rounded-lg bg-surface-high"
                                >
                                  <div className="flex flex-col gap-0.5">
                                    <div className="text-[11px] text-on-surface-variant">
                                      from {pick?.from}
                                    </div>
                                    <div className="font-medium text-sm">
                                      {realPick
                                        ? `${realPick.year} ${realPick.round}${roundSuffix} Round Pick`
                                        : pick?.name}
                                    </div>
                                    {(realPick?.isProtected ||
                                      realPick?.isSwap ||
                                      realPick?.description) && (
                                      <div className="text-[11px] text-on-surface-variant">
                                        {realPick?.isProtected && (
                                          <span className="mr-2">Protected</span>
                                        )}
                                        {realPick?.isSwap && (
                                          <span className="text-primary mr-2">
                                            Swap Rights
                                          </span>
                                        )}
                                        {realPick?.description && (
                                          <span>{realPick.description}</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    {(!tradeInfo.playersReceived ||
                      tradeInfo.playersReceived.length === 0) &&
                      (!tradeInfo.picksReceived ||
                        tradeInfo.picksReceived.length === 0) && (
                        <div className="text-center py-6 text-on-surface-variant">
                          <div className="text-sm">No assets received</div>
                        </div>
                      )}
                  </div>
                </TabsContent>

                <TabsContent value="sends" className="mt-0">
                  <div className="space-y-5">
                    {tradeInfo.playersSent &&
                      tradeInfo.playersSent.length > 0 && (
                        <div>
                          <p className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant mb-2.5">
                            Players
                          </p>
                          <div className="space-y-1.5">
                            {tradeInfo.playersSent.map(
                              (player, playerIndex) => (
                                <div
                                  key={playerIndex}
                                  className="group relative flex items-center justify-between p-2.5 rounded-lg bg-surface-high transition-colors"
                                >
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    {player?.headshot && (
                                      <div className="bg-surface-highest p-1 rounded-full shrink-0">
                                        <Image
                                          src={player.headshot.href}
                                          alt={player.displayName}
                                          width={96}
                                          height={96}
                                          className="rounded-full object-cover w-11 h-11"
                                        />
                                      </div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <div className="font-medium text-sm truncate">
                                        {player?.displayName}{" "}
                                        <span className="text-[11px] text-on-surface-variant whitespace-nowrap">
                                          {player?.position?.abbreviation || "—"}
                                          {player?.age ? ` · ${player.age}` : ""}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-on-surface-variant tabular-nums">
                                        {player?.contract
                                          ? `$${(player.contract.salary / 1_000_000).toFixed(1)}M`
                                          : "No contract"}
                                        {player?.contract?.yearsRemaining
                                          ? ` · ${player.contract.yearsRemaining} ${player.contract.yearsRemaining === 1 ? "yr" : "yrs"}`
                                          : ""}
                                      </div>
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0 text-on-surface-variant hover:text-primary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      player &&
                                        handleOpenPlayerStats(
                                          player,
                                          tradeInfo.team?.color,
                                          tradeInfo.team?.alternateColor
                                        );
                                    }}
                                  >
                                    <BarChart3Icon className="h-4 w-4" />
                                  </Button>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                    {tradeInfo.picksSent &&
                      tradeInfo.picksSent.length > 0 && (
                        <div>
                          <p className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant mb-2.5">
                            Picks
                          </p>
                          <div className="space-y-1.5">
                            {tradeInfo.picksSent.map((pick, pickIndex) => {
                              const realPick = pick.draftPick;
                              const roundSuffix =
                                realPick?.round === 1 ? "st" : realPick?.round === 2 ? "nd" : "th";
                              return (
                                <div
                                  key={pickIndex}
                                  className="group relative flex items-center justify-between p-2.5 rounded-lg bg-surface-high"
                                >
                                  <div className="flex flex-col gap-0.5">
                                    <div className="font-medium text-sm">
                                      {realPick
                                        ? `${realPick.year} ${realPick.round}${roundSuffix} Round Pick`
                                        : pick?.name}
                                    </div>
                                    {(realPick?.isProtected ||
                                      realPick?.isSwap ||
                                      realPick?.description) && (
                                      <div className="text-[11px] text-on-surface-variant">
                                        {realPick?.isProtected && (
                                          <span className="mr-2">Protected</span>
                                        )}
                                        {realPick?.isSwap && (
                                          <span className="text-primary mr-2">
                                            Swap Rights
                                          </span>
                                        )}
                                        {realPick?.description && (
                                          <span>{realPick.description}</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    {(!tradeInfo.playersSent || tradeInfo.playersSent.length === 0) &&
                      (!tradeInfo.picksSent || tradeInfo.picksSent.length === 0) && (
                        <div className="text-center py-6 text-on-surface-variant">
                          <div className="text-sm">No assets sent</div>
                        </div>
                      )}
                  </div>
                </TabsContent>
              </Tabs>

              {/* Updated Cap Position — flat block, no zebra. Rows separate
                  through whitespace alone, per the no-line rule. */}
              <div className="mt-6">
                <p className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant mb-2.5">
                  Updated Cap Position
                </p>
                <dl className="rounded-lg bg-surface-high px-3.5 py-3 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <dt className="text-on-surface-variant">Total Cap</dt>
                    <dd className="font-medium tabular-nums">
                      ${((tradeInfo.team?.totalCapAllocation ?? 0) / 1_000_000).toFixed(1)}M
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-on-surface-variant">Cap Space</dt>
                    <dd className="font-medium tabular-nums">
                      ${(calculateUpdatedTaxValue(tradeInfo.team?.capSpace ?? 0, tradeInfo.capDifference) / 1_000_000).toFixed(1)}M
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-on-surface-variant">1st Apron Space</dt>
                    <dd className="font-medium tabular-nums">
                      ${(calculateUpdatedTaxValue(tradeInfo.team?.firstApronSpace ?? 0, tradeInfo.capDifference) / 1_000_000).toFixed(1)}M
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-on-surface-variant">2nd Apron Space</dt>
                    <dd className="font-medium tabular-nums">
                      ${(calculateUpdatedTaxValue(tradeInfo.team?.secondApronSpace ?? 0, tradeInfo.capDifference) / 1_000_000).toFixed(1)}M
                    </dd>
                  </div>
                </dl>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      </div>{/* end captureRef */}

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
