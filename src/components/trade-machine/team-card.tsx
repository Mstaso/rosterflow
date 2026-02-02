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

const formatCurrency = (value: number) => `${value.toLocaleString()}`;

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
    <Card className="flex flex-col h-auto overflow-hidden border-indigoMain bg-gradient-to-br from-background via-background/95 to-muted/80 ">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4 bg-muted/60">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="text-lg font-semibold p-1 -ml-1 h-auto flex items-center gap-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <>
                  {team.logos[0] && (
                    <Image
                      src={team.logos[0].href}
                      alt={team.logos[0].alt}
                      width={32}
                      height={32}
                      className="object-contain"
                    />
                  )}
                  {team.displayName}
                  <RepeatIcon
                    className="ml-2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                    strokeWidth={1.5}
                  />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="max-h-60 overflow-y-auto border-indigoMain"
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
          className="text-muted-foreground hover:text-destructive"
          disabled={isLoading}
        >
          <XIcon className="h-5 w-5" strokeWidth={1.5} />
          <span className="sr-only">Remove team</span>
        </Button>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex-grow flex flex-col bg-muted/60 border-indigoMain">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
          <div>
            Total Cap:{" "}
            <span className="font-medium text-foreground">
              {formatCurrency(team.totalCapAllocation || 0)}
            </span>
          </div>
          <div>
            Cap Space:{" "}
            <span className="font-medium text-foreground">
              {formatCurrency(team.capSpace || 0)}
            </span>
          </div>
          <div>
            1st Apron:{" "}
            <span className="font-medium text-foreground">
              {formatCurrency(team.firstApronSpace || 0)}
            </span>
          </div>
          <div>
            2nd Apron:{" "}
            <span className="font-medium text-foreground">
              {formatCurrency(team.secondApronSpace || 0)}
            </span>
          </div>
        </div>

        <Tabs defaultValue="players" className="flex-grow flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="players">
              <UsersIcon className="w-4 h-4 mr-1.5" strokeWidth={1.5} />
              Players
            </TabsTrigger>
            <TabsTrigger value="picks">
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
                        className={`group relative flex items-center justify-between p-2.5 rounded-md border-2 ${
                          isSelected
                            ? "bg-muted/90 border-white"
                            : "border-border bg-slate-950 hover:border-indigoMain/50"
                        } transition-colors cursor-pointer`}
                        onClick={() => handleOpenPlayerStats(player)}
                      >
                        <div className="flex items-center gap-3">
                          {player.headshot && (
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
                              {player.displayName}{" "}
                              <span className="text-xs text-muted-foreground">
                                ({player.position?.abbreviation || "Unknown"})
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
                          </div>
                        </div>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
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
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">
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
                        className={`group relative flex items-center justify-between p-2.5 rounded-md border-2 ${
                          isSelected
                            ? "bg-muted/90 border-white"
                            : "border-border bg-slate-950"
                        } transition-colors cursor-pointer`}
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
                          <div className="text-xs text-muted-foreground">
                            {pick.description}
                          </div>
                        </div>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
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
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">
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
