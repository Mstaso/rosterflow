"use client";

import { useState, useCallback } from "react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { RefreshCw } from "lucide-react";
import type { NBATeam, NBAPlayer } from "~/lib/nba-types";
import SelectPlayersTab from "~/components/select-players-tab";
import TradeResultsTab from "~/components/trade-results-tab";
import { useApi, useGenerateTrades } from "~/hooks/useApi";

interface SelectedAsset {
  id: string;
  type: "player" | "pick";
  fromTeam: string;
  toTeam: string;
  data: unknown;
}

interface TeamRosterData {
  players: NBAPlayer[];
  isLoading: boolean;
  error?: string;
}

interface TradeGeneratorProps {
  nbaTeams?: NBATeam[];
}

export default function TradeGenerator({ nbaTeams = [] }: TradeGeneratorProps) {
  const [selectedSport] = useState("NBA");
  const [selectedTeams, setSelectedTeams] = useState<string[]>([""]);
  const [selectedAssets, setSelectedAssets] = useState<SelectedAsset[]>([]);
  const [teamRosterData, setTeamRosterData] = useState<
    Record<string, TeamRosterData>
  >({});
  const [activeTab, setActiveTab] = useState<string>("select");

  // Use the trade generation hook
  const {
    data: trades,
    loading: isGeneratingTrades,
    error: tradesError,
    generateTrades,
  } = useGenerateTrades();

  const MAX_TEAMS = 5;

  const sportData = {
    teams: nbaTeams.map((team) => ({
      id: team.id.toString(),
      name: team.displayName,
    })),
  };

  // Create a reusable api instance for fetching team rosters
  const { fetchData: fetchRosterData } = useApi<{
    team: any;
    roster: Array<{
      id: string;
      displayName: string;
      position?: { abbreviation: string };
      contract?: { salary: number };
      [key: string]: any;
    }>;
    rosterCount: number;
    season: string;
  }>(null, { immediate: false });

  const fetchTeamRoster = useCallback(
    async (teamId: string): Promise<void> => {
      if (teamRosterData[teamId]) return;

      setTeamRosterData((prev) => ({
        ...prev,
        [teamId]: { players: [], isLoading: true },
      }));

      try {
        // Use the hook's fetchData method with the specific team URL
        const data = await fetchRosterData(
          `/api/espn/nba/team/${teamId}/roster`,
        );

        if (data?.roster) {
          setTeamRosterData((prev) => ({
            ...prev,
            [teamId]: {
              players: data.roster,
              isLoading: false,
            },
          }));
        } else {
          throw new Error("Failed to load roster data");
        }
      } catch (error) {
        console.error("Error fetching roster:", error);
        setTeamRosterData((prev) => ({
          ...prev,
          [teamId]: {
            players: [],
            isLoading: false,
            error: error instanceof Error ? error.message : "Unknown error",
          },
        }));
      }
    },
    [teamRosterData, fetchRosterData],
  );

  const addTeam = () => {
    if (selectedTeams.length < MAX_TEAMS) {
      setSelectedTeams([...selectedTeams, ""]);
    }
  };

  const removeTeam = (index: number) => {
    if (selectedTeams.length > 1) {
      const teamId = selectedTeams[index];
      const newTeams = selectedTeams.filter((_, i) => i !== index);
      setSelectedTeams(newTeams);

      if (teamId) {
        setSelectedAssets((prev) =>
          prev.filter(
            (asset) => asset.fromTeam !== teamId && asset.toTeam !== teamId,
          ),
        );
      }
    }
  };

  const updateTeam = async (index: number, teamId: string) => {
    const oldTeamId = selectedTeams[index];
    const newTeams = [...selectedTeams];
    newTeams[index] = teamId;
    setSelectedTeams(newTeams);

    if (oldTeamId) {
      setSelectedAssets((prev) =>
        prev.filter(
          (asset) => asset.fromTeam !== oldTeamId && asset.toTeam !== oldTeamId,
        ),
      );
    }

    if (teamId && teamId !== oldTeamId) {
      await fetchTeamRoster(teamId);
    }
  };

  const toggleAsset = (
    assetId: string,
    type: "player" | "pick",
    fromTeam: string,
    data: unknown,
  ) => {
    setSelectedAssets((prev) => {
      const existingIndex = prev.findIndex((asset) => asset.id === assetId);

      if (existingIndex >= 0) {
        return prev.filter((_, index) => index !== existingIndex);
      } else {
        const availableTeams = selectedTeams.filter(
          (team) => team !== "" && team !== fromTeam,
        );
        const defaultToTeam =
          availableTeams.length > 0 ? availableTeams[0]! : "";

        return [
          ...prev,
          {
            id: assetId,
            type,
            fromTeam,
            toTeam: defaultToTeam,
            data,
          },
        ];
      }
    });
  };

  const updateAssetDestination = (assetId: string, toTeam: string) => {
    setSelectedAssets((prev) =>
      prev.map((asset) =>
        asset.id === assetId ? { ...asset, toTeam } : asset,
      ),
    );
  };

  const getAvailableDestinations = (fromTeam: string) => {
    return selectedTeams.filter((team) => team !== "" && team !== fromTeam);
  };

  const isAssetSelected = (assetId: string) => {
    return selectedAssets.some((asset) => asset.id === assetId);
  };

  const getAssetDestination = (assetId: string) => {
    const asset = selectedAssets.find((asset) => asset.id === assetId);
    return asset?.toTeam || "";
  };

  const canTryTrade = () => {
    const teamsWithAssets = new Set(
      selectedAssets.map((asset) => asset.fromTeam),
    );
    return (
      selectedAssets.length > 0 &&
      teamsWithAssets.size >= 1 &&
      selectedAssets.every((asset) => asset.toTeam !== "")
    );
  };

  const generateAutoTrades = async () => {
    if (!canTryTrade()) return;

    try {
      const allTeams = Array.from(
        new Set([
          ...selectedAssets.map((asset) => asset.fromTeam),
          ...selectedAssets.map((asset) => asset.toTeam),
        ]),
      ).filter(Boolean);

      const destinationPreferences: Record<string, string[]> = {};
      selectedAssets.forEach((asset) => {
        if (!destinationPreferences[asset.fromTeam]) {
          destinationPreferences[asset.fromTeam] = [];
        }
        if (
          asset.toTeam &&
          !destinationPreferences[asset.fromTeam]!.includes(asset.toTeam)
        ) {
          destinationPreferences[asset.fromTeam]!.push(asset.toTeam);
        }
      });

      // Use the hook to generate trades
      await generateTrades({
        assets: selectedAssets,
        teams: allTeams,
        destinationPreferences,
        sport: selectedSport,
      });

      // Switch to results tab after successful generation
      setActiveTab("results");
    } catch (error) {
      console.error("Error generating trades:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to generate trades. Please try again.",
      );
    }
  };

  const formatSalary = (salary: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(salary);
  };

  const getTeamName = (teamId: string) => {
    const team = sportData.teams.find((t) => t.id === teamId);
    return team?.name || "Unknown Team";
  };

  const getTeamPlayers = (
    teamId: string,
  ): Array<{
    id: string;
    name: string;
    position: string;
    salary: number;
    nbaData: NBAPlayer;
  }> => {
    const rosterData = teamRosterData[teamId];
    if (!rosterData?.players) return [];

    return rosterData.players.map((nbaPlayer) => ({
      id: nbaPlayer.id,
      name: nbaPlayer.displayName,
      position: nbaPlayer.position?.abbreviation || "N/A",
      salary: nbaPlayer.contract?.salary || 0,
      nbaData: nbaPlayer,
    }));
  };

  const getTeamDraftPicks = (teamId: string) => {
    return [
      { id: `${teamId}-2025-1st`, year: 2025, round: "1st", team: teamId },
      { id: `${teamId}-2025-2nd`, year: 2025, round: "2nd", team: teamId },
      { id: `${teamId}-2026-1st`, year: 2026, round: "1st", team: teamId },
    ];
  };

  const isTeamRosterLoading = (teamId: string) => {
    return teamRosterData[teamId]?.isLoading || false;
  };

  const getTeamRosterError = (teamId: string) => {
    return teamRosterData[teamId]?.error;
  };

  return (
    <Card className="overflow-hidden border-gray-700 bg-gray-900 p-0 text-white">
      <CardHeader className="border-b border-gray-700 bg-gray-800 pt-4">
        <CardTitle className="text-xl text-white">Trade Generator</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-800">
            <TabsTrigger
              value="select"
              className="text-gray-300 data-[state=active]:bg-blue-600 data-[state=active]:text-white"
            >
              Select Players
            </TabsTrigger>
            <TabsTrigger
              value="results"
              className="text-gray-300 data-[state=active]:bg-green-600 data-[state=active]:text-white"
            >
              Trade Results
            </TabsTrigger>
          </TabsList>

          <TabsContent value="select">
            <SelectPlayersTab
              selectedTeams={selectedTeams}
              selectedAssets={selectedAssets}
              teamRosterData={teamRosterData}
              sportData={sportData}
              MAX_TEAMS={MAX_TEAMS}
              addTeam={addTeam}
              removeTeam={removeTeam}
              updateTeam={updateTeam}
              toggleAsset={toggleAsset}
              updateAssetDestination={updateAssetDestination}
              getAvailableDestinations={getAvailableDestinations}
              isAssetSelected={isAssetSelected}
              getAssetDestination={getAssetDestination}
              getTeamName={getTeamName}
              getTeamPlayers={getTeamPlayers}
              getTeamDraftPicks={getTeamDraftPicks}
              isTeamRosterLoading={isTeamRosterLoading}
              getTeamRosterError={getTeamRosterError}
              formatSalary={formatSalary}
              selectedSport={selectedSport}
            />
          </TabsContent>

          <TabsContent value="results">
            <TradeResultsTab
              isGeneratingTrades={isGeneratingTrades}
              generatedTrades={trades || []}
              getTeamName={getTeamName}
              formatSalary={formatSalary}
            />
            {tradesError && (
              <div className="mt-4 rounded-md border border-red-600 bg-red-900/20 p-3">
                <p className="text-sm text-red-300">Error: {tradesError}</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-between border-t border-gray-700 bg-gray-800 py-4">
        <div className="flex gap-2">
          <Button
            onClick={generateAutoTrades}
            disabled={selectedAssets.length === 0 || isGeneratingTrades}
            className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
          >
            <RefreshCw
              className={`h-4 w-4 ${isGeneratingTrades ? "animate-spin" : ""}`}
            />
            {isGeneratingTrades ? "Generating..." : "Generate Trades"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
