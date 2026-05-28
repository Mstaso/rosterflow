"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Card } from "~/components/ui/card";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2Icon,
  CheckCircleIcon,
  MessageCircleIcon,
} from "lucide-react";
import Image from "next/image";
import {
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
  const [activeTab, setActiveTab] = useState<string>("all-trades");
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
  const [sortBy, setSortBy] = useState<SortOption>("recent");

  const handleVote = async (
    tradeId: number,
    value: 1 | -1,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();

    if (!isLoggedIn || !currentUserId) {
      setShowSignInPrompt(true);
      return;
    }

    // Snapshot rollback state BEFORE we mutate anything optimistically.
    // If the server call fails we re-set all three to the snapshot so the
    // UI matches reality again.
    const snapshot = {
      all: allTradesPagination,
      user: userTradesPagination,
      upvoted: upvotedTradesPagination,
    };

    // Optimistic update. Patch the trade in every pagination that holds
    // it — All, Mine, Upvoted can overlap (Mine on user's own trade,
    // Upvoted on a trade you've already upvoted that you're now toggling).
    // Re-sort isn't applied: a vote shouldn't jump a card off the screen
    // mid-click. Next pagination or tab swap pulls fresh order.
    const patch = (p: PaginatedTradesResult) => ({
      ...p,
      trades: p.trades.map((t) =>
        t.id === tradeId ? applyOptimisticVote(t, currentUserId, value) : t
      ),
    });
    setAllTradesPagination(patch);
    setUserTradesPagination(patch);
    setUpvotedTradesPagination(patch);

    try {
      await voteOnTrade(tradeId, value);
    } catch (error) {
      console.error("Error voting:", error);
      setAllTradesPagination(snapshot.all);
      setUserTradesPagination(snapshot.user);
      setUpvotedTradesPagination(snapshot.upvoted);
      toast.error("Couldn't record your vote.", {
        description: "Try again in a moment.",
      });
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

  // Sort is meaningful only on All Trades today — Mine and Upvoted are
  // chronological collections without a "popular" axis. The toolbar still
  // renders on every tab (avoid layout shift), but disables with a
  // tooltip when sort would be inert. See context.md for the followup if
  // we eventually wire popular/recent through user-scoped queries.
  const sortApplies = !isLoggedIn || activeTab === "all-trades";

  const renderTradesList = (
    trades: TradeWithAssets[],
    emptyState: React.ReactNode,
    showOwnership: boolean = false
  ) => {
    if (trades.length === 0) return <>{emptyState}</>;

    return (
      <div className="space-y-3">
        {trades.map((trade) => (
          <TradeCard
            key={trade.id}
            trade={trade}
            currentUserId={currentUserId}
            showOwnership={showOwnership}
            onVote={handleVote}
          />
        ))}
      </div>
    );
  };

  const goToTradeMachine = () => router.push("/");
  const goToAllTab = () => setActiveTab("all-trades");

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
                variant="primary"
                onClick={() => setShowSignInPrompt(false)}
              >
                Sign In
              </Button>
            </SignInButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-6">
        {isLoggedIn ? (
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            {/* Sort toolbar is hoisted ABOVE the tab strip so it doesn't
                materialize/vanish on tab change (the old layout caused a
                jump). Greyed out when the active tab is a chronological
                collection — see `sortApplies` comment above. */}
            <SortToolbar
              sortBy={sortBy}
              onChange={handleSortChange}
              isPending={isPending}
              applies={sortApplies}
            />

            {/* Tab strip ported to the navbar's editorial underline pattern.
                No pills, no surface-high fill, no bg-primary glow — just a
                baseline rule with a 2px primary underline under the active
                label, matching DESIGN.md Navigation conventions. Counts
                slide in as muted tabular-nums next to each label rather
                than as colored Badge chips. */}
            <TabsList className="flex w-full gap-7 mb-6 relative border-b border-outline-variant/15 h-12 bg-transparent rounded-none p-0 justify-start">
              <EditorialTabsTrigger
                value="my-trades"
                label="Mine"
                count={userTradesPagination.totalCount}
              />
              <EditorialTabsTrigger
                value="upvoted"
                label="Upvoted"
                count={upvotedTradesPagination.totalCount}
              />
              <EditorialTabsTrigger
                value="all-trades"
                label="All"
                count={allTradesPagination.totalCount}
              />
            </TabsList>

            <TabsContent value="my-trades">
              {renderTradesList(
                userTradesPagination.trades,
                <EmptyState
                  eyebrow="MINE"
                  heading="Nothing saved yet."
                  body="Build a trade in the machine and save it. It lands here in the shape below, with your verdict, cap math, and assets ready to share."
                  primaryCta={{ label: "Build a trade", onClick: goToTradeMachine }}
                />
              )}
              <Pagination
                pagination={userTradesPagination}
                onChange={handleUserTradesPageChange}
                isPending={isPending}
              />
            </TabsContent>

            <TabsContent value="upvoted">
              {renderTradesList(
                upvotedTradesPagination.trades,
                <EmptyState
                  eyebrow="UPVOTED"
                  heading="Nothing upvoted yet."
                  body="Hop into the community feed and upvote what looks right. Anything you back lands here for safekeeping, in the shape below."
                  primaryCta={{ label: "Browse community trades", onClick: goToAllTab }}
                />,
                true
              )}
              <Pagination
                pagination={upvotedTradesPagination}
                onChange={handleUpvotedTradesPageChange}
                isPending={isPending}
              />
            </TabsContent>

            <TabsContent value="all-trades">
              {renderTradesList(
                allTradesPagination.trades,
                <EmptyState
                  eyebrow="ALL"
                  heading="No community trades yet."
                  body="Be the first. Build one in the machine, save it, and it'll live here in the shape below for everyone to weigh in on."
                  primaryCta={{ label: "Build the first one", onClick: goToTradeMachine }}
                />,
                true
              )}
              <Pagination
                pagination={allTradesPagination}
                onChange={handleAllTradesPageChange}
                isPending={isPending}
              />
            </TabsContent>
          </Tabs>
        ) : (
          <>
            <SortToolbar
              sortBy={sortBy}
              onChange={handleSortChange}
              isPending={isPending}
              applies
            />
            {renderTradesList(
              allTradesPagination.trades,
              <EmptyState
                eyebrow="COMMUNITY"
                heading="No community trades yet."
                body="Be the first. Build one in the machine and it'll live here in the shape below, ready for the room to weigh in."
                primaryCta={{ label: "Build the first one", onClick: goToTradeMachine }}
              />,
              true
            )}
            <Pagination
              pagination={allTradesPagination}
              onChange={handleAllTradesPageChange}
              isPending={isPending}
            />
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Apply an optimistic vote toggle to a TradeWithAssets snapshot. Returns
 * a new object — never mutates. Three cases:
 *
 *   - No existing vote: prepend a new vote row.
 *   - Existing vote with the same value: remove (toggle off).
 *   - Existing vote with opposite value: switch the value.
 *
 * The temporary `id` for newly-added rows is negative so it can't collide
 * with a real server-issued autoincrement id; on the next route refresh
 * the real id replaces it.
 */
function applyOptimisticVote(
  trade: TradeWithAssets,
  userId: string,
  value: 1 | -1
): TradeWithAssets {
  const votes = trade.votes ?? [];
  const existing = votes.find((v) => v.userId === userId);
  let nextVotes: typeof votes;
  if (!existing) {
    const now = new Date();
    nextVotes = [
      ...votes,
      {
        id: -Date.now(),
        userId,
        tradeId: trade.id,
        value,
        createdAt: now,
        updatedAt: now,
      },
    ];
  } else if (existing.value === value) {
    nextVotes = votes.filter((v) => v.userId !== userId);
  } else {
    nextVotes = votes.map((v) =>
      v.userId === userId ? { ...v, value } : v
    );
  }
  return { ...trade, votes: nextVotes };
}

/**
 * Sort toolbar — editorial eyebrow + two segmented toggle buttons. Greyed
 * with a tooltip when the active tab doesn't have a "popular" axis (Mine,
 * Upvoted) so the user still sees the control exists without it shifting
 * the layout between tabs.
 */
function SortToolbar({
  sortBy,
  onChange,
  isPending,
  applies,
}: {
  sortBy: SortOption;
  onChange: (s: SortOption) => void;
  isPending: boolean;
  applies: boolean;
}) {
  const tooltip = applies
    ? undefined
    : "Sort applies to All. Mine and Upvoted stay chronological.";
  return (
    <div
      className="flex items-center gap-4 mb-5"
      title={tooltip}
      aria-disabled={!applies}
    >
      <span className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant">
        SORT
      </span>
      <div
        className={cn(
          "flex items-center gap-5 font-supermolot text-[11px] tracking-[0.22em]",
          !applies && "opacity-40"
        )}
      >
        <SortLabelButton
          active={sortBy === "recent"}
          disabled={isPending || !applies}
          onClick={() => onChange("recent")}
          label="Recent"
        />
        <SortLabelButton
          active={sortBy === "popular"}
          disabled={isPending || !applies}
          onClick={() => onChange("popular")}
          label="Popular"
        />
      </div>
    </div>
  );
}

function SortLabelButton({
  active,
  disabled,
  onClick,
  label,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative pb-1 transition-colors",
        active ? "text-foreground" : "text-on-surface-variant hover:text-foreground",
        "disabled:hover:text-on-surface-variant disabled:cursor-not-allowed",
        "after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-transparent",
        active && "after:bg-primary"
      )}
    >
      {label}
    </button>
  );
}

/**
 * In-page tab trigger styled like the navbar's editorial nav links.
 * Baseline rule + 2px primary underline on the active label via the
 * after-pseudo (always present, transparent until `data-state=active`
 * — keeps layout stable on hover/focus transitions).
 *
 * No pill background, no shadow glow, no Badge chip. Counts ride as
 * muted tabular-nums to the right of the label.
 */
function EditorialTabsTrigger({
  value,
  label,
  count,
}: {
  value: string;
  label: string;
  count: number;
}) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        "relative inline-flex h-12 items-center gap-2 px-3 rounded-none bg-transparent shadow-none",
        "font-supermolot text-[11px] tracking-[0.22em]",
        "text-on-surface-variant hover:text-foreground",
        "data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none",
        "after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:bg-transparent",
        "data-[state=active]:after:bg-primary",
        "transition-colors"
      )}
    >
      {label}
      <span className="font-sans tabular-nums text-[11px] tracking-normal text-on-surface-variant/60 normal-case">
        {count}
      </span>
    </TabsTrigger>
  );
}

