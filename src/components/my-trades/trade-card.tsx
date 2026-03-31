"use client";

import { Card, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightIcon,
  UserIcon,
  ArrowBigUp,
  ArrowBigDown,
} from "lucide-react";
import { type TradeWithAssets } from "~/actions/trades";
import Image from "next/image";
import { cn } from "~/lib/utils";

type TradeMovement = {
  from: TradeWithAssets["assets"][0]["tradeTeam"];
  to: TradeWithAssets["assets"][0]["targetTradeTeam"];
  assets: TradeWithAssets["assets"];
};

function groupAssetsByMovement(
  assets: TradeWithAssets["assets"]
): TradeMovement[] {
  const movements: Record<string, TradeMovement> = {};

  assets.forEach((asset) => {
    const key = `${asset.tradeTeamId}-${asset.targetTradeTeamId}`;
    if (!movements[key]) {
      movements[key] = {
        from: asset.tradeTeam,
        to: asset.targetTradeTeam,
        assets: [],
      };
    }
    movements[key].assets.push(asset);
  });

  return Object.values(movements);
}

function formatDate(date: Date) {
  const d = new Date(date);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(
    -2
  )}`;
}


interface TradeCardProps {
  trade: TradeWithAssets;
  currentUserId: string | null;
  showOwnership?: boolean;
  isVoting: boolean;
  onVote: (tradeId: number, value: 1 | -1, e: React.MouseEvent) => void;
  onClick: () => void;
}

export function TradeCard({
  trade,
  currentUserId,
  showOwnership = false,
  isVoting,
  onVote,
  onClick,
}: TradeCardProps) {
  const movements = groupAssetsByMovement(trade.assets);
  const isOwnTrade = trade.userId === currentUserId;

  const votes = trade.votes || [];
  const upvotes = votes.filter((v) => v.value === 1).length;
  const downvotes = votes.filter((v) => v.value === -1).length;
  const score = upvotes - downvotes;
  const userVote = votes.find((v) => v.userId === currentUserId)?.value ?? 0;

  return (
    <Card
      className="overflow-hidden cursor-pointer transition-all duration-200 hover:bg-surface-high"
      onClick={onClick}
    >
      <CardHeader className="pb-3 w-full">
        <div className="flex items-start gap-3">
          {/* Vote buttons */}
          <div className="flex flex-col items-center gap-0.5 pt-1 flex-shrink-0 w-8">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-md transition-all duration-200",
                userVote === 1
                  ? "text-primary bg-primary/10 hover:bg-primary/20 scale-110"
                  : "text-on-surface-variant hover:text-primary hover:bg-primary/10 hover:scale-110"
              )}
              disabled={isVoting}
              onClick={(e) => onVote(trade.id, 1, e)}
            >
              <ArrowBigUp
                className={cn(
                  "h-5 w-5 transition-all duration-200",
                  userVote === 1 && "fill-current"
                )}
              />
            </Button>
            <span
              className={cn(
                "text-sm font-semibold tabular-nums transition-colors duration-200",
                score > 0 && "text-primary",
                score <= 0 && "text-on-surface-variant"
              )}
            >
              {score}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-7 w-7 rounded-md transition-all duration-200",
                userVote === -1
                  ? "text-on-surface-variant bg-surface-high hover:bg-surface-highest scale-110"
                  : "text-on-surface-variant hover:text-on-surface-variant hover:bg-surface-high hover:scale-110"
              )}
              disabled={isVoting}
              onClick={(e) => onVote(trade.id, -1, e)}
            >
              <ArrowBigDown
                className={cn(
                  "h-5 w-5 transition-all duration-200",
                  userVote === -1 && "fill-current"
                )}
              />
            </Button>
          </div>

          {/* Trade content */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg truncate">
                    {trade.title}
                  </CardTitle>
                  {showOwnership && isOwnTrade && (
                    <Badge
                      variant="secondary"
                      className="text-xs flex-shrink-0"
                    >
                      <UserIcon className="h-3 w-3 mr-1" />
                      Yours
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-on-surface-variant">
                  <span>{formatDate(trade.createdAt)}</span>
                  <span className="text-on-surface-variant/40">·</span>
                  {trade.salaryValid ? (
                    <span className="flex items-center gap-1 text-primary">
                      <CheckCircleIcon className="h-3 w-3" />
                      Valid
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-orange-500">
                      <XCircleIcon className="h-3 w-3" />
                      Invalid
                    </span>
                  )}
                </div>
              </div>
            </div>

            <p className="hidden sm:block text-sm text-on-surface-variant mt-3 mb-4 line-clamp-2">
              {trade.description}
            </p>
          </div>
        </div>
        {/* Trade movements */}
        <div className="space-y-2 mt-3 sm:mt-0">
          {movements.map((movement, i) => (
            <div
              key={i}
              className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-surface-low"
            >
              {/* From team */}
              <div className="flex items-center gap-2 min-w-0">
                {(movement.from.teamLogo as { href?: string } | null)
                  ?.href && (
                  <Image
                    src={
                      (movement.from.teamLogo as { href: string }).href
                    }
                    alt={movement.from.teamDisplayName}
                    width={24}
                    height={24}
                    className="object-contain flex-shrink-0"
                  />
                )}
                <span className="text-sm font-medium truncate">
                  {movement.from.teamAbbreviation}
                </span>
              </div>

              <ArrowRightIcon className="h-3.5 w-3.5 text-on-surface-variant/50 flex-shrink-0" />

              {/* To team */}
              <div className="flex items-center gap-2 min-w-0">
                {(movement.to.teamLogo as { href?: string } | null)
                  ?.href && (
                  <Image
                    src={
                      (movement.to.teamLogo as { href: string }).href
                    }
                    alt={movement.to.teamDisplayName}
                    width={24}
                    height={24}
                    className="object-contain flex-shrink-0"
                  />
                )}
                <span className="text-sm font-medium truncate">
                  {movement.to.teamAbbreviation}
                </span>
              </div>

              {/* Assets */}
              <div className="flex-1 flex flex-wrap gap-1.5 justify-end">
                {movement.assets.map((asset) => (
                  <span key={asset.id} className="text-xs text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-md">
                    {asset.type === "player" && asset.playerName
                      ? asset.playerName
                      : asset.type === "pick" && asset.pickYear
                      ? `${asset.pickYear} R${asset.pickRound}`
                      : "Unknown"}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardHeader>
    </Card>
  );
}
