import { getNBATeams } from "~/actions/nbaTeams";
import { Navbar } from "~/components/layout/navbar";
import TradeMachineClient from "~/components/trade-machine/trade-machine-client";
import type { SelectedAsset } from "~/types";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "NBA Trade Machine - Create & Simulate Trades",
  description:
    "Build realistic NBA trades with our AI-powered trade machine. Select teams, add players and draft picks, check salary cap compliance, and let AI generate smart trade suggestions.",
  openGraph: {
    title: "NBA Trade Machine - Create & Simulate Trades | RosterFlow",
    description:
      "Build realistic NBA trades with our AI-powered trade machine. Select teams, add players and draft picks, and let AI generate smart trade suggestions.",
  },
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function TradeMachinePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const nbaTeams: any = await getNBATeams();
  const params = await searchParams;

  // Parse initial state from URL params (for editing saved trades)
  let initialTeamIds: number[] = [];
  let initialAssets: SelectedAsset[] = [];

  if (params.teamIds && typeof params.teamIds === "string") {
    initialTeamIds = params.teamIds.split(",").map((id) => parseInt(id, 10));
  }

  if (params.assets && typeof params.assets === "string") {
    try {
      initialAssets = JSON.parse(params.assets);
    } catch (e) {
      console.error("Failed to parse assets from URL:", e);
    }
  }

  return (
    <main className="bg-background text-foreground">
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <TradeMachineClient
          nbaTeams={nbaTeams || []}
          initialTeamIds={initialTeamIds}
          initialAssets={initialAssets}
        />
      </div>
    </main>
  );
}