/**
 * Empty state — teach by demonstration. Editorial copy + a static
 * SampleTradeCard rendered at reduced opacity so the user learns the
 * vocabulary (eyebrow, title, subdeck, per-team OUT/IN/Δ strip) before
 * they have any real content. Replaces the SaaS-cliché icon-and-button
 * empty state. Per-tab heading + CTA make the action obvious.
 */
function EmptyState({
  eyebrow,
  heading,
  body,
  primaryCta,
}: {
  eyebrow: string;
  heading: string;
  body: string;
  primaryCta: { label: string; onClick: () => void };
}) {
  return (
    <div className="py-6 sm:py-8">
      <div className="mb-6 max-w-2xl">
        <div className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant mb-3">
          {eyebrow} · EMPTY
        </div>
        <h3 className="text-xl sm:text-2xl font-semibold tracking-tight leading-snug mb-2">
          {heading}
        </h3>
        <p className="text-sm text-on-surface-variant leading-relaxed mb-5">
          {body}
        </p>
        <Button onClick={primaryCta.onClick} variant="primary">
          {primaryCta.label}
        </Button>
      </div>

      {/* Sample card. Eyebrow stays at full editorial weight so the
          "EXAMPLE" label anchors the section; card drops to opacity-55
          so it reads as a clear teaching aid against the live cards
          users will see when they come back with real data. */}
      <div className="relative">
        <div className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant mb-2">
          EXAMPLE. This is what a trade looks like.
        </div>
        <div className="opacity-55 pointer-events-none select-none">
          <SampleTradeCard />
        </div>
      </div>
    </div>
  );
}

