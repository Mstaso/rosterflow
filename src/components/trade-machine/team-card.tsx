"use client";
import type { Team, Player } from "~/types";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  XIcon,
  RepeatIcon,
  UsersIcon,
  FileTextIcon,
  Loader2,
  Trash2Icon,
  Plus,
  Minus,
  BarChart3Icon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import { PlayerStatsModal } from "~/components/player-stats-modal";

interface TeamCardProps {
  team: Team;
  allTeams: Team[];
  selectedTeamIdsInMachine: number[];
  onRemoveTeam: (teamId: number) => void;
  selectedAssets: {
    id: number;
    type: "player" | "pick";
    teamId: number;
    targetTeamId?: number;
  }[];
  onAssetSelect: (
    assetId: number,
    assetType: "player" | "pick",
    teamId: number,
    targetTeamId?: number
  ) => void;
  setSelectedTeams: React.Dispatch<React.SetStateAction<Team[]>>;
  setSelectedTeamIds: React.Dispatch<React.SetStateAction<number[]>>;
  setSelectedAssets: React.Dispatch<
    React.SetStateAction<
      {
        id: number;
        type: "player" | "pick";
        teamId: number;
        targetTeamId?: number;
      }[]
    >
  >;
  setActiveTab?: (value: string) => void;
}

const formatM = (value: number) => {
  const millions = value / 1_000_000;
  const prefix = millions < 0 ? "-" : "";
  return `${prefix}$${Math.abs(millions).toFixed(1)}M`;
};

type CapTier = "UNDER_CAP" | "OVER_CAP" | "FIRST_APRON" | "SECOND_APRON";

function getCapTier(team: Team): { tier: CapTier; label: string; color: string } {
  if ((team.secondApronSpace || 0) < 0)
    return { tier: "SECOND_APRON", label: "2nd Apron", color: "text-red-400 bg-red-500/10 border-l-2 border-red-400" };
  if ((team.firstApronSpace || 0) < 0)
    return { tier: "FIRST_APRON", label: "1st Apron", color: "text-orange-400 bg-orange-500/10 border-l-2 border-orange-400" };
  if ((team.capSpace || 0) < 0)
    return { tier: "OVER_CAP", label: "Over Cap", color: "text-yellow-400 bg-yellow-500/10 border-l-2 border-yellow-400" };
  return { tier: "UNDER_CAP", label: "Under Cap", color: "text-emerald-400 bg-emerald-500/10 border-l-2 border-emerald-400" };
}

function capValueColor(value: number): string {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-red-400";
  return "text-foreground";
}

