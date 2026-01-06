"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import {
  TrashIcon,
  CalendarIcon,
  StarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowRightIcon,
  BookmarkIcon,
} from "lucide-react";
import { deleteTrade } from "~/actions/trades";
import { useRouter } from "next/navigation";
import Image from "next/image";

type TradeWithAssets = {
  id: number;
  title: string;
  description: string;
  rating: number;
  salaryValid: boolean;
  createdAt: Date;
  updatedAt: Date;
  assets: {
    id: number;
    type: string;
    teamId: number;
    targetTeamId: number;
    playerId: number | null;
    draftPickId: number | null;
    player: {
      id: number;
      displayName: string;
      headshot: any;
      position: any;
      contract: any;
    } | null;
    draftPick: {
      id: number;
      year: number;
      round: number;
      description: string | null;
    } | null;
    team: {
      id: number;
      displayName: string;
      abbreviation: string;
      logos: any;
    };
    targetTeam: {
      id: number;
      displayName: string;
      abbreviation: string;
      logos: any;
    };
  }[];
};

export function SavedTradesClient({ trades }: { trades: TradeWithAssets[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleDelete = async (tradeId: number) => {
    setDeletingId(tradeId);
    try {
      await deleteTrade(tradeId);
      router.refresh();
    } catch (error) {
      console.error("Error deleting trade:", error);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Group assets by team movement (from -> to)
  const groupAssetsByMovement = (assets: TradeWithAssets["assets"]) => {
    const movements: Record<
      string,
      {
        from: TradeWithAssets["assets"][0]["team"];
        to: TradeWithAssets["assets"][0]["targetTeam"];
        assets: TradeWithAssets["assets"];
      }
    > = {};

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
  };

  if (trades.length === 0) {
    return (
      <div className="flex-grow p-4 md:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">My Saved Trades</h1>
          <div className="text-center py-16 border rounded-lg bg-muted/20">
            <BookmarkIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Saved Trades Yet</h3>
            <p className="text-muted-foreground mb-4">
              Generate and save trades to see them here
            </p>
            <Button onClick={() => router.push("/")}>
              Go to Trade Machine
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow p-4 md:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">My Saved Trades</h1>
          <Badge variant="secondary">
            {trades.length} trade{trades.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        <div className="space-y-4">
          {trades.map((trade) => {
            const movements = groupAssetsByMovement(trade.assets);
            return (
              <Card key={trade.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">
                        {trade.title}
                      </CardTitle>
                      <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="h-3.5 w-3.5" />
                          {formatDate(trade.createdAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <StarIcon className="h-3.5 w-3.5 text-yellow-500" />
                          {trade.rating}/10
                        </span>
                        {trade.salaryValid ? (
                          <span className="flex items-center gap-1 text-green-500">
                            <CheckCircleIcon className="h-3.5 w-3.5" />
                            Valid
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-500">
                            <XCircleIcon className="h-3.5 w-3.5" />
                            Invalid
                          </span>
                        )}
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          disabled={deletingId === trade.id}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Trade</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{trade.title}"?
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(trade.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {trade.description}
                  </p>

                  {/* Trade movements */}
                  <div className="space-y-3">
                    {movements.map((movement, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
                      >
                        {/* From team */}
                        <div className="flex items-center gap-2 min-w-0">
                          {movement.from.logos?.[0]?.href && (
                            <Image
                              src={movement.from.logos[0].href}
                              alt={movement.from.displayName}
                              width={24}
                              height={24}
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
                          {movement.to.logos?.[0]?.href && (
                            <Image
                              src={movement.to.logos[0].href}
                              alt={movement.to.displayName}
                              width={24}
                              height={24}
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
                            <Badge
                              key={asset.id}
                              variant="outline"
                              className="text-xs"
                            >
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
