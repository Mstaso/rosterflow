import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Navbar } from "~/components/layout/navbar";
import {
  getPaginatedTrades,
  getPaginatedUserTrades,
  getPaginatedUpvotedTrades,
} from "~/actions/trades";
import { SavedTradesClient } from "~/components/my-trades/saved-trades-client";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Trades - Saved NBA Trade Ideas",
  description:
    "View and manage your saved NBA trade ideas. Browse community trades, upvote your favorites, and edit your trade scenarios.",
  robots: {
    index: false, // User-specific page, don't index
    follow: false,
  },
};

export default async function MyTradesPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  const [initialAllTrades, initialUserTrades, initialUpvotedTrades] =
    await Promise.all([
      getPaginatedTrades(1),
      getPaginatedUserTrades(1),
      getPaginatedUpvotedTrades(1),
    ]);

  return (
    <main className="bg-background text-foreground">
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <SavedTradesClient
          initialAllTrades={initialAllTrades}
          initialUserTrades={initialUserTrades}
          initialUpvotedTrades={initialUpvotedTrades}
          currentUserId={userId}
        />
      </div>
    </main>
  );
}
