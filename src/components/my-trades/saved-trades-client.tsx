"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle } from "~/components/ui/card";
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
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  ClockIcon,
  FlameIcon,
} from "lucide-react";
import {
  deleteTrade,
  voteOnTrade,
  getPaginatedTrades,
  getPaginatedUserTrades,
  getPaginatedUpvotedTrades,
  type TradeWithAssets,
  type PaginatedTradesResult,
  type SortOption,
} from "~/actions/trades";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { cn } from "~/lib/utils";

interface SavedTradesClientProps {
  initialAllTrades: PaginatedTradesResult;
  initialUserTrades: PaginatedTradesResult;
  initialUpvotedTrades: PaginatedTradesResult;
  currentUserId: string;
}

export function SavedTradesClient({
  initialAllTrades,
  initialUserTrades,
  initialUpvotedTrades,
  currentUserId,
}: SavedTradesClientProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all-trades");
  const [votingId, setVotingId] = useState<number | null>(null);

  // Pagination state for each tab
  const [allTradesPagination, setAllTradesPagination] =
    useState<PaginatedTradesResult>(initialAllTrades);
  const [userTradesPagination, setUserTradesPagination] =
    useState<PaginatedTradesResult>(initialUserTrades);
  const [upvotedTradesPagination, setUpvotedTradesPagination] =
    useState<PaginatedTradesResult>(initialUpvotedTrades);

  const [isPending, startTransition] = useTransition();
  const [sortBy, setSortBy] = useState<"recent" | "popular">("recent");

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
      // Refresh the current page based on active tab
      if (activeTab === "all-trades") {
        const refreshed = await getPaginatedTrades(
          allTradesPagination.currentPage,
          sortBy
        );
        setAllTradesPagination(refreshed);
      } else if (activeTab === "my-trades") {
        const refreshed = await getPaginatedUserTrades(
          userTradesPagination.currentPage
        );
        setUserTradesPagination(refreshed);
      } else if (activeTab === "upvoted") {
        const refreshed = await getPaginatedUpvotedTrades(
          upvotedTradesPagination.currentPage
        );
        setUpvotedTradesPagination(refreshed);
      }
    } catch (error) {
      console.error("Error voting:", error);
    } finally {
      setVotingId(null);
    }
  };

  const handleAllTradesPageChange = (newPage: number) => {
    startTransition(async () => {
      const result = await getPaginatedTrades(newPage, sortBy);
      setAllTradesPagination(result);
    });
  };

  const handleUserTradesPageChange = (newPage: number) => {
    startTransition(async () => {
      const result = await getPaginatedUserTrades(newPage);
      setUserTradesPagination(result);
    });
  };

  const handleUpvotedTradesPageChange = (newPage: number) => {
    startTransition(async () => {
      const result = await getPaginatedUpvotedTrades(newPage);
      setUpvotedTradesPagination(result);
    });
  };

  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
    startTransition(async () => {
      const result = await getPaginatedTrades(1, newSort);
      setAllTradesPagination(result);
    });
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
                {userTradesPagination.totalCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="upvoted"
              className="flex items-center gap-1 sm:gap-2"
            >
              <HeartIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Upvoted</span>
              <Badge variant="secondary" className="ml-0 sm:ml-1">
                {upvotedTradesPagination.totalCount}
              </Badge>
            </TabsTrigger>
            <TabsTrigger
              value="all-trades"
              className="flex items-center gap-1 sm:gap-2"
            >
              <GlobeIcon className="h-4 w-4" />
              <span className="hidden sm:inline">All Trades</span>
              <Badge variant="secondary" className="ml-0 sm:ml-1">
                {allTradesPagination.totalCount}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-trades">
            {renderTradesList(
              userTradesPagination.trades,
              "No Saved Trades Yet",
              "Generate and save trades to see them here"
            )}

            {/* Pagination controls */}
            {userTradesPagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleUserTradesPageChange(
                      userTradesPagination.currentPage - 1
                    )
                  }
                  disabled={userTradesPagination.currentPage === 1 || isPending}
                >
                  <ChevronLeftIcon className="h-4 w-4 mr-1" />
                  Previous
                </Button>

                <div className="flex items-center gap-2">
                  {isPending ? (
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Page {userTradesPagination.currentPage} of{" "}
                      {userTradesPagination.totalPages}
                    </span>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleUserTradesPageChange(
                      userTradesPagination.currentPage + 1
                    )
                  }
                  disabled={!userTradesPagination.hasMore || isPending}
                >
                  Next
                  <ChevronRightIcon className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="upvoted">
            {renderTradesList(
              upvotedTradesPagination.trades,
              "No Upvoted Trades",
              "Upvote trades you like to save them here",
              true
            )}

            {/* Pagination controls */}
            {upvotedTradesPagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleUpvotedTradesPageChange(
                      upvotedTradesPagination.currentPage - 1
                    )
                  }
                  disabled={
                    upvotedTradesPagination.currentPage === 1 || isPending
                  }
                >
                  <ChevronLeftIcon className="h-4 w-4 mr-1" />
                  Previous
                </Button>

                <div className="flex items-center gap-2">
                  {isPending ? (
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Page {upvotedTradesPagination.currentPage} of{" "}
                      {upvotedTradesPagination.totalPages}
                    </span>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleUpvotedTradesPageChange(
                      upvotedTradesPagination.currentPage + 1
                    )
                  }
                  disabled={!upvotedTradesPagination.hasMore || isPending}
                >
                  Next
                  <ChevronRightIcon className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="all-trades">
            {/* Sort controls */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-muted-foreground">Sort by:</span>
              <div className="flex gap-1">
                <Button
                  variant={sortBy === "recent" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => handleSortChange("recent")}
                  disabled={isPending}
                  className="h-8"
                >
                  <ClockIcon className="h-4 w-4 mr-1" />
                  Recent
                </Button>
                <Button
                  variant={sortBy === "popular" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => handleSortChange("popular")}
                  disabled={isPending}
                  className="h-8"
                >
                  <FlameIcon className="h-4 w-4 mr-1" />
                  Popular
                </Button>
              </div>
            </div>

            {renderTradesList(
              allTradesPagination.trades,
              "No Trades Available",
              "Be the first to create a trade!",
              true
            )}

            {/* Pagination controls */}
            {allTradesPagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleAllTradesPageChange(
                      allTradesPagination.currentPage - 1
                    )
                  }
                  disabled={allTradesPagination.currentPage === 1 || isPending}
                >
                  <ChevronLeftIcon className="h-4 w-4 mr-1" />
                  Previous
                </Button>

                <div className="flex items-center gap-2">
                  {isPending ? (
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Page {allTradesPagination.currentPage} of{" "}
                      {allTradesPagination.totalPages}
                    </span>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleAllTradesPageChange(
                      allTradesPagination.currentPage + 1
                    )
                  }
                  disabled={!allTradesPagination.hasMore || isPending}
                >
                  Next
                  <ChevronRightIcon className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
