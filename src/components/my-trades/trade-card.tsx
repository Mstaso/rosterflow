"use client";

import { Card } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowBigUp,
  ArrowBigDown,
  MessageCircleIcon,
} from "lucide-react";
import { type TradeWithAssets } from "~/actions/trades";
import { computeSubdeck, type TeamTradeMove } from "~/lib/trade-warnings";
import type { Player, Team } from "~/types";
import Image from "next/image";
import Link from "next/link";
import { cn } from "~/lib/utils";

/**
 * Per-target-team grouping of assets. Mirrors the structure
 * `saved-trade-detail.tsx` uses so the two views share a mental model —
 * the index card is the contact-sheet of the article that lives at
 * `/my-trades/[id]`, not a separate document type.
 */
type TeamTradeInfo = {
  tradeTeam: TradeWithAssets["assets"][0]["tradeTeam"];
  playersReceived: TradeWithAssets["assets"];
  picksReceived: TradeWithAssets["assets"];
  playersSent: TradeWithAssets["assets"];
  picksSent: TradeWithAssets["assets"];
  outgoingSalary: number;
  incomingSalary: number;
  capDifference: number;
};

function groupAssetsByTargetTeam(
  assets: TradeWithAssets["assets"]
): TeamTradeInfo[] {
  const teamMap = new Map<number, TeamTradeInfo>();

  // First pass: assets are organized by who *receives* them.
  assets.forEach((asset) => {
    const targetId = asset.targetTradeTeamId;
    if (!teamMap.has(targetId)) {
      teamMap.set(targetId, {
        tradeTeam: asset.targetTradeTeam,
        playersReceived: [],
        picksReceived: [],
        playersSent: [],
        picksSent: [],
        outgoingSalary: 0,
        incomingSalary: 0,
        capDifference: 0,
      });
    }
    const info = teamMap.get(targetId)!;
    if (asset.type === "player") {
      info.playersReceived.push(asset);
      info.incomingSalary += asset.playerSalary || 0;
    } else if (asset.type === "pick") {
      info.picksReceived.push(asset);
    }
  });

  // Second pass: same assets viewed from the sender's side.
  assets.forEach((asset) => {
    const sourceId = asset.tradeTeamId;
    if (!teamMap.has(sourceId)) return;
    const info = teamMap.get(sourceId)!;
    if (asset.type === "player") {
      info.playersSent.push(asset);
      info.outgoingSalary += asset.playerSalary || 0;
    } else if (asset.type === "pick") {
      info.picksSent.push(asset);
    }
  });

  teamMap.forEach((info) => {
    info.capDifference = info.incomingSalary - info.outgoingSalary;
  });

  return Array.from(teamMap.values());
}

/**
 * Adapt the DB `TradeTeamSnapshot` shape into the `TeamTradeMove` shape that
 * `computeSubdeck` reads. The subdeck only touches a small slice of `Team`
 * (apron spaces, capSpace, displayName, optional `name` mascot), so the
 * cast is safe and intentional — we don't want to pull a full Team query
 * into the card just to format one editorial line.
 */
function buildSubdeckMoves(teamsInfo: TeamTradeInfo[]): TeamTradeMove[] {
  return teamsInfo.map((info) => ({
    team: {
      displayName: info.tradeTeam.teamDisplayName,
      // The snapshot doesn't carry the mascot-only name; computeSubdeck's
      // shortTeamName helper gracefully falls back to displayName.
      capSpace: info.tradeTeam.capSpace ?? 0,
      firstApronSpace: info.tradeTeam.firstApronSpace ?? 0,
      secondApronSpace: info.tradeTeam.secondApronSpace ?? 0,
    } as unknown as Team,
    playersSent: [] as Player[],
    picksSent: [],
    playersReceived: [] as Player[],
    picksReceived: [],
    outgoingSalary: info.outgoingSalary,
    incomingSalary: info.incomingSalary,
    capDifference: info.capDifference,
  }));
}

