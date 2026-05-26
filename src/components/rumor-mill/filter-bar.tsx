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
  activeFilter: ActiveFilter | null;
  onClearFilter: () => void;
}

const SOURCE_OPTIONS = [
  { value: null, label: "All" },
  { value: "insider" as const, label: "Insider Reports" },
  { value: "fan" as const, label: "Fan Discussion" },
];

export function FilterBar({
  sourceType,
  onSourceChange,
  activeFilter,
  onClearFilter,
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

      {/* Active filter pill */}
      {activeFilter && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-on-surface-variant/50 font-medium">
            Filtering by
          </span>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 text-primary ring-1 ring-primary/30 text-xs font-medium">
            <span className="text-[10px] uppercase tracking-wider opacity-70">
              {activeFilter.type}
            </span>
            {activeFilter.name}
            <button
              onClick={onClearFilter}
              className="text-primary/60 hover:text-primary transition-colors -mr-1"
              aria-label={`Clear ${activeFilter.name} filter`}
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
