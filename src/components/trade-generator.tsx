"use client";

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Badge } from "~/components/ui/badge";
import {
  RefreshCw,
  ArrowRightLeft,
  Users,
  AlertCircle,
  Plus,
  X,
  Shuffle,
  Loader2,
} from "lucide-react";
import { getSportData } from "~/lib/data";
import { Alert, AlertDescription } from "~/components/ui/alert";
import type { NBATeam, NBAPlayer } from "~/lib/nba-types";

interface SelectedAsset {
  id: string;
  type: "player" | "pick";
  fromTeam: string;
  toTeam: string;
  data: any;
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
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<SelectedAsset[]>([]);
  const [generatedTrades, setGeneratedTrades] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("select");
  const [showSelectionAlert, setShowSelectionAlert] = useState(false);
  const [isGeneratingTrades, setIsGeneratingTrades] = useState(false);

  const selectedSport = "NBA";

  console.log("been hit", selectedTeams);
  // State to store roster data for each team
  const [teamRosterData, setTeamRosterData] = useState<
    Record<string, TeamRosterData>
  >({});

  // Maximum number of teams allowed in a trade
  const MAX_TEAMS = 5;

  // Function to fetch team roster data from API
  const fetchTeamRoster = async (teamId: string): Promise<void> => {
    // Set loading state
    setTeamRosterData((prev) => ({
      ...prev,
      [teamId]: { players: [], isLoading: true },
    }));

    try {
      const response = await fetch(`/api/espn/nba/team/${teamId}/roster`);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch roster for team ${teamId}: ${response.status}`,
        );
      }

      const data = await response.json();

      if (data.success && data.data?.roster) {
        setTeamRosterData((prev) => ({
          ...prev,
          [teamId]: {
            players: data.data.roster,
            isLoading: false,
          },
        }));
      } else {
        throw new Error("Invalid response format from roster API");
      }
    } catch (error) {
      console.error(`Error fetching roster for team ${teamId}:`, error);
      setTeamRosterData((prev) => ({
        ...prev,
        [teamId]: {
          players: [],
          isLoading: false,
          error:
            error instanceof Error ? error.message : "Failed to fetch roster",
        },
      }));
    }
  };

  // Get sport data - use real NBA data when available, fallback to mock data
  const sportData = (() => {
    if (selectedSport === "NBA" && nbaTeams.length > 0) {
      // Transform NBA teams to match the existing data structure
      const teams = nbaTeams.map((team) => ({
        id: team.id,
        name: team.displayName,
      }));

      // For NBA, we'll get players from the roster API calls
      // For now, use empty arrays for players and draft picks since we'll fetch them separately
      return {
        teams,
        players: [],
        draftPicks: [],
      };
    }

    // Fallback to existing mock data
    return getSportData(selectedSport);
  })();

  // Reset selections when sport changes
  useEffect(() => {
    setSelectedTeams([]);
    setSelectedAssets([]);
    setGeneratedTrades([]);
    setTeamRosterData({});
  }, [selectedSport]);

  // Add team to selection
  const addTeam = () => {
    if (selectedTeams.length < MAX_TEAMS) {
      setSelectedTeams([...selectedTeams, ""]);
    }
  };

  // Remove team from selection
  const removeTeam = (index: number) => {
    const removedTeamId = selectedTeams[index];
    const newTeams = selectedTeams.filter((_, i) => i !== index);
    setSelectedTeams(newTeams);

    // Remove roster data for the removed team
    if (removedTeamId) {
      setTeamRosterData((prev) => {
        const newData = { ...prev };
        delete newData[removedTeamId];
        return newData;
      });
    }

    // Remove assets from removed team
    const updatedAssets = selectedAssets.filter(
      (asset) =>
        asset.fromTeam !== selectedTeams[index] &&
        asset.toTeam !== selectedTeams[index],
    );
    setSelectedAssets(updatedAssets);
  };

  // Update team selection and fetch roster data
  const updateTeam = async (index: number, teamId: string) => {
    const newTeams = [...selectedTeams];
    const oldTeamId = newTeams[index];
    newTeams[index] = teamId;
    setSelectedTeams(newTeams);

    // Remove roster data for the old team if it's not used elsewhere
    if (
      oldTeamId &&
      !newTeams.filter((_, i) => i !== index).includes(oldTeamId)
    ) {
      setTeamRosterData((prev) => {
        const newData = { ...prev };
        delete newData[oldTeamId];
        return newData;
      });
    }

    // Fetch roster data for the new team if it's NBA and not already fetched
    if (teamId && selectedSport === "NBA" && !teamRosterData[teamId]) {
      await fetchTeamRoster(teamId);
    }

    // Update assets that reference the old team
    const updatedAssets = selectedAssets
      .map((asset) => {
        if (asset.fromTeam === oldTeamId) {
          return { ...asset, fromTeam: teamId };
        }
        if (asset.toTeam === oldTeamId) {
          return { ...asset, toTeam: teamId };
        }
        return asset;
      })
      .filter(
        (asset) =>
          // Remove assets if the team is no longer selected
          selectedTeams.includes(asset.fromTeam) &&
          selectedTeams.includes(asset.toTeam),
      );
    setSelectedAssets(updatedAssets);
  };

  // Toggle asset selection
  const toggleAsset = (
    assetId: string,
    type: "player" | "pick",
    fromTeam: string,
    data: any,
  ) => {
    const existingAssetIndex = selectedAssets.findIndex(
      (asset) => asset.id === assetId,
    );

    if (existingAssetIndex >= 0) {
      // Remove asset
      const newAssets = selectedAssets.filter(
        (_, i) => i !== existingAssetIndex,
      );
      setSelectedAssets(newAssets);
    } else {
      // For single team trades, don't require destination
      const otherTeams = selectedTeams.filter(
        (team) => team !== fromTeam && team !== "",
      );
      const defaultToTeam = otherTeams.length > 0 ? otherTeams[0] : "";

      const newAsset: SelectedAsset = {
        id: assetId,
        type,
        fromTeam,
        toTeam: defaultToTeam ?? "",
        data,
      };
      setSelectedAssets([...selectedAssets, newAsset]);
    }
  };

  // Update asset destination
  const updateAssetDestination = (assetId: string, toTeam: string) => {
    const updatedAssets = selectedAssets.map((asset) =>
      asset.id === assetId ? { ...asset, toTeam } : asset,
    );
    setSelectedAssets(updatedAssets);
  };

  // Get available teams for asset destination
  const getAvailableDestinations = (fromTeam: string) => {
    return selectedTeams.filter((team) => team !== fromTeam && team !== "");
  };

  // Check if asset is selected
  const isAssetSelected = (assetId: string) => {
    return selectedAssets.some((asset) => asset.id === assetId);
  };

  // Get asset destination
  const getAssetDestination = (assetId: string) => {
    const asset = selectedAssets.find((asset) => asset.id === assetId);
    return asset?.toTeam || "";
  };

  // Check if "Try Trade" button should be enabled
  const canTryTrade = () => {
    const validTeams = selectedTeams.filter((team) => team !== "");
    if (validTeams.length < 2) return false;

    // Check if at least 2 teams have assets selected
    const teamsWithAssets = new Set(
      selectedAssets.map((asset) => asset.fromTeam),
    );
    return teamsWithAssets.size >= 2;
  };

  // Generate automatic trades (for single team/asset)
  const generateAutoTrades = async () => {
    if (selectedAssets.length === 0) {
      setShowSelectionAlert(true);
      setTimeout(() => setShowSelectionAlert(false), 5000);
      return;
    }

    const validTeams = selectedTeams.filter((team) => team !== "");

    // Generate trades for the selected teams and assets
    if (validTeams.length > 0 && selectedAssets.length > 0) {
      // If assets are selected and it's NBA, use OpenAI to generate realistic trades
      if (selectedSport === "NBA") {
        console.log("generateAutoTrades", selectedAssets);
        try {
          // Get all unique team IDs involved in the trade (both fromTeam and toTeam)
          const fromTeamIds = [
            ...new Set(selectedAssets.map((asset) => asset.fromTeam)),
          ];
          const toTeamIds = [
            ...new Set(
              selectedAssets.map((asset) => asset.toTeam).filter(Boolean),
            ),
          ];
          const allInvolvedTeamIds = [
            ...new Set([...fromTeamIds, ...toTeamIds]),
          ];

          // Get team information for all involved teams
          const involvedTeams = allInvolvedTeamIds
            .map((teamId) => nbaTeams.find((t) => t.id === teamId))
            .filter(Boolean);

          if (involvedTeams.length === 0) {
            console.error("No teams found");
            return;
          }

          console.log(
            "Involved teams:",
            involvedTeams.map((t) => t?.displayName || "Unknown"),
          );
          console.log(
            "Selected assets by team:",
            selectedAssets.reduce((acc, asset) => {
              const fromTeam =
                nbaTeams.find((t) => t.id === asset.fromTeam)?.displayName ||
                asset.fromTeam;
              const toTeam =
                nbaTeams.find((t) => t.id === asset.toTeam)?.displayName ||
                asset.toTeam;
              acc.push(
                `${asset.data.name || asset.data.fullName} from ${fromTeam} to ${toTeam}`,
              );
              return acc;
            }, [] as string[]),
          );

          setGeneratedTrades([]); // Clear existing trades
          setIsGeneratingTrades(true); // Set loading state
          setActiveTab("results"); // Switch to results tab to show loading

          const response = await fetch("/api/trades/generate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              selectedAssets,
              teams: involvedTeams,
              sport: selectedSport,
            }),
          });

          if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
          }

          const data = await response.json();

          if (data.success && data.data?.trades) {
            // Transform OpenAI trades to match our trade structure
            const openAITrades = data.data.trades.map(
              (trade: any, index: number) => ({
                id: `openai-trade-${index}`,
                teams: trade.teams || [], // Array of teams with their gives/receives
                explanation: trade.explanation,
                salaryMatch: trade.salaryMatch,
                isOpenAIGenerated: true,
                source: "OpenAI GPT-4o-mini",
                // Legacy fields for backward compatibility
                tradingPartner:
                  trade.tradingPartner ||
                  (trade.teams && trade.teams.length > 1
                    ? trade.teams[1]?.teamName
                    : "Multiple Teams"),
                playerReceives: trade.playerReceives || [],
                playerGives: trade.playerGives || [],
              }),
            );

            setGeneratedTrades(openAITrades);
            setIsGeneratingTrades(false); // Clear loading state on success
          } else {
            throw new Error(data.error || "Failed to generate trades");
          }

          return; // Exit early since we used OpenAI
        } catch (error) {
          console.error("Error calling OpenAI for trade generation:", error);
          setIsGeneratingTrades(false); // Clear loading state on error

          // Show error message instead of fallback
          setGeneratedTrades([]);
          setActiveTab("results");
          return;
        }
      } else {
        // For non-NBA sports, use the existing tryTrade logic
        tryTrade();
        return;
      }
    } else {
      // No valid teams or assets selected
      setShowSelectionAlert(true);
      setTimeout(() => setShowSelectionAlert(false), 5000);
      return;
    }

    setActiveTab("results");
  };

  // Try trade with selected assets
  const tryTrade = () => {
    // Group assets by destination team
    const tradesByTeam: {
      [key: string]: { incoming: SelectedAsset[]; outgoing: SelectedAsset[] };
    } = {};

    selectedTeams.forEach((team) => {
      if (team) {
        tradesByTeam[team] = { incoming: [], outgoing: [] };
      }
    });

    selectedAssets.forEach((asset) => {
      if (tradesByTeam[asset.fromTeam]) {
        tradesByTeam[asset.fromTeam]?.outgoing.push(asset);
      }
      if (tradesByTeam[asset.toTeam]) {
        tradesByTeam[asset.toTeam]?.incoming.push(asset);
      }
    });

    // Create trade summary
    const tradeSummary = {
      teams: selectedTeams.filter((team) => team !== ""),
      trades: tradesByTeam,
      totalAssets: selectedAssets.length,
      isAutoGenerated: false,
    };

    setGeneratedTrades([tradeSummary]);
    setActiveTab("results");
  };

  // Format salary as currency
  const formatSalary = (salary: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 1,
      notation: "compact",
    }).format(salary);
  };

  // Get team name from ID
  const getTeamName = (teamId: string) => {
    const team = sportData.teams.find((t) => t.id === teamId);
    return team ? team.name : teamId;
  };

  // Get players for a team
  const getTeamPlayers = (teamId: string): Array<any> => {
    // For NBA, use fetched roster data if available
    if (selectedSport === "NBA" && teamRosterData[teamId]?.players) {
      console.log("been hit", teamRosterData[teamId].players);
      // Transform NBA players to match the existing data structure
      return teamRosterData[teamId].players.map((player) => ({
        id: player.id,
        name: player.fullName,
        team: teamId,
        position: player.position?.abbreviation || "N/A",
        salary: player.contract?.salary || 0,
        // Include the full NBA player data for additional info
        nbaData: player,
      }));
    }

    // Fallback to mock data for other sports or when roster data is not available
    return sportData.players.filter((player) => player.team === teamId);
  };

  // Get draft picks for a team
  const getTeamDraftPicks = (teamId: string) => {
    return sportData.draftPicks.filter((pick) => pick.team === teamId);
  };

  // Check if team roster is loading
  const isTeamRosterLoading = (teamId: string) => {
    return (
      selectedSport === "NBA" && teamRosterData[teamId]?.isLoading === true
    );
  };

  // Get roster error for a team
  const getTeamRosterError = (teamId: string) => {
    return selectedSport === "NBA" ? teamRosterData[teamId]?.error : undefined;
  };

  // Initialize with one team
  useEffect(() => {
    if (selectedTeams.length === 0) {
      setSelectedTeams([""]);
    }
  }, []);

  return (
    <Card className="mx-auto w-full border-gray-700 bg-gray-900 shadow-2xl md:max-w-6xl">
      <CardContent className="bg-gray-900 pt-6 text-white">
        {showSelectionAlert && (
          <Alert className="mb-4 border-amber-700 bg-amber-900/30 text-amber-200">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please select at least one player or draft pick to generate
              trades.
            </AlertDescription>
          </Alert>
        )}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
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

          <TabsContent value="select" className="space-y-6 pt-4">
            {/* Team Selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-white">
                  Teams in Trade
                </h3>
                {selectedTeams.length < MAX_TEAMS && (
                  <Button
                    onClick={addTeam}
                    size="sm"
                    className="bg-green-600 text-white hover:bg-green-700"
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Add Team
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {selectedTeams.map((teamId, index) => (
                  <div key={index} className="relative">
                    <Label className="font-medium text-gray-200">
                      Team {index + 1}
                      {selectedTeams.length > 1 && (
                        <Button
                          onClick={() => removeTeam(index)}
                          size="sm"
                          variant="ghost"
                          className="ml-2 h-6 w-6 p-0 text-red-400 hover:bg-red-900/20 hover:text-red-300"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </Label>
                    <Select
                      value={teamId}
                      onValueChange={(value) => updateTeam(index, value)}
                    >
                      <SelectTrigger className="mt-1 border-gray-600 bg-gray-800 text-white">
                        <SelectValue placeholder="Select a team" />
                      </SelectTrigger>
                      <SelectContent className="border-gray-600 bg-gray-800">
                        {sportData.teams
                          .filter(
                            (team) =>
                              !selectedTeams.includes(team.id) ||
                              team.id === teamId,
                          )
                          .map((team) => (
                            <SelectItem
                              key={team.id}
                              value={team.id}
                              className="text-white hover:bg-gray-700"
                            >
                              {team.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {/* Assets Selection */}
            {selectedTeams.filter((team) => team !== "").length >= 1 && (
              <div className="space-y-6">
                <h3 className="border-b border-gray-700 pb-2 text-lg font-medium text-white">
                  Select Assets to Trade
                </h3>

                {selectedTeams.map((teamId, teamIndex) => {
                  if (!teamId) return null;

                  const teamPlayers = getTeamPlayers(teamId);
                  const teamPicks = getTeamDraftPicks(teamId);
                  const teamAssets = selectedAssets.filter(
                    (asset) => asset.fromTeam === teamId,
                  );

                  return (
                    <div
                      key={teamId}
                      className="rounded-lg border border-gray-700 bg-gray-800 p-4"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <h4 className="flex items-center gap-2 text-lg font-medium text-blue-400">
                          <Users className="h-5 w-5" />
                          {getTeamName(teamId)}
                        </h4>
                        <Badge className="bg-blue-600 hover:bg-blue-700">
                          {teamAssets.length} Assets Selected
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {/* Players */}
                        <div>
                          <h5 className="mb-3 font-medium text-gray-300">
                            Players
                            {isTeamRosterLoading(teamId) && (
                              <Loader2 className="ml-2 inline h-4 w-4 animate-spin" />
                            )}
                          </h5>

                          {getTeamRosterError(teamId) && (
                            <Alert className="mb-3 border-red-700 bg-red-900/30 text-red-200">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription className="text-sm">
                                Failed to load roster:{" "}
                                {getTeamRosterError(teamId)}
                              </AlertDescription>
                            </Alert>
                          )}

                          <div className="scrollbar-dark max-h-60 space-y-2 overflow-y-auto pr-1">
                            {isTeamRosterLoading(teamId) ? (
                              <div className="flex items-center justify-center py-8">
                                <div className="text-center">
                                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-400" />
                                  <p className="mt-2 text-sm text-gray-400">
                                    Loading roster...
                                  </p>
                                </div>
                              </div>
                            ) : teamPlayers.length === 0 ? (
                              <div className="flex items-center justify-center py-8">
                                <p className="text-sm text-gray-400">
                                  {selectedSport === "NBA"
                                    ? "No roster data available"
                                    : "No players found"}
                                </p>
                              </div>
                            ) : (
                              teamPlayers.map((player) => {
                                const isSelected = isAssetSelected(player.id);
                                const destination = getAssetDestination(
                                  player.id,
                                );
                                const availableDestinations =
                                  getAvailableDestinations(teamId);
                                const nbaPlayer = player.nbaData;

                                return (
                                  <div
                                    key={player.id}
                                    className={`rounded-md p-3 transition-colors ${
                                      isSelected
                                        ? "border border-blue-500 bg-blue-900/40"
                                        : "bg-gray-700 hover:bg-gray-600"
                                    }`}
                                  >
                                    <div className="mb-2 flex items-center space-x-2">
                                      <Checkbox
                                        id={player.id}
                                        checked={isSelected}
                                        onCheckedChange={() =>
                                          toggleAsset(
                                            player.id,
                                            "player",
                                            teamId,
                                            player,
                                          )
                                        }
                                        className="border-blue-400"
                                      />
                                      <div className="flex-1">
                                        <Label
                                          htmlFor={player.id}
                                          className="cursor-pointer font-medium text-white"
                                        >
                                          {player.name}
                                          {nbaPlayer?.jersey && (
                                            <span className="ml-1 text-sm text-gray-400">
                                              #{nbaPlayer.jersey}
                                            </span>
                                          )}
                                        </Label>
                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                          <span>{player.position}</span>
                                          <span>•</span>
                                          <span>
                                            {formatSalary(player.salary)}
                                          </span>
                                          {selectedSport === "NBA" &&
                                            nbaPlayer?.contract
                                              ?.yearsRemaining && (
                                              <>
                                                <span>•</span>
                                                <span>
                                                  {
                                                    nbaPlayer.contract
                                                      .yearsRemaining
                                                  }
                                                  yr remaining
                                                </span>
                                              </>
                                            )}
                                        </div>
                                        {selectedSport === "NBA" &&
                                          nbaPlayer && (
                                            <div className="mt-1 text-xs text-gray-500">
                                              {nbaPlayer.age &&
                                                `Age: ${nbaPlayer.age}`}
                                              {nbaPlayer.experience?.years !==
                                                undefined && (
                                                <span className="ml-2">
                                                  Exp:{" "}
                                                  {nbaPlayer.experience.years}yr
                                                </span>
                                              )}
                                              {nbaPlayer.displayHeight && (
                                                <span className="ml-2">
                                                  {nbaPlayer.displayHeight}
                                                </span>
                                              )}
                                            </div>
                                          )}
                                      </div>
                                    </div>

                                    {isSelected &&
                                      availableDestinations.length > 0 && (
                                        <div className="ml-6">
                                          <Label className="text-xs text-gray-400">
                                            Trade to:
                                          </Label>
                                          <Select
                                            value={destination}
                                            onValueChange={(value) =>
                                              updateAssetDestination(
                                                player.id,
                                                value,
                                              )
                                            }
                                          >
                                            <SelectTrigger className="h-8 border-gray-500 bg-gray-600 text-xs">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="border-gray-600 bg-gray-700">
                                              {availableDestinations.map(
                                                (destTeamId) => (
                                                  <SelectItem
                                                    key={destTeamId}
                                                    value={destTeamId}
                                                    className="text-xs text-white hover:bg-gray-600"
                                                  >
                                                    {getTeamName(destTeamId)}
                                                  </SelectItem>
                                                ),
                                              )}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                        {/* Draft Picks */}
                        <div>
                          <h5 className="mb-3 font-medium text-gray-300">
                            Draft Picks
                          </h5>
                          <div className="scrollbar-dark max-h-60 space-y-2 overflow-y-auto pr-1">
                            {teamPicks.map((pick) => {
                              const isSelected = isAssetSelected(pick.id);
                              const destination = getAssetDestination(pick.id);
                              const availableDestinations =
                                getAvailableDestinations(teamId);

                              return (
                                <div
                                  key={pick.id}
                                  className={`rounded-md p-3 transition-colors ${
                                    isSelected
                                      ? "border border-green-500 bg-green-900/40"
                                      : "bg-gray-700 hover:bg-gray-600"
                                  }`}
                                >
                                  <div className="mb-2 flex items-center space-x-2">
                                    <Checkbox
                                      id={pick.id}
                                      checked={isSelected}
                                      onCheckedChange={() =>
                                        toggleAsset(
                                          pick.id,
                                          "pick",
                                          teamId,
                                          pick,
                                        )
                                      }
                                      className="border-green-400"
                                    />
                                    <div className="flex-1">
                                      <Label
                                        htmlFor={pick.id}
                                        className="cursor-pointer font-medium text-white"
                                      >
                                        {pick.year} {pick.round} Round Pick
                                      </Label>
                                      <div className="text-sm text-gray-400">
                                        {pick.description}
                                      </div>
                                    </div>
                                  </div>

                                  {isSelected &&
                                    availableDestinations.length > 0 && (
                                      <div className="ml-6">
                                        <Label className="text-xs text-gray-400">
                                          Trade to:
                                        </Label>
                                        <Select
                                          value={destination}
                                          onValueChange={(value) =>
                                            updateAssetDestination(
                                              pick.id,
                                              value,
                                            )
                                          }
                                        >
                                          <SelectTrigger className="h-8 border-gray-500 bg-gray-600 text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent className="border-gray-600 bg-gray-700">
                                            {availableDestinations.map(
                                              (destTeamId) => (
                                                <SelectItem
                                                  key={destTeamId}
                                                  value={destTeamId}
                                                  className="text-xs text-white hover:bg-gray-600"
                                                >
                                                  {getTeamName(destTeamId)}
                                                </SelectItem>
                                              ),
                                            )}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedTeams.filter((team) => team !== "").length === 0 && (
              <div className="rounded-lg border border-gray-700 bg-gray-800 py-12 text-center">
                <p className="text-gray-300">
                  Please select at least 1 team to start building trades.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="results" className="pt-0">
            {isGeneratingTrades ? (
              <div className="flex flex-col items-center justify-center space-y-4 py-12">
                <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500"></div>
                <div className="text-center">
                  <h3 className="mb-2 text-lg font-medium text-white">
                    Generating AI Trade Scenarios
                  </h3>
                  <p className="text-gray-300">
                    Our AI is analyzing the player and creating realistic trade
                    options...
                  </p>
                </div>
              </div>
            ) : generatedTrades.length > 0 ? (
              <div className="mt-4 space-y-4 md:space-y-6">
                {generatedTrades.map((trade, index) => (
                  <Card
                    key={index}
                    className="overflow-hidden border-gray-700 bg-gray-800 p-0"
                  >
                    <CardHeader className="bg-gray-700 px-3 py-3 md:px-6 md:pb-2">
                      <CardTitle className="flex flex-row items-center gap-2 text-base text-white md:text-lg">
                        <ArrowRightLeft className="h-5 w-5" />
                        {trade.isOpenAIGenerated ? (
                          <>
                            Trade Scenario {index + 1}{" "}
                            <Badge className="ml-2 bg-green-600">
                              AI Generated
                            </Badge>
                          </>
                        ) : (
                          <>
                            {trade.teams?.length || 2}-Team Trade{" "}
                            {trade.isAutoGenerated ? "(Auto-Generated)" : ""}
                          </>
                        )}
                      </CardTitle>
                      <CardDescription className="text-gray-300">
                        {trade.isOpenAIGenerated ? (
                          <>
                            {trade.teams && trade.teams.length > 0
                              ? `${trade.teams.length}-Team Trade • ${trade.source}`
                              : `Trade with ${trade.tradingPartner} • ${trade.source}`}
                          </>
                        ) : (
                          <>{trade.totalAssets} total assets involved</>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-3 pt-3 md:px-6 md:pt-4">
                      {trade.isOpenAIGenerated ? (
                        <div className="space-y-4">
                          {/* Multi-team trade display */}
                          {trade.teams && trade.teams.length > 0 ? (
                            <>
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
                                {trade.teams.map(
                                  (team: any, teamIdx: number) => (
                                    <div
                                      key={teamIdx}
                                      className="rounded-md border border-gray-600 bg-gray-700 p-3 md:p-4"
                                    >
                                      <h4 className="mb-2 border-b border-gray-600 pb-1 text-sm font-medium text-blue-400 md:mb-3 md:text-base">
                                        {team.teamName}
                                      </h4>

                                      {/* What team gives */}
                                      {team.gives && team.gives.length > 0 && (
                                        <div className="mb-2 md:mb-3">
                                          <h5 className="mb-1 text-xs font-medium text-red-300 md:text-sm">
                                            Sends:
                                          </h5>
                                          <div className="space-y-0.5 md:space-y-1">
                                            {team.gives.map(
                                              (asset: string, idx: number) => (
                                                <div
                                                  key={idx}
                                                  className="text-xs leading-relaxed text-white md:text-sm"
                                                >
                                                  {asset}
                                                </div>
                                              ),
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {/* What team receives */}
                                      {team.receives &&
                                        team.receives.length > 0 && (
                                          <div className="mb-2 md:mb-3">
                                            <h5 className="mb-1 text-xs font-medium text-green-300 md:text-sm">
                                              Receives:
                                            </h5>
                                            <div className="space-y-0.5 md:space-y-1">
                                              {team.receives.map(
                                                (
                                                  asset: string,
                                                  idx: number,
                                                ) => (
                                                  <div
                                                    key={idx}
                                                    className="text-xs leading-relaxed text-white md:text-sm"
                                                  >
                                                    {asset}
                                                  </div>
                                                ),
                                              )}
                                            </div>
                                          </div>
                                        )}
                                    </div>
                                  ),
                                )}
                              </div>
                              <div className="mb-4 rounded-md border border-blue-600 bg-blue-900/20 p-3 md:p-4">
                                <h4 className="mb-2 text-sm font-medium text-blue-300 md:text-base">
                                  Trade Analysis
                                </h4>
                                <p className="mb-2 text-xs leading-relaxed text-gray-300 md:text-sm">
                                  {trade.explanation}
                                </p>
                                {trade.salaryMatch && (
                                  <p className="text-xs text-gray-400">
                                    Salary Info: {trade.salaryMatch}
                                  </p>
                                )}
                              </div>
                            </>
                          ) : (
                            /* Fallback to legacy 2-team display */
                            <>
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                                <div className="rounded-md border border-red-600 bg-red-900/20 p-3 md:p-4">
                                  <h4 className="mb-2 text-sm font-medium text-red-300 md:text-base">
                                    Player Traded
                                  </h4>
                                  <div className="space-y-0.5 md:space-y-1">
                                    {trade.playerGives.map(
                                      (player: string, idx: number) => (
                                        <div
                                          key={idx}
                                          className="text-xs leading-relaxed text-white md:text-sm"
                                        >
                                          {player}
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </div>
                                <div className="rounded-md border border-green-600 bg-green-900/20 p-3 md:p-4">
                                  <h4 className="mb-2 text-sm font-medium text-green-300 md:text-base">
                                    Assets Received
                                  </h4>
                                  <div className="space-y-0.5 md:space-y-1">
                                    {trade.playerReceives.map(
                                      (asset: string, idx: number) => (
                                        <div
                                          key={idx}
                                          className="text-xs leading-relaxed text-white md:text-sm"
                                        >
                                          {asset}
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="rounded-md border border-blue-600 bg-blue-900/20 p-3 md:p-4">
                                <h4 className="mb-2 text-sm font-medium text-blue-300 md:text-base">
                                  Trade Analysis
                                </h4>
                                <p className="mb-2 text-xs leading-relaxed text-gray-300 md:text-sm">
                                  {trade.explanation}
                                </p>
                                {trade.salaryMatch && (
                                  <p className="text-xs text-gray-400">
                                    Salary Info: {trade.salaryMatch}
                                  </p>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {trade.teams.map((teamId: string) => {
                            const teamTrade = trade.trades[teamId];
                            const outgoingSalary = teamTrade.outgoing
                              .filter(
                                (asset: SelectedAsset) =>
                                  asset.type === "player",
                              )
                              .reduce(
                                (sum: number, asset: SelectedAsset) =>
                                  sum + asset.data.salary,
                                0,
                              );
                            const incomingSalary = teamTrade.incoming
                              .filter(
                                (asset: SelectedAsset) =>
                                  asset.type === "player",
                              )
                              .reduce(
                                (sum: number, asset: SelectedAsset) =>
                                  sum + asset.data.salary,
                                0,
                              );

                            return (
                              <div
                                key={teamId}
                                className="rounded-md border border-gray-600 bg-gray-700 p-4"
                              >
                                <h4 className="mb-3 border-b border-gray-600 pb-1 font-medium text-blue-400">
                                  {getTeamName(teamId)}
                                </h4>

                                {/* Outgoing Assets */}
                                {teamTrade.outgoing.length > 0 && (
                                  <div className="mb-3">
                                    <h5 className="mb-1 text-sm font-medium text-red-300">
                                      Sends:
                                    </h5>
                                    <div className="space-y-1">
                                      {teamTrade.outgoing.map(
                                        (asset: SelectedAsset) => (
                                          <div
                                            key={asset.id}
                                            className="text-sm"
                                          >
                                            <span className="text-white">
                                              {asset.type === "player"
                                                ? asset.data.name
                                                : `${asset.data.year} ${asset.data.round} Pick`}
                                            </span>
                                            {asset.toTeam && (
                                              <span className="ml-2 text-gray-400">
                                                → {getTeamName(asset.toTeam)}
                                              </span>
                                            )}
                                            {asset.type === "player" && (
                                              <span className="ml-2 text-gray-400">
                                                (
                                                {formatSalary(
                                                  asset.data.salary,
                                                )}
                                                )
                                              </span>
                                            )}
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Incoming Assets */}
                                {teamTrade.incoming.length > 0 && (
                                  <div className="mb-3">
                                    <h5 className="mb-1 text-sm font-medium text-green-300">
                                      Receives:
                                    </h5>
                                    <div className="space-y-1">
                                      {teamTrade.incoming.map(
                                        (asset: SelectedAsset) => (
                                          <div
                                            key={asset.id}
                                            className="text-sm"
                                          >
                                            <span className="text-white">
                                              {asset.type === "player"
                                                ? asset.data.name
                                                : `${asset.data.year} ${asset.data.round} Pick`}
                                            </span>
                                            <span className="ml-2 text-gray-400">
                                              ← {getTeamName(asset.fromTeam)}
                                            </span>
                                            {asset.type === "player" && (
                                              <span className="ml-2 text-gray-400">
                                                (
                                                {formatSalary(
                                                  asset.data.salary,
                                                )}
                                                )
                                              </span>
                                            )}
                                          </div>
                                        ),
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Salary Summary */}
                                {(outgoingSalary > 0 || incomingSalary > 0) && (
                                  <div className="border-t border-gray-600 pt-2 text-xs text-gray-400">
                                    <div>
                                      Out: {formatSalary(outgoingSalary)}
                                    </div>
                                    <div>
                                      In: {formatSalary(incomingSalary)}
                                    </div>
                                    <div
                                      className={`font-medium ${incomingSalary - outgoingSalary >= 0 ? "text-green-400" : "text-red-400"}`}
                                    >
                                      Net:{" "}
                                      {incomingSalary - outgoingSalary >= 0
                                        ? "+"
                                        : ""}
                                      {formatSalary(
                                        incomingSalary - outgoingSalary,
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-gray-700 bg-gray-800 py-8 text-center">
                <p className="text-gray-300">
                  No trades generated yet. Select assets and generate trades
                  first.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-between border-t border-gray-700 bg-gray-800 py-4">
        {/* <Button
          variant="outline"
          onClick={() => setActiveTab("select")}
          className="border-gray-600 text-gray-300 hover:bg-gray-700"
        >
          Back to Selection
        </Button> */}
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
