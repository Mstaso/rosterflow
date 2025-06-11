"use client";

import { useState } from "react";
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
  const [generatedTrades, setGeneratedTrades] = useState<unknown[]>([]);
  const [isGeneratingTrades, setIsGeneratingTrades] = useState(false);

  const MAX_TEAMS = 5;

  const sportData = {
    teams: nbaTeams.map((team) => ({
      id: team.id.toString(),
      name: team.displayName,
    })),
  };

  const fetchTeamRoster = async (teamId: string): Promise<void> => {
    if (teamRosterData[teamId]) return;

    setTeamRosterData((prev) => ({
      ...prev,
      [teamId]: { players: [], isLoading: true },
    }));

    try {
      const response = await fetch(`/api/teams/${teamId}/roster`);
      if (!response.ok) {
        throw new Error(`Failed to fetch roster: ${response.statusText}`);
      }
      const data = await response.json();

      if (data.success && data.players) {
        setTeamRosterData((prev) => ({
          ...prev,
          [teamId]: {
            players: data.players,
            isLoading: false,
          },
        }));
      } else {
        throw new Error(
          (data as { error?: string }).error ?? "Failed to load roster data",
        );
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
  };

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

    setIsGeneratingTrades(true);
    setGeneratedTrades([]);

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

      const response = await fetch("/api/trades/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assets: selectedAssets,
          teams: allTeams,
          destinationPreferences,
          sport: selectedSport,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate trades");
      }

      const result = await response.json();

      if (result.success && result.trades) {
        setGeneratedTrades(result.trades);
      } else {
        throw new Error(
          (result as { error?: string }).error ?? "Failed to generate trades",
        );
      }
    } catch (error) {
      console.error("Error generating trades:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to generate trades. Please try again.",
      );
    } finally {
      setIsGeneratingTrades(false);
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
    <Card className="border-gray-700 bg-gray-900 text-white">
      <CardHeader className="border-b border-gray-700 bg-gray-800">
        <CardTitle className="text-xl text-white">Trade Generator</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <Tabs defaultValue="select" className="w-full">
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
              generatedTrades={generatedTrades}
              getTeamName={getTeamName}
              formatSalary={formatSalary}
            />
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
