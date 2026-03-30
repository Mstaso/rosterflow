import { auth } from "@clerk/nextjs/server";
import { Navbar } from "~/components/layout/navbar";
import { Footer } from "~/components/layout/footer";
import {
  getPaginatedTrades,
  getPaginatedUserTrades,
  getPaginatedUpvotedTrades,
} from "~/actions/trades";
import { SavedTradesClient } from "~/components/my-trades/saved-trades-client";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Community Trades - NBA Trade Ideas",
  description:
    "Browse community NBA trade ideas. View trade scenarios, upvote your favorites, and share your thoughts.",
  robots: {
    index: true,
    follow: true,
  },
};

export default async function MyTradesPage() {
  const { userId } = await auth();

  // Fetch trades - user-specific data only if logged in
  const [initialAllTrades, initialUserTrades, initialUpvotedTrades] =
    await Promise.all([
      getPaginatedTrades(1),
      userId
        ? getPaginatedUserTrades(1)
        : Promise.resolve({
            trades: [],
            totalCount: 0,
            totalPages: 0,
            currentPage: 1,
            hasMore: false,
          }),
      userId
        ? getPaginatedUpvotedTrades(1)
        : Promise.resolve({
            trades: [],
            totalCount: 0,
            totalPages: 0,
            currentPage: 1,
            hasMore: false,
          }),
    ]);

  return (
    <main className="bg-background text-foreground">
      <div className="flex flex-col">
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <div className="w-full border-b border-border bg-muted/40">
            <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-2.5">
              <h1 className="text-sm font-medium tracking-wide text-muted-foreground/80 uppercase">
                Community Trades
              </h1>
            </div>
          </div>
          <SavedTradesClient
            initialAllTrades={initialAllTrades}
            initialUserTrades={initialUserTrades}
            initialUpvotedTrades={initialUpvotedTrades}
            currentUserId={userId}
          />
        </div>
        <Footer />
      </div>
    </main>
  );
}
