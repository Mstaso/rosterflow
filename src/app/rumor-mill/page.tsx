import { Navbar } from "~/components/layout/navbar";
import { Footer } from "~/components/layout/footer";
import { RumorMillClient } from "~/components/rumor-mill/rumor-mill-client";
import { getRumors, getBuzzScores } from "~/actions/rumors";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rosterflows.com";

export const metadata: Metadata = {
  title: "NBA Trade Rumors & Buzz - Rumor Mill",
  description:
    "Live NBA trade rumors aggregated from insider reports and fan discussion. See which players and teams are generating the most buzz, then generate trade scenarios instantly.",
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: `${siteUrl}/rumor-mill`,
  },
  openGraph: {
    title: "NBA Trade Rumors & Buzz - Rumor Mill | Roster Flows",
    description:
      "Live NBA trade rumors from insider reports and Reddit. See trending players, then generate trade scenarios with one click.",
  },
};

export default async function RumorMillPage() {
  const [initialData, buzzData] = await Promise.all([
    getRumors({ page: 1 }),
    getBuzzScores(),
  ]);

  return (
    <main className="bg-background text-foreground">
      <div className="flex flex-col">
        <div className="min-h-screen flex flex-col">
          <Navbar subtitle={<h1>Rumor Mill</h1>} />
          <RumorMillClient
            initialRumors={initialData.rumors}
            initialTotal={initialData.total}
            initialTotalPages={initialData.totalPages}
            buzzPlayers={buzzData.players}
            buzzTeams={buzzData.teams}
          />
        </div>
        <Footer />
      </div>
    </main>
  );
}
