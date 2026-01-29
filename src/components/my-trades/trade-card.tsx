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
  from: TradeWithAssets["assets"][0]["team"];
  to: TradeWithAssets["assets"][0]["targetTeam"];
  assets: TradeWithAssets["assets"];
};

function groupAssetsByMovement(
  assets: TradeWithAssets["assets"]
): TradeMovement[] {
  const movements: Record<string, TradeMovement> = {};

  assets.forEach((asset) => {
    const key = `${asset.teamId}-${asset.targetTeamId}`;
    if (!movements[key]) {
      movements[key] = {
        from: asset.team,
        to: asset.targetTeam,
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
      className="overflow-hidden cursor-pointer transition-colors hover:border-indigoMain/50 "
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
                  ? "text-orange-500 bg-orange-500/10 hover:bg-orange-500/20 scale-110"
                  : "text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10 hover:scale-110"
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
                score > 0 && "text-orange-500",
                score < 0 && "text-blue-500",
                score === 0 && "text-muted-foreground"
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
                  ? "text-blue-500 bg-blue-500/10 hover:bg-blue-500/20 scale-110"
                  : "text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 hover:scale-110"
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
                <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                  <span>{formatDate(trade.createdAt)}</span>
                  <span className="text-muted-foreground/50">·</span>
                  {trade.salaryValid ? (
                    <span className="flex items-center gap-1 text-green-500">
                      <CheckCircleIcon className="h-3 w-3" />
                      Valid
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-500">
                      <XCircleIcon className="h-3 w-3" />
                      Invalid
                    </span>
                  )}
                </div>
              </div>
            </div>

            <p className="hidden sm:block text-sm text-muted-foreground mt-3 mb-4 line-clamp-2">
              {trade.description}
            </p>
          </div>
        </div>
        {/* Trade movements */}
        <div className="space-y-2 mt-3 sm:mt-0">
          {movements.map((movement, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-muted/30"
            >
              {/* From team */}
              <div className="flex items-center gap-2 min-w-0">
                {(movement.from.logos as { href: string }[] | null)?.[0]
                  ?.href && (
                  <Image
                    src={(movement.from.logos as { href: string }[])[0]!.href}
                    alt={movement.from.displayName}
                    width={28}
                    height={28}
                    className="object-contain flex-shrink-0"
                  />
                )}
                <span className="text-sm font-medium truncate">
                  {movement.from.abbreviation}
                </span>
              </div>

              <ArrowRightIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />

              {/* To team */}
              <div className="flex items-center gap-2 min-w-0">
                {(movement.to.logos as { href: string }[] | null)?.[0]
                  ?.href && (
                  <Image
                    src={(movement.to.logos as { href: string }[])[0]!.href}
                    alt={movement.to.displayName}
                    width={28}
                    height={28}
                    className="object-contain flex-shrink-0"
                  />
                )}
                <span className="text-sm font-medium truncate">
                  {movement.to.abbreviation}
                </span>
              </div>

              {/* Assets */}
              <div className="flex-1 flex flex-wrap gap-1.5 justify-end">
                {movement.assets.map((asset) => (
                  <Badge key={asset.id} variant="outline" className="text-xs">
                    {asset.type === "player" && asset.player
                      ? asset.player.displayName
                      : asset.type === "pick" && asset.draftPick
                      ? `${asset.draftPick.year} R${asset.draftPick.round}`
                      : "Unknown"}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardHeader>
    </Card>
  );
}
