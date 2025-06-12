import TradeGenerator from "~/components/trade-generator";
import { Handshake } from "lucide-react";
import type { NBATeam } from "~/lib/nba-types";
import { getApiUrl } from "~/lib/api-utils";

async function getNBATeams(): Promise<NBATeam[]> {
  try {
    const response = await fetch(getApiUrl("/api/espn/nba/teams"), {
      cache: "force-cache", // Cache for 1 hour since team data doesn't change often
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch NBA teams: ${response.status}`);
    }

    const data = await response.json();
    console.log("been hit", data);
    if (data.success && data.data) {
      return data.data;
    } else {
      throw new Error("Invalid response format from NBA teams API");
    }
  } catch (error) {
    console.error("Error fetching NBA teams:", error);
    // Return empty array as fallback
    return [];
  }
}

export default async function Home() {
  const nbaTeams = await getNBATeams();

  return (
    <div className="min-h-screen bg-black">
      <div className="py-8">
        <h1 className="mb-2 flex items-center justify-center gap-2 text-center text-3xl font-bold text-white">
          <Handshake className="h-8 w-8" />
          Roster Flow
        </h1>
        <p className="text-center text-gray-400">
          Create and generate realistic NBA trades
        </p>
      </div>
      <div className="w-full px-2 py-4 md:container md:mx-auto md:px-4">
        <TradeGenerator nbaTeams={nbaTeams} />
      </div>
    </div>
  );
}
