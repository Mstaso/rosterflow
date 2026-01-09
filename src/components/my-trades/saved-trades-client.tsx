"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
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
  GlobeIcon,
  UserIcon,
  ArrowBigUp,
  ArrowBigDown,
  HeartIcon,
} from "lucide-react";
import {
  deleteTrade,
  voteOnTrade,
  type TradeWithAssets,
} from "~/actions/trades";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { cn } from "~/lib/utils";

interface SavedTradesClientProps {
  allTrades: TradeWithAssets[];
  userTrades: TradeWithAssets[];
  upvotedTrades: TradeWithAssets[];
  currentUserId: string;
}

export function SavedTradesClient({
  allTrades,
  userTrades,
  upvotedTrades,
  currentUserId,
}: SavedTradesClientProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>("my-trades");
  const [votingId, setVotingId] = useState<number | null>(null);

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

  const handleVote = async (
    tradeId: number,
    value: 1 | -1,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setVotingId(tradeId);
    try {
      await voteOnTrade(tradeId, value);
      router.refresh();
    } catch (error) {
      console.error("Error voting:", error);
    } finally {
      setVotingId(null);
    }
  };

  const getVoteInfo = (trade: TradeWithAssets) => {
    const votes = trade.votes || [];
    const upvotes = votes.filter((v) => v.value === 1).length;
    const downvotes = votes.filter((v) => v.value === -1).length;
    const score = upvotes - downvotes;
    const userVote = votes.find((v) => v.userId === currentUserId)?.value ?? 0;
    return { score, userVote };
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

  const renderTradesList = (
    trades: TradeWithAssets[],
    emptyMessage: string,
    emptySubtext: string = "Generate and save trades to see them here",
    showOwnership: boolean = false
  ) => {
    if (trades.length === 0) {
      return (
        <div className="text-center py-16 border rounded-lg bg-muted/20">
          <BookmarkIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">{emptyMessage}</h3>
          <p className="text-muted-foreground mb-4">{emptySubtext}</p>
          <Button onClick={() => router.push("/")}>Go to Trade Machine</Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {trades.map((trade) => {
          const movements = groupAssetsByMovement(trade.assets);
          const isOwnTrade = trade.userId === currentUserId;
          const { score, userVote } = getVoteInfo(trade);

          return (
            <Card
              key={trade.id}
              className="overflow-hidden cursor-pointer transition-colors hover:border-indigoMain/50"
              onClick={() => router.push(`/my-trades/${trade.id}`)}
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
                      disabled={votingId === trade.id}
                      onClick={(e) => handleVote(trade.id, 1, e)}
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
                      disabled={votingId === trade.id}
                      onClick={(e) => handleVote(trade.id, -1, e)}
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
                      {isOwnTrade && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              disabled={deletingId === trade.id}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent
                            onClick={(e) => e.stopPropagation()}
                          >
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
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground mt-3 mb-4 line-clamp-2">
                      {trade.description}
                    </p>
                  </div>
                </div>
                {/* Trade movements */}
                <div className="space-y-3">
                  {movements.map((movement, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
                    >
                      {/* From team */}
                      <div className="flex items-center gap-2 min-w-0">
                        {(movement.from.logos as { href: string }[] | null)?.[0]
                          ?.href && (
                          <Image
                            src={
                              (movement.from.logos as { href: string }[])[0]!
                                .href
                            }
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
                            src={
                              (movement.to.logos as { href: string }[])[0]!.href
                            }
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
              </CardHeader>
            </Card>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex-grow">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">Saved Trades</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger
              value="my-trades"
              className="flex items-center gap-1 sm:gap-2"
            >
              <UserIcon className="h-4 w-4" />
              <span className="hidden sm:inline">My Trades</span>
              <Badge variant="secondary" className="ml-0 sm:ml-1">
                {userTrades.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="upvoted"
              className="flex items-center gap-1 sm:gap-2"
            >
              <HeartIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Upvoted</span>
              <Badge variant="secondary" className="ml-0 sm:ml-1">
                {upvotedTrades.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="all-trades"
              className="flex items-center gap-1 sm:gap-2"
            >
              <GlobeIcon className="h-4 w-4" />
              <span className="hidden sm:inline">All Trades</span>
              <Badge variant="secondary" className="ml-0 sm:ml-1">
                {allTrades.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-trades">
            {renderTradesList(
              userTrades,
              "No Saved Trades Yet",
              "Generate and save trades to see them here"
            )}
          </TabsContent>

          <TabsContent value="upvoted">
            {renderTradesList(
              upvotedTrades,
              "No Upvoted Trades",
              "Upvote trades you like to save them here",
              true
            )}
          </TabsContent>

          <TabsContent value="all-trades">
            {renderTradesList(
              allTrades,
              "No Trades Available",
              "Be the first to create a trade!",
              true
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
