"use client";

import { useState, useEffect } from "react";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { XIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import Image from "next/image";
import type { Player } from "~/types";

interface PlayerStatsModalProps {
  player: Player | null;
  espnId?: number;
  isOpen: boolean;
  onClose: () => void;
  teamColor?: string;
  teamAltColor?: string;
}

type SeasonStats = {
  season: string;
  teamSlug?: string;
  stats: string[];
};

type PerGameStats = {
  labels: string[];
  seasons: SeasonStats[];
  careerTotals: string[];
  currentSeasonYear?: string;
};

type AthleteInfo = {
  displayHeight?: string;
  displayWeight?: string;
  jersey?: string;
  headshot?: string;
  position?: string;
  teamColor?: string;
  teamAltColor?: string;
};

export function PlayerStatsModal({
  player,
  espnId,
  isOpen,
  onClose,
  teamColor,
  teamAltColor,
}: PlayerStatsModalProps) {
  const [perGameStats, setPerGameStats] = useState<PerGameStats | null>(null);
  const [athleteInfo, setAthleteInfo] = useState<AthleteInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine team colors with fallbacks (props > fetched > defaults)
  const primaryColor = teamColor || athleteInfo?.teamColor || "6366f1";
  const secondaryColor = teamAltColor || athleteInfo?.teamAltColor || "1e1b4b";

  useEffect(() => {
    if (!isOpen) {
      setPerGameStats(null);
      setAthleteInfo(null);
      setError(null);
      return;
    }

    if (!espnId) {
      setError("ESPN ID not available");
      return;
    }

    const fetchPlayerData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch both stats and athlete info in parallel
        const [statsResponse, athleteResponse] = await Promise.all([
          fetch(`/api/espn/athlete/${espnId}`),
          fetch(`https://site.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${espnId}`),
        ]);
   
        // Process stats
        if (statsResponse.ok) {
          const result = await statsResponse.json();
          
          if (result.success && result.data?.categories) {
            const averagesCategory = result.data.categories.find(
              (cat: any) => cat.sortKey === "averages"
            );
            
            if (averagesCategory) {
              const labels: string[] = averagesCategory.labels || averagesCategory.displayNames || [];
              
              const seasons: SeasonStats[] = [];
              if (averagesCategory.statistics && Array.isArray(averagesCategory.statistics)) {
                for (const seasonData of averagesCategory.statistics) {
                  if (seasonData?.stats && Array.isArray(seasonData.stats)) {
                    seasons.push({
                      season: seasonData.season?.displayName || "",
                      teamSlug: seasonData.teamSlug || "",
                      stats: seasonData.stats,
                    });
                  }
                }
              }
              
              const careerTotals: string[] = averagesCategory.totals || [];
              const lastSeason = seasons[seasons.length - 1];
              const currentSeasonYear = lastSeason?.season || "";
              
              setPerGameStats({
                labels,
                seasons,
                careerTotals,
                currentSeasonYear,
              });
            }
          }
        }

        // Process athlete info (height, weight, jersey, team colors)
        if (athleteResponse.ok) {
          const athleteData = await athleteResponse.json();
          const athlete = athleteData.athlete;
          
          if (athlete) {
            // Try to get team colors from athlete's team
            const athleteTeam = athlete.team;
            
            setAthleteInfo({
              displayHeight: athlete.displayHeight || "",
              displayWeight: athlete.displayWeight || "",
              jersey: athlete.jersey || "",
              headshot: athlete.headshot?.href || "",
              position: athlete.position?.abbreviation || "",
              teamColor: athleteTeam?.color || "",
              teamAltColor: athleteTeam?.alternateColor || "",
            });
          }
        }
      } catch (err) {
        console.error("Error fetching player data:", err);
        setError("Unable to load stats");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlayerData();
  }, [isOpen, espnId]);

  // Get key stats for the header (current season)
  const getStatValue = (label: string) => {
    if (!perGameStats || perGameStats.seasons.length === 0) return null;
    const index = perGameStats.labels.indexOf(label);
    if (index === -1) return null;
    const currentSeason = perGameStats.seasons[perGameStats.seasons.length - 1];
    if (!currentSeason) return null;
    return currentSeason.stats[index] || null;
  };

  const keyStats = [
    { label: "PTS", value: getStatValue("PTS") },
    { label: "REB", value: getStatValue("REB") },
    { label: "AST", value: getStatValue("AST") },
    { label: "FG%", value: getStatValue("FG%") },
  ].filter(s => s.value !== null);

  // Don't render anything if not open
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[100] bg-black/80 animate-in fade-in-0"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed left-[50%] top-[50%] z-[101] w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] animate-in fade-in-0 zoom-in-95 px-4">
        <div className="bg-background border border-border rounded-lg shadow-lg overflow-hidden">
          {/* Header with team colors */}
          <div
            className="relative"
            style={{
              background: `linear-gradient(135deg, #${primaryColor} 0%, #${secondaryColor} 100%)`,
            }}
          >
            <div className="absolute inset-0 bg-black/20" />
            
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-black/20 hover:bg-black/40 text-white"
              onClick={onClose}
            >
              <XIcon className="h-4 w-4" />
            </Button>

            <div className="relative px-5 pt-5 pb-4">
              <div className="flex items-center gap-4">
                {/* Player headshot */}
                <div className="relative flex-shrink-0">
                  {(athleteInfo?.headshot || player?.headshot?.href) ? (
                    <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/30 bg-white/10 shadow-lg">
                      <Image
                        src={athleteInfo?.headshot || player?.headshot?.href || ""}
                        alt={player?.displayName || "Player"}
                        width={80}
                        height={80}
                        className="object-cover w-full h-full"
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/30">
                      <span className="text-2xl font-bold text-white/80">
                        {player?.firstName?.[0]}{player?.lastName?.[0]}
                      </span>
                    </div>
                  )}
                  {/* Jersey number badge */}
                  {(athleteInfo?.jersey || player?.jersey) && (
                    <div className="absolute -bottom-1 -right-1 bg-white text-black font-bold text-xs w-7 h-7 rounded-full flex items-center justify-center shadow-md">
                      #{athleteInfo?.jersey || player?.jersey}
                    </div>
                  )}
                </div>

                {/* Player info */}
                <div className="flex-1 min-w-0 text-white">
                  <h2 className="text-xl font-bold truncate">
                    {player?.displayName}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 text-sm text-white/80">
                    <Badge className="bg-white/20 text-white border-0 text-xs px-2 py-0">
                      {athleteInfo?.position || player?.position?.abbreviation}
                    </Badge>
                    {(athleteInfo?.displayHeight || player?.displayHeight) && (
                      <span>{athleteInfo?.displayHeight || player?.displayHeight}</span>
                    )}
                    {(athleteInfo?.displayHeight || player?.displayHeight) && (athleteInfo?.displayWeight || player?.displayWeight) && (
                      <span className="text-white/40">·</span>
                    )}
                    {(athleteInfo?.displayWeight || player?.displayWeight) && (
                      <span>{athleteInfo?.displayWeight || player?.displayWeight}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Current Season Stats Banner - ESPN style */}
          {perGameStats && keyStats.length > 0 && (
            <div className="px-4 py-3 bg-background">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {perGameStats.currentSeasonYear} Regular Season Stats
              </div>
              <div className="flex justify-between items-end">
                {keyStats.map(({ label, value }) => (
                  <div key={label} className="text-center flex-1">
                    <div className="text-[10px] text-muted-foreground uppercase mb-0.5">{label}</div>
                    <div className="text-2xl font-bold text-foreground">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats section */}
          <div className="max-h-[50vh] overflow-y-auto">
            {isLoading ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-48 w-full" />
              </div>
            ) : error || !espnId ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">{error || "Stats not available"}</p>
              </div>
            ) : !perGameStats || perGameStats.seasons.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No stats available</p>
              </div>
            ) : (
              <div>
                {/* Per Game Stats Table */}
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3">
                    Per Game Stats
                  </h3>
                  
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10">
                          <tr className="bg-muted border-b border-border">
                            <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground sticky left-0 bg-muted">
                              Season
                            </th>
                            {perGameStats.labels.map((label, i) => (
                              <th 
                                key={i} 
                                className="px-2 py-2 text-xs font-semibold text-muted-foreground text-center whitespace-nowrap bg-muted"
                              >
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {/* Show seasons in reverse order (most recent first) */}
                          {[...perGameStats.seasons].reverse().map((season, idx) => (
                            <tr 
                              key={idx} 
                              className={`border-b border-border last:border-b-0 ${
                                idx === 0 ? "bg-muted font-medium" : "hover:bg-muted/20"
                              }`}
                            >
                              <td className={`px-3 py-2 text-xs whitespace-nowrap sticky left-0 ${
                                idx === 0 ? "bg-muted" : "bg-background"
                              }`}>
                                {season.season}
                              </td>
                              {season.stats.map((value, i) => (
                                <td 
                                  key={i} 
                                  className="px-2 py-2 text-center whitespace-nowrap"
                                >
                                  {value}
                                </td>
                              ))}
                            </tr>
                          ))}
                          {/* Career Totals Row */}
                          {perGameStats.careerTotals.length > 0 && (
                            <tr className="bg-muted font-semibold border-t-2 border-border">
                              <td className="px-3 py-2 text-xs whitespace-nowrap sticky left-0 bg-muted">
                                Career
                              </td>
                              {perGameStats.careerTotals.map((value, i) => (
                                <td 
                                  key={i} 
                                  className="px-2 py-2 text-center whitespace-nowrap"
                                >
                                  {value}
                                </td>
                              ))}
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Contract info if available */}
                {player?.contract && (
                  <div className="p-4 border-t border-border">
                    <h3 className="text-sm font-semibold text-foreground mb-3">
                      Contract
                    </h3>
                    <div className="flex gap-6 text-sm">
                      <div>
                        <span className="text-muted-foreground">Salary: </span>
                        <span className="font-medium">${(player.contract.salary / 1000000).toFixed(1)}M</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Years: </span>
                        <span className="font-medium">{player.contract.yearsRemaining}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
