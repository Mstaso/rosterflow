"use client";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Users, AlertCircle, Plus, X, Loader2 } from "lucide-react";
import type { NBAPlayer } from "~/lib/nba-types";

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

interface SelectPlayersTabProps {
  selectedTeams: string[];
  selectedAssets: SelectedAsset[];
  teamRosterData: Record<string, TeamRosterData>;
  sportData: {
    teams: Array<{ id: string; name: string }>;
  };
  MAX_TEAMS: number;
  addTeam: () => void;
  removeTeam: (index: number) => void;
  updateTeam: (index: number, teamId: string) => Promise<void>;
  toggleAsset: (
    assetId: string,
    type: "player" | "pick",
    fromTeam: string,
    data: unknown,
  ) => void;
  updateAssetDestination: (assetId: string, toTeam: string) => void;
  getAvailableDestinations: (fromTeam: string) => string[];
  isAssetSelected: (assetId: string) => boolean;
  getAssetDestination: (assetId: string) => string;
  getTeamName: (teamId: string) => string;
  getTeamPlayers: (teamId: string) => Array<{
    id: string;
    name: string;
    position: string;
    salary: number;
    nbaData: NBAPlayer;
  }>;
  getTeamDraftPicks: (teamId: string) => Array<{
    id: string;
    year: number;
    round: string;
    team: string;
  }>;
  isTeamRosterLoading: (teamId: string) => boolean;
  getTeamRosterError: (teamId: string) => string | undefined;
  formatSalary: (salary: number) => string;
  selectedSport: string;
}

export default function SelectPlayersTab({
  selectedTeams,
  selectedAssets,
  sportData,
  MAX_TEAMS,
  addTeam,
  removeTeam,
  updateTeam,
  toggleAsset,
  updateAssetDestination,
  getAvailableDestinations,
  isAssetSelected,
  getAssetDestination,
  getTeamName,
  getTeamPlayers,
  getTeamDraftPicks,
  isTeamRosterLoading,
  getTeamRosterError,
  formatSalary,
  selectedSport,
}: SelectPlayersTabProps) {
  return (
    <div className="space-y-6 pt-4">
      {/* Team Selection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-white">Teams in Trade</h3>
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
                      (team: any) =>
                        !selectedTeams.includes(team.id) || team.id === teamId,
                    )
                    .map((team: any) => (
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
                          Failed to load roster: {getTeamRosterError(teamId)}
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
                          const destination = getAssetDestination(player.id);
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
                                    <span>{formatSalary(player.salary)}</span>
                                    {selectedSport === "NBA" &&
                                      (
                                        nbaPlayer?.contract as {
                                          yearsRemaining?: number;
                                        }
                                      )?.yearsRemaining && (
                                        <>
                                          <span>•</span>
                                          <span>
                                            {
                                              (
                                                nbaPlayer.contract as {
                                                  yearsRemaining?: number;
                                                }
                                              ).yearsRemaining
                                            }
                                            yr remaining
                                          </span>
                                        </>
                                      )}
                                  </div>
                                  {selectedSport === "NBA" && nbaPlayer && (
                                    <div className="mt-1 text-xs text-gray-500">
                                      {nbaPlayer.age && `Age: ${nbaPlayer.age}`}
                                      {nbaPlayer.experience?.years !==
                                        undefined && (
                                        <span className="ml-2">
                                          Exp: {nbaPlayer.experience.years}yr
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
                                        updateAssetDestination(player.id, value)
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
                      {teamPicks.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                          <p className="text-sm text-gray-400">
                            No draft picks available
                          </p>
                        </div>
                      ) : (
                        teamPicks.map((pick) => {
                          const isSelected = isAssetSelected(pick.id);
                          const destination = getAssetDestination(pick.id);
                          const availableDestinations =
                            getAvailableDestinations(teamId);

                          return (
                            <div
                              key={pick.id}
                              className={`rounded-md p-3 transition-colors ${
                                isSelected
                                  ? "border border-blue-500 bg-blue-900/40"
                                  : "bg-gray-700 hover:bg-gray-600"
                              }`}
                            >
                              <div className="mb-2 flex items-center space-x-2">
                                <Checkbox
                                  id={pick.id}
                                  checked={isSelected}
                                  onCheckedChange={() =>
                                    toggleAsset(pick.id, "pick", teamId, pick)
                                  }
                                  className="border-blue-400"
                                />
                                <div className="flex-1">
                                  <Label
                                    htmlFor={pick.id}
                                    className="cursor-pointer font-medium text-white"
                                  >
                                    {pick.year} {pick.round} Round Pick
                                  </Label>
                                  <div className="text-sm text-gray-400">
                                    Team: {getTeamName(pick.team)}
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
                                        updateAssetDestination(pick.id, value)
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
    </div>
  );
}
