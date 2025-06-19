import { getNBATeams } from "~/actions/nbaTeams";
import TradeMachineClient from "~/components/trade-machine/trade-machine-client";
import type { Team } from "~/types";

export default async function TradeMachinePage() {
  const nbaTeams: any = await getNBATeams();

  return (
    <main className="bg-background text-foreground">
      <TradeMachineClient nbaTeams={nbaTeams} />
    </main>
  );
}
