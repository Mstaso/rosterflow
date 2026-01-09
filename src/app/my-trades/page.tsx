import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Navbar } from "~/components/layout/navbar";
import {
  getAllTrades,
  getUserTrades,
  getUserUpvotedTrades,
} from "~/actions/trades";
import { SavedTradesClient } from "~/components/my-trades/saved-trades-client";

export const dynamic = "force-dynamic";

export default async function MyTradesPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  const [allTrades, userTrades, upvotedTrades] = await Promise.all([
    getAllTrades(),
    getUserTrades(),
    getUserUpvotedTrades(),
  ]);

  return (
    <main className="bg-background text-foreground">
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <SavedTradesClient
          allTrades={allTrades}
          userTrades={userTrades}
          upvotedTrades={upvotedTrades}
          currentUserId={userId}
        />
      </div>
    </main>
  );
}