/**
 * Static, non-interactive replica of the TradeCard editorial vocabulary,
 * carrying a representative two-team cap-relief example. Hardcoded data
 * keeps the component dependency-free (no mock Prisma shapes); the visual
 * vocabulary mirrors `trade-card.tsx` so the empty state genuinely teaches
 * the shape of real cards.
 *
 * If TradeCard's editorial shape changes, update this to match. Cheaper
 * than wiring a fake TradeWithAssets through the real component.
 */
function SampleTradeCard() {
  return (
    <Card className="overflow-hidden bg-surface-container">
      <div className="pt-5 pb-3 px-5">
        <div className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant flex flex-wrap items-center gap-x-2 gap-y-1 mb-2.5">
          <span>May 14</span>
          <span className="text-on-surface-variant/40" aria-hidden>
            ·
          </span>
          <span className="flex items-center gap-1 text-primary">
            <CheckCircleIcon className="h-3 w-3" />
            CAP VALID
          </span>
        </div>
        <h3 className="text-lg font-semibold tracking-tight leading-snug">
          Suns slide back under the second apron.
        </h3>
        <p className="text-sm text-on-surface-variant mt-1.5">
          Suns dump Beal for cap relief; Pistons land a vet wing rotation.
        </p>
      </div>

      <div className="px-5 pb-3 space-y-1.5">
        <SampleTeamRow
          abbreviation="PHX"
          logoSrc="https://a.espncdn.com/i/teamlogos/nba/500/phx.png"
          out="$50.1M"
          in="$24.0M"
          delta="−$26.1M"
          deltaTone="positive"
          receives="Hardaway · Burks · 2026 R2"
          sends="Beal · Plumlee"
        />
        <SampleTeamRow
          abbreviation="DET"
          logoSrc="https://a.espncdn.com/i/teamlogos/nba/500/det.png"
          out="$24.0M"
          in="$50.1M"
          delta="+$26.1M"
          deltaTone="negative"
          receives="Beal · Plumlee"
          sends="Hardaway · Burks · 2026 R2"
        />
      </div>

      {/* Vote rail matches the live card's bottom bar: up/score/down on
          the left, comment count on the right. Keeps the teaching aid
          honest end-to-end. */}
      <div className="px-5 pb-4 pt-1 flex items-center justify-between gap-2 text-on-surface-variant">
        <div className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-md flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m6 15 6-6 6 6" />
            </svg>
          </span>
          <span className="text-sm font-semibold tabular-nums min-w-[1.25rem] text-center text-primary">
            12
          </span>
          <span className="h-7 w-7 rounded-md flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-on-surface-variant/70 tabular-nums">
          <MessageCircleIcon className="h-4 w-4" aria-hidden />
          <span>3</span>
        </div>
      </div>
    </Card>
  );
}

