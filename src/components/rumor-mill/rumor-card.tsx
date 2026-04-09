"use client";

import Link from "next/link";
import {
  ArrowUpIcon,
  ExternalLinkIcon,
  ArrowLeftRight,
  SearchIcon,
} from "lucide-react";
import type { RumorWithEntities } from "~/actions/rumors";

interface RumorCardProps {
  rumor: RumorWithEntities;
  onEntityClick: (entityType: string, id: number, name: string) => void;
}

function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getSourceLabel(source: string): string {
  switch (source) {
    case "hoopsrumors":
      return "HoopsRumors";
    case "espn":
      return "ESPN";
    case "reddit":
      return "r/nba";
    default:
      return source;
  }
}

function buildTradeLink(
  entities: RumorWithEntities["entities"]
): { href: string; label: string; variant: "primary" | "ghost" } | null {
  const playerEntities = entities.filter(
    (e) => e.entityType === "player" && e.playerId
  );
  const teamEntities = entities.filter(
    (e) => e.entityType === "team" && e.teamId
  );

  // Collect unique team IDs (from team entities + players' current teams)
  const teamIds = new Set<number>();
  teamEntities.forEach((e) => {
    if (e.teamId) teamIds.add(e.teamId);
  });
  playerEntities.forEach((e) => {
    if (e.playerTeamId) teamIds.add(e.playerTeamId);
  });

  const hasMultipleEntities =
    (playerEntities.length >= 1 && teamIds.size >= 2) ||
    teamIds.size >= 2 ||
    (playerEntities.length >= 1 && teamEntities.length >= 1);

  if (hasMultipleEntities) {
    const params = new URLSearchParams();
    params.set("teamIds", Array.from(teamIds).join(","));

    if (playerEntities.length > 0) {
      const assets = playerEntities
        .filter((e) => e.playerTeamId)
        .map((e) => ({
          id: e.playerId!,
          type: "player" as const,
          teamId: e.playerTeamId!,
        }));
      if (assets.length > 0) {
        params.set("assets", JSON.stringify(assets));
      }
    }

    return {
      href: `/?${params.toString()}`,
      label: "Generate Trade",
      variant: "primary",
    };
  }

  if (teamIds.size === 1 || playerEntities.length === 1) {
    const params = new URLSearchParams();
    if (teamIds.size > 0) {
      params.set("teamIds", Array.from(teamIds).join(","));
    }
    return {
      href: `/?${params.toString()}`,
      label: "Explore Trades",
      variant: "ghost",
    };
  }

  return null;
}

export function RumorCard({ rumor, onEntityClick }: RumorCardProps) {
  const isInsider = rumor.sourceType === "insider";
  const tradeLink = buildTradeLink(rumor.entities);

  return (
    <article className="group relative bg-surface-container rounded-xl p-6 pt-5 transition-colors duration-200 hover:bg-surface-high/60">
      {/* Top row: source badge + timestamp + reddit score */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Source type badge */}
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider ${
              isInsider
                ? "bg-amber-500/10 text-amber-400/90"
                : "bg-sky-500/10 text-sky-400/90"
            }`}
          >
            {isInsider ? "Insider Report" : "Fan Discussion"}
          </span>

          {/* Source name */}
          <span className="text-xs text-on-surface-variant/60">
            {getSourceLabel(rumor.source)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Reddit score */}
          {rumor.redditScore != null && (
            <span className="flex items-center gap-1 text-xs text-on-surface-variant/60">
              <ArrowUpIcon className="h-3 w-3" />
              {rumor.redditScore.toLocaleString()}
            </span>
          )}

          {/* Timestamp */}
          <time className="text-xs text-on-surface-variant/40">
            {formatRelativeTime(rumor.publishedAt)}
          </time>
        </div>
      </div>

      {/* Title */}
      <a
        href={rumor.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group/title inline-flex items-start gap-2 mb-2"
      >
        <h3 className="text-on-surface font-semibold leading-snug group-hover/title:text-primary transition-colors">
          {rumor.title}
        </h3>
        <ExternalLinkIcon className="h-3.5 w-3.5 mt-1 shrink-0 text-on-surface-variant/30 group-hover/title:text-primary/60 transition-colors" />
      </a>

      {/* Summary */}
      {rumor.summary && (
        <p className="text-sm text-on-surface-variant/70 leading-relaxed line-clamp-2 mb-4">
          {rumor.summary}
        </p>
      )}

      {/* Bottom row: entity chips + action button */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Entity chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {rumor.entities.map((entity) => (
            <button
              key={entity.id}
              onClick={() =>
                onEntityClick(
                  entity.entityType,
                  (entity.entityType === "player"
                    ? entity.playerId
                    : entity.teamId)!,
                  entity.entityName
                )
              }
              className="inline-flex items-center px-2.5 py-1 rounded-md bg-surface-high text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-highest transition-colors"
            >
              {entity.entityName}
            </button>
          ))}
        </div>

        {/* Action button */}
        {tradeLink && (
          <Link
            href={tradeLink.href}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 shrink-0 ${
              tradeLink.variant === "primary"
                ? "bg-gradient-to-r from-primary to-indigoMain text-primary-foreground hover:brightness-110 shadow-lg shadow-primary/10"
                : "bg-transparent text-primary hover:bg-surface-high"
            }`}
          >
            {tradeLink.variant === "primary" ? (
              <ArrowLeftRight className="h-4 w-4" />
            ) : (
              <SearchIcon className="h-4 w-4" />
            )}
            {tradeLink.label}
          </Link>
        )}
      </div>
    </article>
  );
}
