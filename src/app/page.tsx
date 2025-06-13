import TradeGenerator from "~/components/trade-generator";
import { Handshake } from "lucide-react";
import { getNBATeams } from "~/actions/nbaTeams";

export default async function Home() {
  const nbaTeams = await getNBATeams();

  return (
    <div className="min-h-screen bg-black">
      <div className="py-8">
        <h1 className="mb-2 flex items-center justify-center gap-2 text-center text-3xl font-bold text-white">
          <Handshake className="h-8 w-8" />
          Roster Flows
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
