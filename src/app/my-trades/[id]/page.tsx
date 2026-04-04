import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { Navbar } from "~/components/layout/navbar";
import { Footer } from "~/components/layout/footer";
import { getTradeById } from "~/actions/trades";
import { SavedTradeDetail } from "~/components/my-trades/saved-trade-detail";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rosterflows.com";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const tradeId = parseInt(id, 10);

  if (isNaN(tradeId)) {
    return { title: "Trade Not Found" };
  }

  const trade = await getTradeById(tradeId);

  if (!trade) {
    return { title: "Trade Not Found" };
  }

  const teamNames = trade.tradeTeams
    .map((t) => t.teamDisplayName)
    .join(", ");
  const title = `${teamNames} Trade — NBA Trade Analysis`;
  const description = trade.description
    ? `${trade.title}. ${trade.description}`
    : `${trade.title}. AI-powered NBA trade analysis between ${teamNames} with salary cap validation.`;

  return {
    title,
    description,
    robots: { index: true, follow: true },
    alternates: {
      canonical: `${siteUrl}/my-trades/${id}`,
    },
    openGraph: {
      title: `${title} | Roster Flows`,
      description,
      url: `${siteUrl}/my-trades/${id}`,
    },
  };
}

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
      <div className="flex flex-col">
        <div className="min-h-screen flex flex-col">
          <Navbar subtitle={<h1>Trade Details</h1>} />
          <SavedTradeDetail trade={trade} currentUserId={userId} />
        </div>
        <Footer />
      </div>
    </main>
  );
}