function formatDate(date: Date) {
  // Editorial: "May 27" reads better in an eyebrow than "5/27/26".
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatMillions(value: number) {
  return `$${(value / 1_000_000).toFixed(1)}M`;
}

/**
 * Compact one-liner of what a team gives or receives. Players first
 * (lastname only for tight scanning), then picks. "+N more" tail when
 * the line would otherwise overflow. The detail page shows full names;
 * here we trade fullness for density.
 */
function summarizeAssetLine(
  players: TradeWithAssets["assets"],
  picks: TradeWithAssets["assets"],
  limit = 4
): string {
  const parts: string[] = [];
  for (const p of players) {
    if (!p.playerName) continue;
    const lastName = p.playerName.split(" ").slice(1).join(" ") || p.playerName;
    parts.push(lastName);
  }
  for (const pk of picks) {
    if (pk.pickYear && pk.pickRound) {
      parts.push(`${pk.pickYear} R${pk.pickRound}`);
    }
  }
  if (parts.length === 0) return "—";
  if (parts.length <= limit) return parts.join(" · ");
  return `${parts.slice(0, limit).join(" · ")} · +${parts.length - limit} more`;
}

interface TradeCardProps {
  trade: TradeWithAssets;
  currentUserId: string | null;
  showOwnership?: boolean;
  onVote: (tradeId: number, value: 1 | -1, e: React.MouseEvent) => void;
  /**
   * Legacy click handler from the role="button" era. Kept in the props
   * shape because callers still pass it, but the Link wrapper is now the
   * navigation source of truth. Ignored here.
   */
  onClick?: () => void;
}

export function TradeCard({
  trade,
  currentUserId,
  showOwnership = false,
  onVote,
}: TradeCardProps) {
  const teamsInfo = groupAssetsByTargetTeam(trade.assets);
  const subdeck = computeSubdeck(buildSubdeckMoves(teamsInfo));
  const isOwnTrade = trade.userId === currentUserId;

  const votes = trade.votes || [];
  const upvotes = votes.filter((v) => v.value === 1).length;
  const downvotes = votes.filter((v) => v.value === -1).length;
  const score = upvotes - downvotes;
  const userVote = votes.find((v) => v.userId === currentUserId)?.value ?? 0;
  const commentCount = trade._count?.comments ?? 0;

  // Subdeck wins as the headline when cap math produced one. computeSubdeck
  // reads cap-tier crossings; when it returns null (rare — trades that
  // don't shift any team's apron position), fall back to the user-typed
  // title to keep the card non-empty.
  const headline = subdeck || trade.title;
  const showUserTitleAsKicker = !!subdeck && trade.title !== subdeck;

  return (
    // Card is now a visual shell only. The Link inside owns navigation +
    // keyboard activation (Enter, Space). The vote rail lives outside the
    // Link as a sibling so its semantics aren't trapped inside an
    // interactive parent, fixing the composite-button a11y smell. Hover
    // styles ride on the Card so the whole thing lifts when the mouse is
    // anywhere on it; only the Link area routes.
    <Card className="group overflow-hidden bg-surface-container transition-all duration-200 ease-out hover:bg-surface-high hover:-translate-y-0.5">
      <Link
        href={`/my-trades/${trade.id}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl"
      >
        <div className="pt-5 pb-3 px-5">
          <div className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant flex flex-wrap items-center gap-x-2 gap-y-1 mb-2.5">
            <span>{formatDate(trade.createdAt)}</span>
            <span className="text-on-surface-variant/40" aria-hidden>
              ·
            </span>
            {trade.salaryValid ? (
              <span
                className="flex items-center gap-1 text-primary"
                title="Salary-matching rules are satisfied"
              >
                <CheckCircleIcon className="h-3 w-3" />
                CAP VALID
              </span>
            ) : (
              <span
                className="flex items-center gap-1 text-warning"
                title="Salary-matching rules aren't satisfied"
              >
                <XCircleIcon className="h-3 w-3" />
                CAP ISSUE
              </span>
            )}
            {showOwnership && isOwnTrade && (
              <>
                <span className="text-on-surface-variant/40" aria-hidden>
                  ·
                </span>
                <span className="text-primary">YOUR TRADE</span>
              </>
            )}
          </div>

          <h3 className="text-lg font-semibold tracking-tight leading-snug line-clamp-2">
            {headline}
          </h3>

          {showUserTitleAsKicker && (
            <p className="text-sm text-on-surface-variant mt-1.5 line-clamp-1">
              {trade.title}
            </p>
          )}
        </div>

        <div className="px-5 pb-3 space-y-1.5">
          {teamsInfo.map((info) => (
            <TeamRow key={info.tradeTeam.id} info={info} />
          ))}
        </div>
      </Link>

      <VoteRail
        tradeId={trade.id}
        score={score}
        userVote={userVote}
        commentCount={commentCount}
        onVote={onVote}
      />
    </Card>
  );
}

/**
 * Vote/comment toolbar pinned to the bottom of the card, outside the
 * navigation Link so its buttons aren't composite children of an
 * interactive parent. Up/score/down anchor left; comment count rides as
 * a muted glyph anchored right, giving the rail a right-hand counterpart
 * so it no longer reads as orphan UI.
 */
function VoteRail({
  tradeId,
  score,
  userVote,
  commentCount,
  onVote,
}: {
  tradeId: number;
  score: number;
  userVote: number;
  commentCount: number;
  onVote: (tradeId: number, value: 1 | -1, e: React.MouseEvent) => void;
}) {
  return (
    <div className="px-5 pb-4 pt-1 flex items-center justify-between gap-2 text-on-surface-variant">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 rounded-md transition-colors",
            userVote === 1
              ? "text-primary bg-primary/10 hover:bg-primary/20"
              : "hover:text-primary hover:bg-primary/10"
          )}
          onClick={(e) => onVote(tradeId, 1, e)}
          aria-label="Upvote trade"
        >
          <ArrowBigUp
            className={cn("h-4 w-4", userVote === 1 && "fill-current")}
          />
        </Button>
        <span
          className={cn(
            "text-sm font-semibold tabular-nums min-w-[1.25rem] text-center",
            score > 0 && "text-primary",
            score <= 0 && "text-on-surface-variant"
          )}
          aria-live="polite"
        >
          {score}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 rounded-md transition-colors",
            userVote === -1
              ? "bg-surface-high hover:bg-surface-highest"
              : "hover:bg-surface-high"
          )}
          onClick={(e) => onVote(tradeId, -1, e)}
          aria-label="Downvote trade"
        >
          <ArrowBigDown
            className={cn("h-4 w-4", userVote === -1 && "fill-current")}
          />
        </Button>
      </div>

      <div
        className="flex items-center gap-1.5 text-sm text-on-surface-variant/70 tabular-nums"
        aria-label={`${commentCount} ${commentCount === 1 ? "comment" : "comments"}`}
      >
        <MessageCircleIcon className="h-4 w-4" aria-hidden />
        <span>{commentCount}</span>
      </div>
    </div>
  );
}

/**
 * Single per-team strip. Identity + Out/In/Delta cap stats pack onto one
 * editorial line that flex-wraps left-anchored. Asset summary lines sit
 * underneath. The previous `flex justify-between` pinned identity left
 * and cap stats right with a ~700px void between them at desktop widths
 * — the new layout packs everything left and lets the eye scan a single
 * sentence-shaped row instead of crossing dead space. Sits on
 * `bg-surface-high` inside a `bg-surface-container` card — depth-up.
 */
function TeamRow({ info }: { info: TeamTradeInfo }) {
  const logoHref = (info.tradeTeam.teamLogo as { href?: string } | null)?.href;
  const receivesLine = summarizeAssetLine(
    info.playersReceived,
    info.picksReceived
  );
  const sendsLine = summarizeAssetLine(info.playersSent, info.picksSent);
  const delta = info.capDifference;
  const deltaSign = delta > 0 ? "+" : delta < 0 ? "−" : "";

  return (
    <div className="rounded-lg bg-surface-high group-hover:bg-surface-highest transition-colors duration-200 ease-out px-3.5 py-2.5">
      {/* Identity + cap stats on one line. flex-wrap lets the cap stats
          drop to a second line at narrow widths instead of overflowing. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {logoHref && (
            <Image
              src={logoHref}
              alt={info.tradeTeam.teamDisplayName}
              width={26}
              height={26}
              className="object-contain flex-shrink-0"
            />
          )}
          <span className="text-sm font-medium tracking-tight truncate">
            {info.tradeTeam.teamAbbreviation}
          </span>
        </div>
        <span className="text-on-surface-variant/40" aria-hidden>·</span>
        <CapStat label="Out" value={formatMillions(info.outgoingSalary)} />
        <span className="text-on-surface-variant/40" aria-hidden>·</span>
        <CapStat label="In" value={formatMillions(info.incomingSalary)} />
        <span className="text-on-surface-variant/40" aria-hidden>·</span>
        <CapStat
          label="Delta"
          value={`${deltaSign}${formatMillions(Math.abs(delta))}`}
          valueClassName={cn(
            delta > 0 && "text-warning",
            delta < 0 && "text-primary"
          )}
        />
      </div>

      {/* Asset summary lines. Tabular-nums on the line that carries the
          pick years so years align column-style across stacked teams. */}
      <div className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-0.5 text-[13px] leading-snug">
        <span className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant pt-0.5">
          IN
        </span>
        <span className="text-foreground tabular-nums truncate">
          {receivesLine}
        </span>
        <span className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant pt-0.5">
          OUT
        </span>
        <span className="text-on-surface-variant tabular-nums truncate">
          {sendsLine}
        </span>
      </div>
    </div>
  );
}

function CapStat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-supermolot text-[9px] tracking-[0.22em] text-on-surface-variant">
        {label}
      </span>
      <span
        className={cn(
          "text-xs font-medium tabular-nums",
          valueClassName ?? "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
}
