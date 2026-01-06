import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { Navbar } from "~/components/layout/navbar";
import { getTradeById } from "~/actions/trades";
import { SavedTradeDetail } from "~/components/my-trades/saved-trade-detail";

export const dynamic = "force-dynamic";

export default async function TradeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

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
        <SavedTradeDetail trade={trade} />
      </div>
    </main>
  );
}