function SampleTeamRow({
  abbreviation,
  logoSrc,
  out,
  in: incoming,
  delta,
  deltaTone,
  receives,
  sends,
}: {
  abbreviation: string;
  logoSrc: string;
  out: string;
  in: string;
  delta: string;
  /** "positive" = cap relief (text-primary), "negative" = taking on (text-warning). */
  deltaTone: "positive" | "negative" | "neutral";
  receives: string;
  sends: string;
}) {
  const deltaClass =
    deltaTone === "positive"
      ? "text-primary"
      : deltaTone === "negative"
        ? "text-warning"
        : "text-foreground";
  return (
    <div className="rounded-lg bg-surface-high px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-2">
        <div className="flex items-center gap-2">
          <Image
            src={logoSrc}
            alt={`${abbreviation} logo`}
            width={26}
            height={26}
            className="object-contain flex-shrink-0"
          />
          <span className="text-sm font-medium tracking-tight">
            {abbreviation}
          </span>
        </div>
        <span className="text-on-surface-variant/40" aria-hidden>·</span>
        <SampleCapStat label="Out" value={out} />
        <span className="text-on-surface-variant/40" aria-hidden>·</span>
        <SampleCapStat label="In" value={incoming} />
        <span className="text-on-surface-variant/40" aria-hidden>·</span>
        <SampleCapStat label="Delta" value={delta} valueClassName={deltaClass} />
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-0.5 text-[13px] leading-snug">
        <span className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant pt-0.5">
          IN
        </span>
        <span className="text-foreground tabular-nums truncate">
          {receives}
        </span>
        <span className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant pt-0.5">
          OUT
        </span>
        <span className="text-on-surface-variant tabular-nums truncate">
          {sends}
        </span>
      </div>
    </div>
  );
}

function SampleCapStat({
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

/**
 * Pagination — Previous / Page N of M / Next. Three places used to inline
 * a verbatim copy of this block; collapsing into one component eliminates
 * the layout-drift risk if any of them ever drifted apart.
 */
function Pagination({
  pagination,
  onChange,
  isPending,
}: {
  pagination: PaginatedTradesResult;
  onChange: (page: number) => void;
  isPending: boolean;
}) {
  if (pagination.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-4 mt-6">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange(pagination.currentPage - 1)}
        disabled={pagination.currentPage === 1 || isPending}
      >
        <ChevronLeftIcon className="h-4 w-4 mr-1" />
        Previous
      </Button>
      <div className="flex items-center gap-2">
        {isPending ? (
          <Loader2Icon className="h-4 w-4 animate-spin" />
        ) : (
          <span className="text-sm text-on-surface-variant">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange(pagination.currentPage + 1)}
        disabled={!pagination.hasMore || isPending}
      >
        Next
        <ChevronRightIcon className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}
