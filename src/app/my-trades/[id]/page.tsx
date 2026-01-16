import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { Navbar } from "~/components/layout/navbar";
import { getTradeById } from "~/actions/trades";
import { SavedTradeDetail } from "~/components/my-trades/saved-trade-detail";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trade Details",
  description: "View detailed NBA trade analysis and breakdown.",
  robots: {
    index: true,
    follow: true,
  },
};

export default async function TradeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();

  const { id } = await params;
  const tradeId = parseInt(id, 10);

  if (isNaN(tradeId)) {
    notFound();
  }

  const trade = await getTradeById(tradeId);

  if (!trade) {
    notFound();
  }

  return (
    <main className="bg-background text-foreground">
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <SavedTradeDetail trade={trade} currentUserId={userId} />
      </div>
    </main>
  );
}

