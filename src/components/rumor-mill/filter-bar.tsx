"use client";

import { XIcon } from "lucide-react";

export interface ActiveFilter {
  type: "player" | "team";
  id: number;
  name: string;
}

interface FilterBarProps {
  sourceType: "insider" | "fan" | null;
  onSourceChange: (type: "insider" | "fan" | null) => void;
  activeFilters: ActiveFilter[];
  onRemoveFilter: (filter: ActiveFilter) => void;
  onClearFilters: () => void;
}

const SOURCE_OPTIONS = [
  { value: null, label: "All" },
  { value: "insider" as const, label: "Insider Reports" },
  { value: "fan" as const, label: "Fan Discussion" },
];

export function FilterBar({
  sourceType,
  onSourceChange,
  activeFilters,
  onRemoveFilter,
  onClearFilters,
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Source toggle */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-low">
        {SOURCE_OPTIONS.map((opt) => {
          const isActive = sourceType === opt.value;
          return (
            <button
              key={opt.label}
              onClick={() => onSourceChange(opt.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? "bg-surface-high text-on-surface"
                  : "text-on-surface-variant/60 hover:text-on-surface-variant hover:bg-surface-container/50"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {activeFilters.map((filter) => (
            <span
              key={`${filter.type}-${filter.id}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-container text-xs text-on-surface-variant"
            >
              {filter.name}
              <button
                onClick={() => onRemoveFilter(filter)}
                className="text-on-surface-variant/40 hover:text-on-surface transition-colors"
                aria-label={`Remove ${filter.name} filter`}
              >
                <XIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            onClick={onClearFilters}
            className="text-[11px] text-primary-dim/60 hover:text-primary transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
