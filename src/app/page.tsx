import { getNBATeams } from "~/actions/nbaTeams";
import { Navbar } from "~/components/layout/navbar";
import TradeMachineClient from "~/components/trade-machine/trade-machine-client";

export const dynamic = "force-dynamic";

export default async function TradeMachinePage() {
  const nbaTeams: any = await getNBATeams();

  return (
    <main className="bg-background text-foreground">
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <TradeMachineClient nbaTeams={nbaTeams || []} />
      </div>
    </main>
  );
}
