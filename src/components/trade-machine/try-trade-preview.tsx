"use client";

import { useState } from "react";
import { ArrowLeft, PencilIcon, BarChart3Icon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { SnapshotButton } from "~/components/ui/snapshot-button";
import Image from "next/image";
import type { SelectedAsset, Team, Player, DraftPick } from "~/types";
import SaveTradeModal from "./save-trade-modal";
import { PlayerStatsModal } from "~/components/player-stats-modal";
import { useTradeSnapshot } from "~/hooks/use-trade-snapshot";
import {
  collectTradeWarnings,
  computeSubdeck,
} from "~/lib/trade-warnings";
import { TradeMasthead } from "./trade-masthead";

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

const formatM = (value: number) => {
  const millions = value / 1_000_000;
  const prefix = millions < 0 ? "-" : "";
  return `${prefix}$${Math.abs(millions).toFixed(1)}M`;
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
  const { captureRef, capture, isCapturing } = useTradeSnapshot();

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
      const playersSent: Player[] = [];
      const picksSent: DraftPick[] = [];
      const playersReceived: Player[] = [];
      const picksReceived: DraftPick[] = [];

      selectedAssets.forEach((asset) => {
        if (asset.type === "player") {
          const sourceTeam = selectedTeams.find((t) => t.id === asset.teamId);
          const player = sourceTeam?.players?.find((p) => p.id === asset.id);

          if (player) {
            if (asset.teamId === team.id) playersSent.push(player);
            if (asset.targetTeamId === team.id) playersReceived.push(player);
          }
        } else if (asset.type === "pick") {
          const sourceTeam = selectedTeams.find((t) => t.id === asset.teamId);
          const pick = sourceTeam?.draftPicks?.find((p) => p.id === asset.id);

          if (pick) {
            if (asset.teamId === team.id) picksSent.push(pick);
            if (asset.targetTeamId === team.id) picksReceived.push(pick);
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

  // All trade warnings — blockers + soft notes — surface in one banner.
  // `isValid` is reserved for hard blockers so Save remains allowed when only
  // soft warnings (e.g. roster imbalance) are present.
  const warnings = collectTradeWarnings(tradeInfo);
  const isValid = !warnings.some((w) => w.severity === "blocker");
  const subdeck = computeSubdeck(tradeInfo);

  // Build TradeInfo format for SaveTradeModal
  const tradeInfoForModal = tradeInfo.map((info) => ({
    team: info.team,
    playersReceived: info.playersReceived,
    picksReceived: info.picksReceived.map((pick) => {
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
        id: pick.id,
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
            className="text-on-surface-variant w-full sm:w-auto p-0 h-auto hover:text-white hover:bg-transparent justify-start sm:justify-center"
          >
            <ArrowLeft className="text-indigoMain mr-2" />
            Back to Trade Machine
          </Button>
        </div>

        <div className="flex flex-row gap-2 sm:gap-3 mb-6">
          <SaveTradeModal
            isLoading={false}
            tradeInfo={tradeInfoForModal}
            isValidTrade={isValid}
            selectedAssets={selectedAssets}
            selectedTeamIds={selectedTeams.map((t) => t.id)}
          />
          <Button
            variant="edit"
            className="w-full sm:w-auto"
            onClick={onBack}
          >
            <PencilIcon className="mr-1 h-4 w-4" strokeWidth={1.5} />
            Edit
          </Button>
          <SnapshotButton onClick={capture} isCapturing={isCapturing} />
        </div>

        <div ref={captureRef}>
          <TradeMasthead
            eyebrow="Your Proposal"
            subdeck={subdeck}
            warnings={warnings}
          />

        <div className={`flex flex-col gap-4 mb-4 md:grid ${
          tradeInfo.length > 3
            ? "md:overflow-x-auto md:pb-4"
            : ""
        }`}
          style={{
            gridTemplateColumns:
              tradeInfo.length <= 3
                ? `repeat(${tradeInfo.length}, 1fr)`
                : `repeat(${tradeInfo.length}, minmax(320px, 1fr))`,
          }}
        >
          {tradeInfo.map((info, index) => (
            <Card
              key={index}
              className="flex flex-col h-auto overflow-hidden bg-surface-low"
            >
              <CardHeader className="flex flex-row items-center justify-center space-y-0 pt-6 pb-4 px-5 bg-surface-container">
                <div className="flex items-center justify-center gap-2.5 min-w-0 w-full">
                  {info.team.logos?.[0] && (
                    <Image
                      src={info.team.logos[0].href}
                      alt={info.team.logos[0].alt}
                      width={36}
                      height={36}
                      className="object-contain"
                    />
                  )}
                  <span className="text-lg font-semibold tracking-tight whitespace-nowrap md:inline-block md:max-w-[220px] md:truncate">
                    {info.team.displayName}
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
                      {formatM(info.outgoingSalary)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant mb-1.5">
                      In
                    </p>
                    <p className="text-sm font-medium tabular-nums">
                      {formatM(info.incomingSalary)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant mb-1.5">
                      Delta
                    </p>
                    <p
                      className={`text-sm font-medium tabular-nums ${
                        info.capDifference > 0
                          ? "text-warning"
                          : info.capDifference < 0
                            ? "text-primary"
                            : "text-foreground"
                      }`}
                    >
                      {info.capDifference > 0 ? "+" : ""}
                      {formatM(info.capDifference)}
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
                      {info.playersReceived.length > 0 && (
                        <div>
                          <p className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant mb-2.5">
                            Players
                          </p>
                          <div className="space-y-1.5">
                            {info.playersReceived.map((player, playerIndex) => {
                              const fromTeam = selectedTeams.find((t) =>
                                t.players?.some((p) => p.id === player.id)
                              );

                              return (
                                <div
                                  key={playerIndex}
                                  className="group relative flex items-center justify-between p-2.5 rounded-lg bg-surface-high transition-colors"
                                >
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    {player.headshot && (
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
                                        {player.displayName}{" "}
                                        <span className="text-[11px] text-on-surface-variant whitespace-nowrap">
                                          {player.position?.abbreviation || "—"}
                                          {player.age ? ` · ${player.age}` : ""}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-on-surface-variant tabular-nums">
                                        {player.contract
                                          ? formatM(player.contract.salary)
                                          : "No contract"}
                                        {player.contract?.yearsRemaining
                                          ? ` · ${player.contract.yearsRemaining} ${player.contract.yearsRemaining === 1 ? "yr" : "yrs"}`
                                          : ""}
                                        {fromTeam && fromTeam.id !== info.team.id
                                          ? ` · from ${fromTeam.abbreviation}`
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

                      {info.picksReceived.length > 0 && (
                        <div>
                          <p className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant mb-2.5">
                            Picks
                          </p>
                          <div className="space-y-1.5">
                            {info.picksReceived.map((pick, pickIndex) => {
                              const fromTeam = selectedTeams.find((t) =>
                                t.draftPicks?.some((p) => p.id === pick.id)
                              );

                              return (
                                <div
                                  key={pickIndex}
                                  className="group relative flex items-center justify-between p-2.5 rounded-lg bg-surface-high"
                                >
                                  <div className="flex flex-col gap-0.5">
                                    {fromTeam && fromTeam.id !== info.team.id && (
                                      <div className="text-[11px] text-on-surface-variant">
                                        from {fromTeam.abbreviation}
                                      </div>
                                    )}
                                    <div className="font-medium text-sm">
                                      {pick.year} {pick.round === 1 ? "1st" : "2nd"}{" "}
                                      Round {pick.isSwap ? "Pick Swap" : "Pick"}
                                    </div>
                                    {pick.description && (
                                      <div className="text-[11px] text-on-surface-variant">
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

                      {info.playersReceived.length === 0 &&
                        info.picksReceived.length === 0 && (
                          <div className="text-center py-6 text-on-surface-variant">
                            <div className="text-sm">No assets received</div>
                          </div>
                        )}
                    </div>
                  </TabsContent>

                  <TabsContent value="sends" className="mt-0">
                    <div className="space-y-5">
                      {info.playersSent.length > 0 && (
                        <div>
                          <p className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant mb-2.5">
                            Players
                          </p>
                          <div className="space-y-1.5">
                            {info.playersSent.map((player, playerIndex) => (
                              <div
                                key={playerIndex}
                                className="group relative flex items-center justify-between p-2.5 rounded-lg bg-surface-high transition-colors"
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  {player.headshot && (
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
                                      {player.displayName}{" "}
                                      <span className="text-[11px] text-on-surface-variant whitespace-nowrap">
                                        {player.position?.abbreviation || "—"}
                                        {player.age ? ` · ${player.age}` : ""}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-on-surface-variant tabular-nums">
                                      {player.contract
                                        ? formatM(player.contract.salary)
                                        : "No contract"}
                                      {player.contract?.yearsRemaining
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
                                    handleOpenPlayerStats(
                                      player,
                                      info.team.color,
                                      info.team.alternateColor
                                    );
                                  }}
                                >
                                  <BarChart3Icon className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {info.picksSent.length > 0 && (
                        <div>
                          <p className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant mb-2.5">
                            Picks
                          </p>
                          <div className="space-y-1.5">
                            {info.picksSent.map((pick, pickIndex) => (
                              <div
                                key={pickIndex}
                                className="group relative flex items-center justify-between p-2.5 rounded-lg bg-surface-high"
                              >
                                <div className="flex flex-col gap-0.5">
                                  <div className="font-medium text-sm">
                                    {pick.year} {pick.round === 1 ? "1st" : "2nd"}{" "}
                                    Round {pick.isSwap ? "Pick Swap" : "Pick"}
                                  </div>
                                  {pick.description && (
                                    <div className="text-[11px] text-on-surface-variant">
                                      {pick.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {info.playersSent.length === 0 &&
                        info.picksSent.length === 0 && (
                          <div className="text-center py-6 text-on-surface-variant">
                            <div className="text-sm">No assets sent</div>
                          </div>
                        )}
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="mt-6">
                  <p className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant mb-2.5">
                    Updated Cap Position
                  </p>
                  <dl className="rounded-lg bg-surface-high px-3.5 py-3 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <dt className="text-on-surface-variant">Total Cap</dt>
                      <dd className="font-medium tabular-nums">
                        {formatM(info.team.totalCapAllocation ?? 0)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-on-surface-variant">Cap Space</dt>
                      <dd className="font-medium tabular-nums">
                        {formatM(calculateUpdatedTaxValue(info.team.capSpace ?? 0, info.capDifference))}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-on-surface-variant">1st Apron Space</dt>
                      <dd className="font-medium tabular-nums">
                        {formatM(calculateUpdatedTaxValue(info.team.firstApronSpace ?? 0, info.capDifference))}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-on-surface-variant">2nd Apron Space</dt>
                      <dd className="font-medium tabular-nums">
                        {formatM(calculateUpdatedTaxValue(info.team.secondApronSpace ?? 0, info.capDifference))}
                      </dd>
                    </div>
                  </dl>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        </div>{/* end captureRef */}
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
