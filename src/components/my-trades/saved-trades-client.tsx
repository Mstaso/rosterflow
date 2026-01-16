"use client";

import { useState, useTransition } from "react";
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
} from "~/components/ui/alert-dialog";
import {
  BookmarkIcon,
  GlobeIcon,
  UserIcon,
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
import { cn } from "~/lib/utils";
import { SignInButton } from "@clerk/nextjs";
import { TradeCard } from "./trade-card";

interface SavedTradesClientProps {
  initialAllTrades: PaginatedTradesResult;
  initialUserTrades: PaginatedTradesResult;
  initialUpvotedTrades: PaginatedTradesResult;
  currentUserId: string | null;
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
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const isLoggedIn = !!currentUserId;

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

    if (!isLoggedIn) {
      setShowSignInPrompt(true);
      return;
    }

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
        {trades.map((trade) => (
          <TradeCard
            key={trade.id}
            trade={trade}
            currentUserId={currentUserId}
            showOwnership={showOwnership}
            isVoting={votingId === trade.id}
            isDeleting={deletingId === trade.id}
            onVote={handleVote}
            onDelete={handleDelete}
            onClick={() => router.push(`/my-trades/${trade.id}`)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex-grow">
      {/* Sign In Prompt Dialog */}
      <AlertDialog open={showSignInPrompt} onOpenChange={setShowSignInPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign in to vote</AlertDialogTitle>
            <AlertDialogDescription>
              You need to be signed in to vote on trades. Create an account or
              sign in to participate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <SignInButton mode="modal">
              <Button
                className="bg-indigoMain hover:bg-indigoMain/90"
                onClick={() => setShowSignInPrompt(false)}
              >
                Sign In
              </Button>
            </SignInButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">
            {isLoggedIn ? "Saved Trades" : "Community Trades"}
          </h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList
            className={cn(
              "grid w-full mb-6",
              isLoggedIn ? "grid-cols-3" : "grid-cols-1"
            )}
          >
            {isLoggedIn && (
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
            )}
            {isLoggedIn && (
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
            )}
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
