import { getNBATeams } from "~/actions/nbaTeams";
import TradeMachineClient from "~/components/trade-machine/trade-machine-client";
import type { Team } from "~/types";

export default async function TradeMachinePage() {
  const nbaTeams = await getNBATeams();

  return (
    <main className="bg-background text-foreground">
      <TradeMachineClient nbaTeams={nbaTeams as Team[]} />
    </main>
  );
}
