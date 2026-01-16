"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { TeamSelectDropdown } from "../trade-machine/team-select-dropdown";
import { TeamCard } from "../trade-machine/team-card";
import { Button } from "~/components/ui/button";
import { LightbulbIcon, UsersIcon, PlayIcon } from "lucide-react";
import type { SelectedAsset, Team, TradeInfo, TradeScenario } from "~/types";
import { toast } from "sonner";
import { useState } from "react";
import Image from "next/image";
import { TradeLoader } from "../ui/trade-loader";
import TradeContainer from "./generated-trades/trade-container";
import {
  SelectedAssetsTrigger,
  SelectedAssetsContent,
} from "./selected-assets-panel";
import TryTradePreview from "./try-trade-preview";
import { TRADE_STORAGE_KEY } from "./save-trade-modal";

const MAX_TEAMS = 5;

interface TradeMachineClientProps {
  nbaTeams: Team[];
  initialTeamIds?: number[];
  initialAssets?: SelectedAsset[];
}

export default function TradeMachineClient({
  nbaTeams,
  initialTeamIds = [],
  initialAssets = [],
}: TradeMachineClientProps) {
  const [selectedTeams, setSelectedTeams] = useState<Team[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<SelectedAsset[]>([]);
  const [showTeamSelector, setShowTeamSelector] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("");
  const [generatedTrades, setGeneratedTrades] = useState<TradeScenario[]>([]);
  const [loadingGeneratedTrades, setLoadingGeneratedTrades] = useState(false);
  const [showTradeContainer, setShowTradeContainer] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [assetsExpanded, setAssetsExpanded] = useState(false);
  const [showTryTradePreview, setShowTryTradePreview] = useState(false);

  // Initialize from URL params (for editing saved trades)
  React.useEffect(() => {
    if (hasInitialized || initialTeamIds.length === 0) return;

    const loadInitialTeams = async () => {
      setIsLoading(true);
      try {
        const teamsWithRosters: Team[] = [];

        for (const teamId of initialTeamIds) {
          const response = await fetch(`/api/nba/team/${teamId}`);
          if (response.ok) {
            const responseData = await response.json();
            teamsWithRosters.push(responseData.data);
          }
        }

        setSelectedTeams(teamsWithRosters);
        setSelectedTeamIds(initialTeamIds);
        setSelectedAssets(initialAssets);
        const firstTeamId = initialTeamIds[0];
        if (firstTeamId !== undefined) {
          setActiveTab(firstTeamId.toString());
        }
      } catch (error) {
        console.error("Error loading initial teams:", error);
      } finally {
        setIsLoading(false);
        setHasInitialized(true);
      }
    };

    loadInitialTeams();
  }, [initialTeamIds, initialAssets, hasInitialized]);

  // Restore trade from localStorage (for users returning after sign-in)
  React.useEffect(() => {
    if (hasInitialized || initialTeamIds.length > 0) return;

    const restoreFromStorage = async () => {
      try {
        const stored = localStorage.getItem(TRADE_STORAGE_KEY);
        if (!stored) {
          setHasInitialized(true);
          return;
        }

        const pendingTrade = JSON.parse(stored);

        // Check if the stored trade is less than 1 hour old
        const oneHour = 60 * 60 * 1000;
        if (Date.now() - pendingTrade.timestamp > oneHour) {
          localStorage.removeItem(TRADE_STORAGE_KEY);
          setHasInitialized(true);
          return;
        }

        const { selectedAssets: storedAssets, selectedTeamIds: storedTeamIds } =
          pendingTrade;

        if (!storedAssets?.length || !storedTeamIds?.length) {
          localStorage.removeItem(TRADE_STORAGE_KEY);
          setHasInitialized(true);
          return;
        }

        setIsLoading(true);

        // Load teams with rosters
        const teamsWithRosters: Team[] = [];
        for (const teamId of storedTeamIds) {
          const response = await fetch(`/api/nba/team/${teamId}`);
          if (response.ok) {
            const responseData = await response.json();
            teamsWithRosters.push(responseData.data);
          }
        }

        if (teamsWithRosters.length > 0) {
          setSelectedTeams(teamsWithRosters);
          setSelectedTeamIds(storedTeamIds);
          setSelectedAssets(storedAssets);
          setActiveTab(storedTeamIds[0]?.toString() || "");
          // Show the try trade preview so user can save their trade
          setShowTryTradePreview(true);
        }

        // Clear the stored trade after restoring
        localStorage.removeItem(TRADE_STORAGE_KEY);
      } catch (error) {
        console.error("Error restoring trade from storage:", error);
        localStorage.removeItem(TRADE_STORAGE_KEY);
      } finally {
        setIsLoading(false);
        setHasInitialized(true);
      }
    };

    restoreFromStorage();
  }, [hasInitialized, initialTeamIds.length]);

  const handleTeamSelect = async (team: Team) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/nba/team/${team.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch team data");
      }
      const responseData = await response.json();
      const teamWithRoster = responseData.data;

      setSelectedTeams((prev) => {
        const newTeams = [...prev, teamWithRoster];
        setTimeout(() => setActiveTab(team.id.toString()), 0);
        return newTeams;
      });
      setSelectedTeamIds((prev) => [...prev, team.id]);
      setShowTeamSelector(false);
    } catch (error) {
      console.error("Error fetching team data:", error);
      toast.error("Failed to load team data. Please try again.");
    } finally {
      setIsLoading(false);
      setSelectedAssets([]);
    }
  };

  const handleRemoveTeam = (teamId: number) => {
    const isFirstTeamAndMultipleTeams =
      selectedTeamIds.length > 1 && selectedTeamIds[0] === teamId;
    setSelectedTeams((prev) => prev.filter((team) => team.id !== teamId));
    setSelectedTeamIds((prev) => prev.filter((id) => id !== teamId));
    setSelectedAssets((prev) =>
      prev.filter((asset) => {
        const team = selectedTeams.find((t) => t.id === teamId);
        if (!team) return true;

        if (asset.type === "player") {
          return !team.players?.some((p) => p.id === asset.id);
        } else {
          return !team.draftPicks?.some((p) => p.id === asset.id);
        }
      })
    );
    const getNextTabValue = !isFirstTeamAndMultipleTeams
      ? selectedTeams?.[0]?.id.toString()
      : selectedTeamIds?.[1]?.toString();

    setTimeout(() => setActiveTab(getNextTabValue || ""), 0);
  };

  const handleAssetSelect = (
    assetId: number,
    assetType: "player" | "pick",
    teamId: number,
    targetTeamId?: number
  ) => {
    setSelectedAssets((prev) => {
      const existingAsset = prev.find(
        (a) => a.id === assetId && a.type === assetType
      );
      if (existingAsset) {
        return prev.filter((a) => !(a.id === assetId && a.type === assetType));
      } else {
        return [
          ...prev,
          { id: assetId, type: assetType, teamId, targetTeamId },
        ];
      }
    });
  };

  const handleClearAllAssets = () => {
    setSelectedAssets([]);
  };

  const handleGenerateTrade = async () => {
    setLoadingGeneratedTrades(true);

    let randomTeamsForMockTrades: Team[] = [];

    if (selectedTeams.length === 1) {
      const copyOfNbaTeams = [...nbaTeams];

      randomTeamsForMockTrades = copyOfNbaTeams
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);
    }

    const trade = {
      teams: selectedTeams,
      selectedAssets: selectedAssets,
      additionalTeams:
        randomTeamsForMockTrades.length > 0 ? randomTeamsForMockTrades : null,
    };

    try {
      const response = await fetch("/api/trades/generate", {
        method: "POST",
        body: JSON.stringify(trade),
      });
      const data: any = await response.json();

      setGeneratedTrades(data.data.trades);
      const copyOfSelectedTeams = [...selectedTeams];
      const teamsAddedToTrade = data.data.teamsAddedToTrade;
      const teamsToAddToTrade = [...copyOfSelectedTeams, ...teamsAddedToTrade];
      setSelectedTeams(teamsToAddToTrade);
    } catch (error) {
      console.error("Error generating trade:", error);
      toast.error("Failed to generate trade. Please try again.");
    } finally {
      setLoadingGeneratedTrades(false);
      setShowTradeContainer(true);
    }
  };

  const isTradeButtonActive = selectedAssets.length > 0;

  // Check if Try Trade button should be enabled:
  // - At least 2 teams selected
  // - At least one asset selected from each team
  const isTryTradeEnabled = (() => {
    if (selectedTeams.length < 2) return false;

    // Check that each team has at least one asset being traded away
    const teamsWithAssets = new Set(selectedAssets.map((a) => a.teamId));

    // All selected teams must have at least one asset
    return selectedTeams.every((team) => teamsWithAssets.has(team.id));
  })();

  const handleEditTrade = (tradeToEdit: TradeInfo[], involvedTeams: Team[]) => {
    // Build selected assets from the trade info
    // Each team in tradeToEdit has playersReceived - we need to find where each player came FROM
    // and set that as the teamId, with the receiving team as targetTeamId
    const newSelectedAssets: SelectedAsset[] = [];
    const teamIdsSet = new Set<number>();

    tradeToEdit.forEach((tradeInfo) => {
      const receivingTeam = tradeInfo.team;
      if (!receivingTeam?.id) return;

      // Add receiving team to the set
      teamIdsSet.add(receivingTeam.id);

      // Process players received by this team
      tradeInfo.playersReceived?.forEach((player) => {
        if (!player?.id) return;

        // Find which team this player originally belongs to
        const originalTeam = involvedTeams.find((team) =>
          team.players?.some((p) => p.id === player.id)
        );

        if (originalTeam?.id) {
          teamIdsSet.add(originalTeam.id);
          newSelectedAssets.push({
            id: player.id,
            type: "player",
            teamId: originalTeam.id,
            targetTeamId: receivingTeam.id,
          });
        }
      });

      // Process picks received by this team
      tradeInfo.picksReceived?.forEach((pick) => {
        if (!pick?.from) return;

        // Find the team that originally owned this pick
        const originalTeam = involvedTeams.find(
          (team) => team.displayName === pick.from
        );

        if (originalTeam?.id) {
          teamIdsSet.add(originalTeam.id);

          // Find the draft pick ID from the original team's draft picks
          const draftPick = originalTeam.draftPicks?.find((dp) => {
            // Match by year and round from the pick name (e.g., "2025 1st Round Pick")
            const pickName = pick.name || "";
            const yearMatch = pickName.match(/(\d{4})/);
            const roundMatch = pickName.match(
              /(\d)(?:st|nd|rd|th)?\s*[Rr]ound/i
            );

            if (yearMatch?.[1] && roundMatch?.[1]) {
              const year = parseInt(yearMatch[1]);
              const round = parseInt(roundMatch[1]);
              return dp.year === year && dp.round === round;
            }
            return false;
          });

          if (draftPick?.id) {
            newSelectedAssets.push({
              id: draftPick.id,
              type: "pick",
              teamId: originalTeam.id,
              targetTeamId: receivingTeam.id,
            });
          }
        }
      });
    });

    const newSelectedTeamIds = Array.from(teamIdsSet);

    setSelectedAssets(newSelectedAssets);
    setSelectedTeamIds(newSelectedTeamIds);
    setSelectedTeams(involvedTeams.filter((t) => teamIdsSet.has(t.id)));
    setActiveTab(newSelectedTeamIds[0]?.toString() || "");
    setShowTradeContainer(false);
    setGeneratedTrades([]);
  };

  if (loadingGeneratedTrades) {
    return <TradeLoader />;
  }

  if (generatedTrades.length > 0 && showTradeContainer) {
    return (
      <TradeContainer
        tradesData={generatedTrades}
        involvedTeams={selectedTeams}
        onBack={() => {
          setGeneratedTrades([]);
          setShowTradeContainer(false);
          setSelectedAssets([]);
          setSelectedTeamIds([]);
          setSelectedAssets([]);
          setSelectedTeams([]);
          setActiveTab("");
        }}
        onEditTrade={handleEditTrade}
      />
    );
  }

  if (showTryTradePreview) {
    return (
      <TryTradePreview
        selectedTeams={selectedTeams}
        selectedAssets={selectedAssets}
        onBack={() => setShowTryTradePreview(false)}
      />
    );
  }

  return (
    <div className="flex-grow">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-6">
        <div className="my-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <TeamSelectDropdown
            allTeams={nbaTeams}
            selectedTeamIds={selectedTeamIds}
            onTeamSelect={handleTeamSelect}
            maxTeamsReached={selectedTeams.length >= MAX_TEAMS}
            isLoading={isLoading}
          />
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto sm:justify-end">
            {generatedTrades.length > 0 && (
              <Button
                onClick={() => setShowTradeContainer(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 text-primary-white hover:bg-green-700
                         transition-all duration-150 ease-in-out"
              >
                <UsersIcon className="h-4 w-4" strokeWidth={1.5} />
                <span>View Generated Trades ({generatedTrades.length})</span>
              </Button>
            )}
            <Button
              disabled={!isTryTradeEnabled}
              onClick={() => setShowTryTradePreview(true)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 text-primary-white hover:bg-emerald-700
                         disabled:bg-muted disabled:text-muted-foreground/70 disabled:border disabled:border-muted-foreground/30 disabled:cursor-not-allowed
                         transition-all duration-150 ease-in-out"
            >
              <PlayIcon className="h-4 w-4" strokeWidth={1.5} />
              <span>Try Trade</span>
            </Button>
            <Button
              disabled={!isTradeButtonActive}
              onClick={handleGenerateTrade}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigoMain text-primary-white hover:bg-indigoMain/70
                         disabled:bg-muted disabled:text-muted-foreground/70 disabled:border disabled:border-muted-foreground/30 disabled:cursor-not-allowed
                         transition-all duration-150 ease-in-out"
            >
              <LightbulbIcon className="h-4 w-4" strokeWidth={1.5} />
              <span>Generate Trade</span>
            </Button>
            <SelectedAssetsTrigger
              selectedAssets={selectedAssets}
              isOpen={assetsExpanded}
              onToggle={() => setAssetsExpanded(!assetsExpanded)}
            />
            {/* Mobile: Selected Assets Content appears after all buttons */}
            <div className="w-full sm:hidden">
              <SelectedAssetsContent
                selectedAssets={selectedAssets}
                selectedTeams={selectedTeams}
                onRemoveAsset={(assetId, assetType) =>
                  handleAssetSelect(
                    assetId,
                    assetType,
                    selectedAssets.find(
                      (a) => a.id === assetId && a.type === assetType
                    )?.teamId || 0
                  )
                }
                onClearAll={handleClearAllAssets}
                isOpen={assetsExpanded}
              />
            </div>
          </div>
        </div>

        {/* Desktop: Selected Assets Content appears below buttons row with margin before team cards */}
        <div className={`hidden sm:block ${assetsExpanded ? "mb-6" : ""}`}>
          <SelectedAssetsContent
            selectedAssets={selectedAssets}
            selectedTeams={selectedTeams}
            onRemoveAsset={(assetId, assetType) =>
              handleAssetSelect(
                assetId,
                assetType,
                selectedAssets.find(
                  (a) => a.id === assetId && a.type === assetType
                )?.teamId || 0
              )
            }
            onClearAll={handleClearAllAssets}
            isOpen={assetsExpanded}
          />
        </div>

        <>
          {selectedTeams.length > 0 ? (
            <>
              {/* Mobile Tabs - Only show when 2 or more teams */}
              {selectedTeams.length >= 2 && (
                <div className="md:hidden mb-4">
                  <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    defaultValue={selectedTeams[0]?.id.toString()}
                    className="w-full "
                  >
                    <TabsList
                      className="w-full grid h-16 "
                      style={{
                        gridTemplateColumns: `repeat(${selectedTeams.length}, 1fr)`,
                      }}
                    >
                      {selectedTeams.map((team) => (
                        <TabsTrigger
                          key={team.id}
                          value={team.id.toString()}
                          className="p-2 flex items-center justify-center"
                        >
                          {team.logos[0] ? (
                            <Image
                              src={team.logos[0].href}
                              alt={team.logos[0].alt}
                              width={32}
                              height={32}
                              className="object-contain"
                            />
                          ) : (
                            <span className="text-xs">{team.displayName}</span>
                          )}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {selectedTeams.map((team) => (
                      <TabsContent key={team.id} value={team.id.toString()}>
                        <TeamCard
                          team={team}
                          allTeams={nbaTeams}
                          selectedTeamIdsInMachine={selectedTeamIds}
                          onRemoveTeam={handleRemoveTeam}
                          selectedAssets={selectedAssets.filter(
                            (sa) => sa.teamId === team.id
                          )}
                          onAssetSelect={handleAssetSelect}
                          setSelectedTeams={setSelectedTeams}
                          setSelectedTeamIds={setSelectedTeamIds}
                          setSelectedAssets={setSelectedAssets}
                          setActiveTab={setActiveTab}
                        />
                      </TabsContent>
                    ))}
                  </Tabs>
                </div>
              )}

              {/* Single Team View - Mobile */}
              {selectedTeams.length === 1 && selectedTeams[0] && (
                <div className="md:hidden">
                  <TeamCard
                    team={selectedTeams[0]}
                    allTeams={nbaTeams}
                    selectedTeamIdsInMachine={selectedTeamIds}
                    onRemoveTeam={handleRemoveTeam}
                    selectedAssets={selectedAssets.filter(
                      (sa) => sa.teamId === selectedTeams[0]?.id
                    )}
                    onAssetSelect={handleAssetSelect}
                    setSelectedTeams={setSelectedTeams}
                    setSelectedTeamIds={setSelectedTeamIds}
                    setSelectedAssets={setSelectedAssets}
                    setActiveTab={setActiveTab}
                  />
                </div>
              )}

              {/* Desktop Grid */}
              <div
                className="hidden md:grid gap-4 md:gap-6"
                style={{
                  gridTemplateColumns:
                    selectedTeams.length === 1
                      ? "repeat(2, 1fr)"
                      : selectedTeams.length === 2
                      ? "repeat(2, 1fr)"
                      : selectedTeams.length === 3
                      ? "repeat(3, 1fr)"
                      : selectedTeams.length === 4
                      ? "repeat(4, 1fr)"
                      : "repeat(5, 1fr)",
                }}
              >
                {selectedTeams.map((team) => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    allTeams={nbaTeams}
                    selectedTeamIdsInMachine={selectedTeamIds}
                    onRemoveTeam={handleRemoveTeam}
                    selectedAssets={selectedAssets.filter(
                      (sa) => sa.teamId === team.id
                    )}
                    onAssetSelect={handleAssetSelect}
                    setSelectedTeams={setSelectedTeams}
                    setSelectedTeamIds={setSelectedTeamIds}
                    setSelectedAssets={setSelectedAssets}
                    setActiveTab={setActiveTab}
                  />
                ))}
                {selectedTeams.length === 1 && (
                  <div className="flex flex-col border rounded-lg overflow-hidden">
                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-muted rounded-lg bg-muted/5 m-4">
                      <UsersIcon
                        className="w-12 h-12 text-muted-foreground mb-3"
                        strokeWidth={1.5}
                      />
                      <h3 className="text-lg font-semibold text-foreground mb-1">
                        Add Another Team
                      </h3>
                      <p className="text-sm text-muted-foreground text-center mb-4">
                        Generate a trade by selecting a player/pick or expand
                        your trade by adding more teams
                      </p>
                      <TeamSelectDropdown
                        allTeams={nbaTeams}
                        selectedTeamIds={selectedTeamIds}
                        onTeamSelect={handleTeamSelect}
                        maxTeamsReached={selectedTeams.length >= MAX_TEAMS}
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center p-8 border rounded-lg bg-muted/50">
              <LightbulbIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Teams Selected</h3>
              <p className="text-muted-foreground mb-4">
                Add teams to start building your trade
              </p>
            </div>
          )}
        </>

        {showTeamSelector && (
          <TeamSelectDropdown
            allTeams={nbaTeams.filter(
              (team) => !selectedTeamIds.includes(team.id)
            )}
            selectedTeamIds={selectedTeamIds}
            onTeamSelect={handleTeamSelect}
            maxTeamsReached={selectedTeams.length >= MAX_TEAMS}
          />
        )}
      </div>
    </div>
  );
}
