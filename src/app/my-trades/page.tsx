import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Navbar } from "~/components/layout/navbar";
import { getSavedTrades } from "~/actions/trades";
import { SavedTradesClient } from "~/components/my-trades/saved-trades-client";

export const dynamic = "force-dynamic";

export default async function MyTradesPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  const trades = await getSavedTrades();

  return (
    <main className="bg-background text-foreground">
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <SavedTradesClient trades={trades} />
      </div>
    </main>
  );
}
