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

type StatItem = {
  label: string;
  value: string;
};

export function PlayerStatsModal({
  player,
  espnId,
  isOpen,
  onClose,
  teamColor,
  teamAltColor,
}: PlayerStatsModalProps) {
  const [stats, setStats] = useState<StatItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [athleteData, setAthleteData] = useState<any>(null);

  // Determine team colors with fallbacks
  const primaryColor = teamColor || athleteData?.team?.color || "6366f1";
  const secondaryColor = teamAltColor || athleteData?.team?.alternateColor || "1e1b4b";

  useEffect(() => {
    if (!isOpen) {
      // Reset state when closed
      setStats([]);
      setAthleteData(null);
      setError(null);
      return;
    }

    if (!espnId) {
      setError("ESPN ID not available");
      return;
    }

    const fetchPlayerStats = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Use our API route to avoid CORS
        const response = await fetch(`/api/espn/athlete/${espnId}`);

        if (!response.ok) {
          throw new Error("Failed to fetch player data");
        }

        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error || "Failed to fetch data");
        }

        const data = result.data;
        setAthleteData(data.athlete);

        // Parse stats from the response
        const parsedStats: StatItem[] = [];
        
        // Check for statistics array at root level
        if (data.statistics && Array.isArray(data.statistics)) {
          for (const seasonStats of data.statistics) {
            if (seasonStats?.splits?.categories) {
              for (const category of seasonStats.splits.categories) {
                if (category.stats) {
                  for (const stat of category.stats) {
                    if (stat.displayValue !== undefined && stat.abbreviation) {
                      if (!parsedStats.some(s => s.label === stat.abbreviation)) {
                        parsedStats.push({
                          label: stat.abbreviation,
                          value: String(stat.displayValue),
                        });
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // Check for stats on athlete object
        if (data.athlete?.statistics && Array.isArray(data.athlete.statistics)) {
          for (const statGroup of data.athlete.statistics) {
            if (statGroup.splits?.categories) {
              for (const category of statGroup.splits.categories) {
                if (category.stats) {
                  for (const stat of category.stats) {
                    if (stat.displayValue !== undefined && stat.abbreviation) {
                      if (!parsedStats.some(s => s.label === stat.abbreviation)) {
                        parsedStats.push({
                          label: stat.abbreviation,
                          value: String(stat.displayValue),
                        });
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // Check for displayStats (simpler format)
        if (data.athlete?.displayStats && Array.isArray(data.athlete.displayStats)) {
          for (const stat of data.athlete.displayStats) {
            if (stat.displayValue !== undefined && stat.abbreviation) {
              if (!parsedStats.some(s => s.label === stat.abbreviation)) {
                parsedStats.push({
                  label: stat.abbreviation,
                  value: String(stat.displayValue),
                });
              }
            }
          }
        }

        console.log("Parsed stats:", parsedStats); // Debug log
        setStats(parsedStats);
      } catch (err) {
        console.error("Error fetching player stats:", err);
        setError("Unable to load stats");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlayerStats();
  }, [isOpen, espnId]);

  // Key stats we want to highlight at the top
  const keyStatLabels = ["PTS", "REB", "AST", "STL", "BLK", "FG%", "3P%", "FT%"];
  const keyStats = keyStatLabels
    .map(label => stats.find(s => s.label === label))
    .filter((s): s is StatItem => s !== undefined);

  const otherStats = stats.filter(s => !keyStatLabels.includes(s.label));

  // Don't render anything if not open
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-50 bg-black/80 animate-in fade-in-0"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed left-[50%] top-[50%] z-50 w-full max-w-md translate-x-[-50%] translate-y-[-50%] animate-in fade-in-0 zoom-in-95">
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
                  {(athleteData?.headshot?.href || player?.headshot?.href) ? (
                    <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/30 bg-white/10 shadow-lg">
                      <Image
                        src={athleteData?.headshot?.href || player?.headshot?.href || ""}
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
                  <div className="absolute -bottom-1 -right-1 bg-white text-black font-bold text-xs w-7 h-7 rounded-full flex items-center justify-center shadow-md">
                    #{player?.jersey || athleteData?.jersey || "?"}
                  </div>
                </div>

                {/* Player info */}
                <div className="flex-1 min-w-0 text-white">
                  <h2 className="text-xl font-bold truncate">
                    {player?.displayName || athleteData?.displayName}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 text-sm text-white/80">
                    <Badge className="bg-white/20 text-white border-0 text-xs px-2 py-0">
                      {player?.position?.abbreviation || athleteData?.position?.abbreviation}
                    </Badge>
                    <span>{player?.displayHeight || athleteData?.displayHeight}</span>
                    <span className="text-white/40">·</span>
                    <span>{player?.displayWeight || athleteData?.displayWeight}</span>
                  </div>
                  {athleteData?.team?.displayName && (
                    <div className="flex items-center gap-2 mt-1.5">
                      {athleteData.team.logos?.[0]?.href && (
                        <Image
                          src={athleteData.team.logos[0].href}
                          alt={athleteData.team.displayName}
                          width={18}
                          height={18}
                          className="object-contain"
                        />
                      )}
                      <span className="text-sm text-white/80">{athleteData.team.displayName}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stats section */}
          <div className="p-5 max-h-[50vh] overflow-y-auto">
            {isLoading ? (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2">
                  {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                  ))}
                </div>
              </div>
            ) : error || !espnId ? (
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-sm">{error || "Stats not available"}</p>
              </div>
            ) : stats.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-sm">No stats available for this season</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Key stats - larger display */}
                {keyStats.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {keyStats.map(({ label, value }) => (
                      <div
                        key={label}
                        className="text-center p-3 rounded-lg bg-muted/50"
                      >
                        <div className="text-lg font-bold">{value}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Other stats - compact list */}
                {otherStats.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      More Stats
                    </h4>
                    <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
                      {otherStats.slice(0, 15).map(({ label, value }) => (
                        <div key={label} className="flex justify-between text-sm py-1">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contract info if available */}
                {player?.contract && (
                  <div className="pt-3 border-t border-border">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      Contract
                    </h4>
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
