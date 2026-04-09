"use client";

import { useState, useCallback, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { BuzzScoreSection } from "./buzz-score-section";
import { FilterBar, type ActiveFilter } from "./filter-bar";
import { RumorCard } from "./rumor-card";
import {
  getRumors,
  type RumorWithEntities,
  type BuzzItem,
} from "~/actions/rumors";

interface RumorMillClientProps {
  initialRumors: RumorWithEntities[];
  initialTotal: number;
  initialTotalPages: number;
  buzzPlayers: BuzzItem[];
  buzzTeams: BuzzItem[];
}

export function RumorMillClient({
  initialRumors,
  initialTotal,
  initialTotalPages,
  buzzPlayers,
  buzzTeams,
}: RumorMillClientProps) {
  const [rumors, setRumors] = useState(initialRumors);
  const [total, setTotal] = useState(initialTotal);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [page, setPage] = useState(1);

  const [sourceType, setSourceType] = useState<"insider" | "fan" | null>(null);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);

  const [isPending, startTransition] = useTransition();
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchRumors = useCallback(
    (
      newPage: number,
      newSource: "insider" | "fan" | null,
      filters: ActiveFilter[],
      append: boolean
    ) => {
      const playerFilter = filters.find((f) => f.type === "player");
      const teamFilter = filters.find((f) => f.type === "team");

      if (append) setIsLoadingMore(true);

      startTransition(async () => {
        const result = await getRumors({
          page: newPage,
          sourceType: newSource,
          playerId: playerFilter?.id ?? null,
          teamId: teamFilter?.id ?? null,
        });

        if (append) {
          setRumors((prev) => [...prev, ...result.rumors]);
          setIsLoadingMore(false);
        } else {
          setRumors(result.rumors);
        }
        setTotal(result.total);
        setTotalPages(result.totalPages);
        setPage(newPage);
      });
    },
    []
  );

  const handleSourceChange = useCallback(
    (newSource: "insider" | "fan" | null) => {
      setSourceType(newSource);
      fetchRumors(1, newSource, activeFilters, false);
    },
    [activeFilters, fetchRumors]
  );

  const toggleEntityFilter = useCallback(
    (type: "player" | "team", id: number, name: string) => {
      setActiveFilters((prev) => {
        const existing = prev.find((f) => f.type === type && f.id === id);
        let next: ActiveFilter[];
        if (existing) {
          // Toggle off — remove this filter
          next = prev.filter((f) => !(f.type === type && f.id === id));
        } else {
          // Toggle on — replace existing filter of same type
          const filtered = prev.filter((f) => f.type !== type);
          next = [...filtered, { type, id, name }];
        }
        fetchRumors(1, sourceType, next, false);
        return next;
      });
    },
    [sourceType, fetchRumors]
  );

  const removeFilter = useCallback(
    (filter: ActiveFilter) => {
      setActiveFilters((prev) => {
        const next = prev.filter(
          (f) => !(f.type === filter.type && f.id === filter.id)
        );
        fetchRumors(1, sourceType, next, false);
        return next;
      });
    },
    [sourceType, fetchRumors]
  );

  const clearFilters = useCallback(() => {
    setActiveFilters([]);
    fetchRumors(1, sourceType, [], false);
  }, [sourceType, fetchRumors]);

  const handleLoadMore = useCallback(() => {
    if (page < totalPages) {
      fetchRumors(page + 1, sourceType, activeFilters, true);
    }
  }, [page, totalPages, sourceType, activeFilters, fetchRumors]);

  const handleEntityClick = useCallback(
    (entityType: string, id: number, name: string) => {
      toggleEntityFilter(entityType as "player" | "team", id, name);
    },
    [toggleEntityFilter]
  );

  return (
    <div className="container mx-auto px-4 md:px-6 lg:px-8 py-8 flex flex-col gap-6 flex-1">
      {/* Buzz Score Ticker */}
      <BuzzScoreSection
        players={buzzPlayers}
        teams={buzzTeams}
        onBuzzClick={toggleEntityFilter}
      />

      {/* Filters */}
      <FilterBar
        sourceType={sourceType}
        onSourceChange={handleSourceChange}
        activeFilters={activeFilters}
        onRemoveFilter={removeFilter}
        onClearFilters={clearFilters}
      />

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-on-surface-variant/40">
          {total} rumor{total !== 1 ? "s" : ""}
          {activeFilters.length > 0 || sourceType ? " matching filters" : ""}
        </p>
        {isPending && !isLoadingMore && (
          <Loader2Icon className="h-4 w-4 text-primary animate-spin" />
        )}
      </div>

      {/* Rumor Feed */}
      {rumors.length > 0 ? (
        <div className="flex flex-col gap-3">
          {rumors.map((rumor) => (
            <RumorCard
              key={rumor.id}
              rumor={rumor}
              onEntityClick={handleEntityClick}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-sm text-on-surface-variant/50">
            {isPending ? "Loading rumors..." : "No rumors found."}
          </p>
          {activeFilters.length > 0 && !isPending && (
            <button
              onClick={clearFilters}
              className="text-xs text-primary hover:text-primary/80 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Load More */}
      {page < totalPages && rumors.length > 0 && (
        <div className="flex justify-center pt-4 pb-8">
          <button
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-surface-container text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-colors disabled:opacity-50"
          >
            {isLoadingMore ? (
              <>
                <Loader2Icon className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