export function TeamCard({
  team,
  allTeams,
  selectedTeamIdsInMachine,
  onRemoveTeam,
  selectedAssets,
  onAssetSelect,
  setSelectedTeams,
  setSelectedTeamIds,
  setSelectedAssets,
  setActiveTab,
}: TeamCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);

  const handleOpenPlayerStats = (player: Player) => {
    setSelectedPlayer(player);
    setIsStatsModalOpen(true);
  };

  const availableTeamsForChange = allTeams.filter(
    (t) => t.id === team.id || !selectedTeamIdsInMachine.includes(t.id)
  );
  const otherSelectedTeams = allTeams.filter(
    (t) => t.id !== team.id && selectedTeamIdsInMachine.includes(t.id)
  );

  const handleChangeTeam = async (oldTeamId: number, newTeam: Team) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/nba/team/${newTeam.id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch team data");
      }
      const responseData = await response.json();
      const teamWithRoster = responseData.data;

      setSelectedTeams((prev: Team[]) =>
        prev.map((t: Team) =>
          t.id === oldTeamId ? (teamWithRoster as Team) : t
        )
      );
      setSelectedTeamIds((prev: number[]) =>
        prev.map((id: number) => (id === oldTeamId ? newTeam.id : id))
      );
      setSelectedAssets([]);

      setActiveTab?.(newTeam.id.toString());
    } catch (error) {
      console.error("Error fetching team data:", error);
      toast.error("Failed to load team data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="flex flex-col h-auto overflow-hidden bg-surface-low">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2 pt-5 px-4 bg-surface-container">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex-1 min-w-0 text-lg font-semibold p-1 -ml-1 h-auto justify-start"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-on-surface-variant" />
              ) : (
                <div className="flex items-center gap-2 min-w-0 w-full">
                  {team.logos[0] && (
                    <Image
                      src={team.logos[0].href}
                      alt={team.logos[0].alt}
                      width={32}
                      height={32}
                      className="object-contain shrink-0"
                    />
                  )}
                  <span className="truncate">
                    {team.displayName}
                  </span>
                  <RepeatIcon
                    className="ml-1 h-4 w-4 shrink-0 text-on-surface-variant hover:text-foreground transition-colors"
                    strokeWidth={1.5}
                  />
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="max-h-60 overflow-y-auto"
          >
            {availableTeamsForChange.map((newTeam) => (
              <DropdownMenuItem
                key={newTeam.id}
                onSelect={() => handleChangeTeam(team.id, newTeam)}
                disabled={newTeam.id === team.id || isLoading}
                className="flex items-center gap-2"
              >
                {newTeam.logos[0] && (
                  <Image
                    src={newTeam.logos[0].href}
                    alt={newTeam.logos[0].alt}
                    width={28}
                    height={28}
                    className="object-contain"
                  />
                )}
                {newTeam.displayName}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemoveTeam(team.id)}
          className="shrink-0 text-on-surface-variant hover:text-destructive"
          disabled={isLoading}
        >
          <XIcon className="h-5 w-5" strokeWidth={1.5} />
          <span className="sr-only">Remove team</span>
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex-grow flex flex-col bg-surface-container">
        {/* Cap Status */}
        {(() => {
          const cap = getCapTier(team);
          return (
            <div className="mb-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-lg ${cap.color}`}>
                  {cap.label}
                </span>
                <span className="text-xs text-on-surface-variant">
                  Total: {formatM(team.totalCapAllocation || 0)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-surface-low px-2 py-1.5">
                  <div className="text-[10px] text-on-surface-variant mb-0.5">Cap Space</div>
                  <div className={`text-xs font-semibold ${capValueColor(team.capSpace || 0)}`}>
                    {formatM(team.capSpace || 0)}
                  </div>
                </div>
                <div className="rounded-lg bg-surface-low px-2 py-1.5">
                  <div className="text-[10px] text-on-surface-variant mb-0.5">1st Apron</div>
                  <div className={`text-xs font-semibold ${capValueColor(team.firstApronSpace || 0)}`}>
                    {formatM(team.firstApronSpace || 0)}
                  </div>
                </div>
                <div className="rounded-lg bg-surface-low px-2 py-1.5">
                  <div className="text-[10px] text-on-surface-variant mb-0.5">2nd Apron</div>
                  <div className={`text-xs font-semibold ${capValueColor(team.secondApronSpace || 0)}`}>
                    {formatM(team.secondApronSpace || 0)}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        <Tabs defaultValue="players" className="flex-grow flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger
              value="players"
              className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:border-border data-[state=active]:shadow-none"
            >
              <UsersIcon className="w-4 h-4 mr-1.5" strokeWidth={1.5} />
              Players
            </TabsTrigger>
            <TabsTrigger
              value="picks"
              className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:border-border data-[state=active]:shadow-none"
            >
              <FileTextIcon className="w-4 h-4 mr-1.5" strokeWidth={1.5} />
              Picks
            </TabsTrigger>
          </TabsList>
          <TabsContent value="players" className="flex-grow mt-2">
            <ScrollArea className="h-auto">
              <div className="space-y-2">
                {team.players?.map((player) => {
                  const isSelected = selectedAssets.some(
                    (asset) => asset.id === player.id && asset.type === "player"
                  );

                  return (
                    <DropdownMenu key={player.id}>
                      <div
                        className={`group relative flex items-center justify-between p-2.5 rounded-lg ${
                          isSelected
                            ? "bg-primary/10 glow-primary"
                            : "bg-surface-low hover:bg-surface-high"
                        } transition-all duration-200`}
                      >
                        <div className="flex items-center gap-3">
                          {player.headshot && (
                            <div className="bg-surface-highest p-1 rounded-lg">
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
                              <span className="text-xs text-on-surface-variant">
                                {player.position?.abbreviation || "Unknown"}{player.age ? `, Age: ${player.age}` : ""}
                              </span>
                            </div>
                            <div className="text-xs text-on-surface-variant">
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
                          </div>
                        </div>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-on-surface-variant hover:text-foreground focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isSelected ? (
                              <Minus className="h-4 w-4" />
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                            <span className="sr-only">
                              {isSelected
                                ? "Remove from trade"
                                : "Add to trade"}
                            </span>
                          </Button>
                        </DropdownMenuTrigger>
                      </div>

                      <DropdownMenuContent align="end" className="w-[200px]">
                        <DropdownMenuItem
                          onClick={() => handleOpenPlayerStats(player)}
                          className="flex items-center gap-2"
                        >
                          <BarChart3Icon className="h-4 w-4 text-indigoMain" />
                          View Stats
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {isSelected ? (
                          <DropdownMenuItem
                            onClick={() => {
                              setTimeout(() => {
                                onAssetSelect(player.id, "player", team.id);
                              }, 500);
                            }}
                            className="flex items-center gap-2 text-red-500 hover:text-red-600"
                          >
                            <Trash2Icon className="h-4 w-4" />
                            Remove Player
                          </DropdownMenuItem>
                        ) : otherSelectedTeams.length === 0 ? (
                          <DropdownMenuItem
                            onClick={() => {
                              onAssetSelect(player.id, "player", team.id);
                            }}
                            className="flex items-center gap-2 "
                          >
                            <UsersIcon className="h-4 w-4 text-indigoMain" />
                            Trade Player
                          </DropdownMenuItem>
                        ) : (
                          <>
                            <div className="px-2 py-1.5 text-xs text-on-surface-variant">
                              Trade to specific team:
                            </div>
                            {otherSelectedTeams.map((targetTeam) => (
                              <DropdownMenuItem
                                key={targetTeam.id}
                                onClick={() => {
                                  onAssetSelect(
                                    player.id,
                                    "player",
                                    team.id,
                                    targetTeam.id
                                  );
                                }}
                                className="flex items-center gap-2 "
                              >
                                {targetTeam.logos[0] && (
                                  <Image
                                    src={targetTeam.logos[0].href}
                                    alt={targetTeam.logos[0].alt}
                                    width={20}
                                    height={20}
                                    className="object-contain"
                                  />
                                )}
                                {targetTeam.displayName}
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="picks" className="flex-grow mt-2">
            <ScrollArea className="h-auto">
              <div className="space-y-2">
                {team.draftPicks?.map((pick) => {
                  const isSelected = selectedAssets.some(
                    (asset) => asset.id === pick.id && asset.type === "pick"
                  );

                  return (
                    <DropdownMenu key={pick.id}>
                      <div
                        className={`group relative flex items-center justify-between p-2.5 rounded-lg ${
                          isSelected
                            ? "bg-primary/10 glow-primary"
                            : "bg-surface-low hover:bg-surface-high"
                        } transition-all duration-200 cursor-pointer`}
                        onClick={(e) => {
                          if (otherSelectedTeams.length === 0) {
                            e.preventDefault();
                            onAssetSelect(pick.id, "pick", team.id);
                          }
                        }}
                      >
                        <div>
                          <div className="font-medium text-sm">
                            {pick.year} {pick.round === 1 ? "1st" : "2nd"} round{" "}
                            {pick.isSwap ? "Pick Swap" : "Pick"}
                          </div>
                          <div className="text-xs text-on-surface-variant">
                            {pick.description}
                          </div>
                        </div>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-on-surface-variant hover:text-foreground focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                          >
                            {isSelected ? (
                              <Minus className="h-4 w-4" />
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                            <span className="sr-only">
                              {isSelected
                                ? "Remove from trade"
                                : "Add to trade"}
                            </span>
                          </Button>
                        </DropdownMenuTrigger>
                      </div>

                      <DropdownMenuContent
                        align="end"
                        className="w-[200px]"
                        sideOffset={8}
                      >
                        <DropdownMenuSeparator />
                        {isSelected ? (
                          <DropdownMenuItem
                            onClick={() => {
                              onAssetSelect(pick.id, "pick", team.id);
                            }}
                            className="flex items-center gap-2 text-red-500 hover:text-red-600"
                          >
                            <Trash2Icon className="h-4 w-4" />
                            Remove Pick
                          </DropdownMenuItem>
                        ) : otherSelectedTeams.length === 0 ? (
                          <DropdownMenuItem
                            onClick={() => {
                              onAssetSelect(pick.id, "pick", team.id);
                            }}
                            className="flex items-center gap-2"
                          >
                            <FileTextIcon className="h-4 w-4" />
                            Trade Pick
                          </DropdownMenuItem>
                        ) : (
                          <>
                            <div className="px-2 py-1.5 text-xs text-on-surface-variant">
                              Trade to specific team:
                            </div>
                            {otherSelectedTeams.map((targetTeam) => (
                              <DropdownMenuItem
                                key={targetTeam.id}
                                onClick={() =>
                                  onAssetSelect(
                                    pick.id,
                                    "pick",
                                    team.id,
                                    targetTeam.id
                                  )
                                }
                                className="flex items-center gap-2"
                              >
                                {targetTeam.logos[0] && (
                                  <Image
                                    src={targetTeam.logos[0].href}
                                    alt={targetTeam.logos[0].alt}
                                    width={20}
                                    height={20}
                                    className="object-contain"
                                  />
                                )}
                                {targetTeam.displayName}
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Player Stats Modal */}
      <PlayerStatsModal
        player={selectedPlayer}
        espnId={selectedPlayer?.espnId}
        isOpen={isStatsModalOpen}
        onClose={() => {
          setIsStatsModalOpen(false);
          setSelectedPlayer(null);
        }}
        teamColor={team.color}
        teamAltColor={team.alternateColor}
      />
    </Card>
  );
}
