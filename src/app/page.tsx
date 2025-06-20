import { getNBATeams } from "~/actions/nbaTeams";
import { Navbar } from "~/components/layout/navbar";
import TradeMachineClient from "~/components/trade-machine/trade-machine-client";

export default async function TradeMachinePage() {
  const nbaTeams: any = await getNBATeams();

  return (
    <main className="bg-background text-foreground">
      <div className="flex flex-col min-h-screen">
        <Navbar />
        {nbaTeams?.length > 0 && <TradeMachineClient nbaTeams={nbaTeams} />}
      </div>
    </main>
  );
}
