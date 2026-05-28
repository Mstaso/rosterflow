"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";
import Image from "next/image";
import type { Player } from "~/types";

interface PlayerStatsModalProps {
  player: Player | null;
  espnId?: number;
  isOpen: boolean;
  onClose: () => void;
  /** Optional override; otherwise derived from fetched athlete team. */
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
  teamAbbreviation?: string;
  teamDisplayName?: string;
};

const DEFAULT_VISIBLE_SEASONS = 5;

// Minimal shape of the ESPN stats-categories payload. The endpoint returns
// more fields; we narrow to what the table needs so the `any` escape hatch
// goes away and so an upstream rename surfaces at compile time.
type EspnStatsCategory = {
  sortKey: string;
  labels?: string[];
  displayNames?: string[];
  totals?: string[];
  statistics?: Array<{
    season?: { displayName?: string };
    teamSlug?: string;
    stats?: string[];
  }>;
};

// Brand-aligned default header tint when ESPN doesn't surface team colors
// or the player passed in doesn't carry them. Derived from the project's
// `--primary` (teal) and a deeper companion to keep the gradient on-brand
// rather than reaching for the legacy pre-pivot indigo.
const DEFAULT_PRIMARY_HEX = "1e556c";
const DEFAULT_SECONDARY_HEX = "0d2a3a";

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
  const [showAllSeasons, setShowAllSeasons] = useState(false);

  const primaryColor =
    teamColor || athleteInfo?.teamColor || DEFAULT_PRIMARY_HEX;
  const secondaryColor =
    teamAltColor || athleteInfo?.teamAltColor || DEFAULT_SECONDARY_HEX;

  useEffect(() => {
    if (!isOpen) {
      setPerGameStats(null);
      setAthleteInfo(null);
      setError(null);
      setShowAllSeasons(false);
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
        const [statsResponse, athleteResponse] = await Promise.all([
          fetch(`/api/espn/athlete/${espnId}`),
          fetch(
            `https://site.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${espnId}`
          ),
        ]);

        if (statsResponse.ok) {
          const result = await statsResponse.json();

          if (result.success && result.data?.categories) {
            const averagesCategory = (
              result.data.categories as EspnStatsCategory[]
            ).find((cat) => cat.sortKey === "averages");

            if (averagesCategory) {
              const labels: string[] =
                averagesCategory.labels || averagesCategory.displayNames || [];

              const seasons: SeasonStats[] = [];
              if (Array.isArray(averagesCategory.statistics)) {
                for (const seasonData of averagesCategory.statistics) {
                  if (Array.isArray(seasonData?.stats)) {
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

        if (athleteResponse.ok) {
          const athleteData = await athleteResponse.json();
          const athlete = athleteData.athlete;

          if (athlete) {
            const athleteTeam = athlete.team;
            setAthleteInfo({
              displayHeight: athlete.displayHeight || "",
              displayWeight: athlete.displayWeight || "",
              jersey: athlete.jersey || "",
              headshot: athlete.headshot?.href || "",
              position: athlete.position?.abbreviation || "",
              teamColor: athleteTeam?.color || "",
              teamAltColor: athleteTeam?.alternateColor || "",
              teamAbbreviation: athleteTeam?.abbreviation || "",
              teamDisplayName: athleteTeam?.displayName || athleteTeam?.name || "",
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

  // Read a single stat value from the current season row, used by the
  // inline editorial summary line. Returns null when the label isn't
  // present so the summary can skip missing fields gracefully.
  const getStatValue = (label: string) => {
    if (!perGameStats || perGameStats.seasons.length === 0) return null;
    const index = perGameStats.labels.indexOf(label);
    if (index === -1) return null;
    const currentSeason = perGameStats.seasons[perGameStats.seasons.length - 1];
    return currentSeason?.stats[index] || null;
  };

  const pts = getStatValue("PTS");
  const reb = getStatValue("REB");
  const ast = getStatValue("AST");
  const fgp = getStatValue("FG%");
  const gp = getStatValue("GP");

  // Editorial one-liner under the player name. Reads like a sentence
  // rather than a hero-metric grid, which keeps the modal off the
  // banned SaaS-cliché template and lets the dense Season History table
  // below carry the real signal.
  const buildSummaryLine = () => {
    const parts: string[] = [];
    if (pts) parts.push(`${pts} pts`);
    if (reb) parts.push(`${reb} reb`);
    if (ast) parts.push(`${ast} ast`);
    if (fgp) parts.push(`${fgp}% FG`);
    if (gp) parts.push(`${gp} games`);
    return parts.join(" · ");
  };

  const summaryLine = perGameStats ? buildSummaryLine() : "";

  const displayName =
    player?.displayName ||
    [player?.firstName, player?.lastName].filter(Boolean).join(" ") ||
    "Player";

  const position = athleteInfo?.position || player?.position?.abbreviation;
  const height = athleteInfo?.displayHeight || player?.displayHeight;
  const weight = athleteInfo?.displayWeight || player?.displayWeight;
  const jersey = athleteInfo?.jersey || player?.jersey;
  const hasAge = !!player?.age && player.age > 0;
  const headshotSrc = athleteInfo?.headshot || player?.headshot?.href;
  const teamAbbr = athleteInfo?.teamAbbreviation?.toLowerCase();
  const teamLogoSrc = teamAbbr
    ? `https://a.espncdn.com/i/teamlogos/nba/500/${teamAbbr}.png`
    : null;

  // Cap the visible season rows so the table doesn't dominate the panel
  // with 12+ years of history. Career row always shows. "Show all" toggle
  // appears below the table when there are more seasons hidden.
  const allSeasons = perGameStats
    ? [...perGameStats.seasons].reverse()
    : [];
  const visibleSeasons = showAllSeasons
    ? allSeasons
    : allSeasons.slice(0, DEFAULT_VISIBLE_SEASONS);
  const hiddenSeasonsCount = allSeasons.length - visibleSeasons.length;

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side="right"
        // z-[110] sits above the navbar (z-100). Without this override
        // the Sheet's z-50 base sits under the navbar and the player
        // name h2 is occluded by the COMMUNITY TRADES masthead.
        className="z-[110] w-full sm:max-w-2xl bg-surface-low border-l border-outline-variant/15 p-0 overflow-y-auto motion-reduce:transition-none"
      >
        {/* Header band — team-color gradient as identity wash. The team
            colors are muted by mixing 55% team color with a deep
            surface-dark so the band reads as branded backdrop rather
            than a saturated billboard. The team logo lives as a large
            translucent watermark in the bottom-right corner of the band,
            giving instant team recognition without competing with the
            player name or headshot. */}
        <div
          className="relative overflow-hidden px-5 pt-6 pb-5"
          style={{
            background: `linear-gradient(135deg, color-mix(in srgb, #${primaryColor} 55%, #0a0f18) 0%, color-mix(in srgb, #${secondaryColor} 55%, #0a0f18) 100%)`,
          }}
        >
          {teamLogoSrc && (
            <Image
              src={teamLogoSrc}
              alt=""
              width={180}
              height={180}
              aria-hidden
              className="absolute -right-6 -bottom-8 w-44 h-44 opacity-15 pointer-events-none select-none"
            />
          )}

          <div className="relative flex items-center gap-4">
            <div className="relative flex-shrink-0">
              {headshotSrc ? (
                <div className="w-20 h-20 rounded-full overflow-hidden bg-surface-container">
                  <Image
                    src={headshotSrc}
                    alt=""
                    width={80}
                    height={80}
                    className="object-cover w-full h-full"
                  />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center">
                  <span className="text-2xl font-semibold text-on-surface">
                    {player?.firstName?.[0]}
                    {player?.lastName?.[0]}
                  </span>
                </div>
              )}
              {jersey && (
                <div className="absolute -bottom-1 -right-1 bg-surface text-on-surface font-semibold text-xs w-7 h-7 rounded-full flex items-center justify-center">
                  #{jersey}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 text-on-surface">
              <SheetTitle className="text-xl font-bold tracking-tight truncate text-on-surface">
                {displayName}
              </SheetTitle>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 font-supermolot text-[10px] tracking-[0.22em] text-on-surface/80">
                {position && <span>{position}</span>}
                {hasAge && (
                  <>
                    <span className="text-on-surface/40" aria-hidden>·</span>
                    <span>AGE {player.age}</span>
                  </>
                )}
                {height && (
                  <>
                    <span className="text-on-surface/40" aria-hidden>·</span>
                    <span>{height}</span>
                  </>
                )}
                {weight && (
                  <>
                    <span className="text-on-surface/40" aria-hidden>·</span>
                    <span>{weight}</span>
                  </>
                )}
              </div>
              {player?.contract && (
                <div className="flex items-center gap-1.5 mt-1.5 text-sm text-on-surface/90 tabular-nums">
                  <span className="font-medium">
                    ${(player.contract.salary / 1000000).toFixed(1)}M
                  </span>
                  <span className="text-on-surface/40" aria-hidden>·</span>
                  <span>
                    {player.contract.yearsRemaining}{" "}
                    {player.contract.yearsRemaining === 1 ? "yr" : "yrs"}{" "}
                    remaining
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hidden SheetDescription is always rendered to satisfy Radix's
            aria-describedby requirement; the visible per-game line is
            shown when stats are loaded. */}
        <SheetDescription className="sr-only">
          Career stats and per-game averages for {displayName}.
        </SheetDescription>

        {/* Editorial per-game summary. Bumped to display scale so the
            current-season line reads as the headline number — still
            sentence-shaped (off the banned hero-metric grid template),
            but large enough to be the modal's anchor stat block. */}
        {summaryLine && perGameStats?.currentSeasonYear && (
          <div className="px-5 py-4 bg-surface-container">
            <div className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant mb-2">
              {perGameStats.currentSeasonYear} · PER GAME
            </div>
            <div className="text-lg sm:text-xl font-semibold tracking-tight text-foreground tabular-nums leading-snug">
              {summaryLine}
            </div>
          </div>
        )}

        {/* Stats body */}
        <div className="px-5 pt-5 pb-6">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-32 mb-3" />
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : error || !espnId ? (
            <div className="text-center py-8 text-on-surface-variant">
              <p className="text-sm">{error || "Stats not available"}</p>
            </div>
          ) : !perGameStats || perGameStats.seasons.length === 0 ? (
            <div className="text-center py-8 text-on-surface-variant">
              <p className="text-sm">No stats available</p>
            </div>
          ) : (
            <>
              <h3 className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant mb-3">
                SEASON HISTORY
              </h3>

              {/* Sticky Season column. The sticky <td>/<th> get an
                  explicit opaque background plus a right-edge shadow so
                  scrolling stat cells disappear cleanly behind the
                  column instead of bleeding through. The outer
                  overflow-hidden traps any horizontal scroll inside the
                  ring; without it the -mx-5 px-5 pattern leaks columns
                  to the left of the sticky cell. */}
              <div className="overflow-hidden rounded-md">
                <div className="overflow-x-auto">
                <table className="w-full text-xs tabular-nums border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th
                        scope="col"
                        className="px-2.5 py-2 text-left font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant sticky left-0 z-20 bg-surface-high shadow-[4px_0_8px_-4px_rgba(0,0,0,0.55)]"
                      >
                        Season
                      </th>
                      {perGameStats.labels.map((label, i) => (
                        <th
                          key={i}
                          scope="col"
                          className="px-1.5 py-2 font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant text-center whitespace-nowrap bg-surface-high"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSeasons.map((season, idx) => {
                      const isCurrent = idx === 0;
                      const rowBg = isCurrent ? "bg-surface-high" : "bg-surface-low";
                      return (
                        <tr
                          key={idx}
                          className={isCurrent ? "font-medium" : ""}
                        >
                          <td
                            className={`px-2.5 py-1.5 text-[11px] whitespace-nowrap sticky left-0 z-10 ${rowBg} shadow-[4px_0_8px_-4px_rgba(0,0,0,0.55)]`}
                          >
                            {season.season}
                          </td>
                          {season.stats.map((value, i) => (
                            <td
                              key={i}
                              className={`px-1.5 py-1.5 text-center whitespace-nowrap ${rowBg}`}
                            >
                              {value}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                    {perGameStats.careerTotals.length > 0 && (
                      <tr className="font-semibold">
                        <td className="px-2.5 py-1.5 text-[11px] whitespace-nowrap sticky left-0 z-10 bg-surface-high shadow-[4px_0_8px_-4px_rgba(0,0,0,0.55)]">
                          Career
                        </td>
                        {perGameStats.careerTotals.map((value, i) => (
                          <td
                            key={i}
                            className="px-1.5 py-1.5 text-center whitespace-nowrap bg-surface-high"
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

              {hiddenSeasonsCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllSeasons(true)}
                  className="mt-3 font-supermolot text-[11px] tracking-[0.22em] text-primary hover:underline"
                >
                  SHOW ALL {allSeasons.length} SEASONS
                </button>
              )}
              {showAllSeasons && allSeasons.length > DEFAULT_VISIBLE_SEASONS && (
                <button
                  type="button"
                  onClick={() => setShowAllSeasons(false)}
                  className="mt-3 font-supermolot text-[11px] tracking-[0.22em] text-on-surface-variant hover:text-foreground"
                >
                  SHOW RECENT {DEFAULT_VISIBLE_SEASONS}
                </button>
              )}

              {/* ESPN attribution. The data isn't ours; the footer link
                  is the honest source-of-truth pointer Alex expects and
                  the H10 affordance the prior critique flagged missing. */}
              {espnId && (
                <div className="mt-4 pt-3 border-t border-outline-variant/15 flex items-center justify-between text-[11px] text-on-surface-variant">
                  <span>Stats via ESPN</span>
                  <a
                    href={`https://www.espn.com/nba/player/_/id/${espnId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-supermolot tracking-[0.22em] text-primary hover:underline"
                  >
                    VIEW ON ESPN ↗
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
