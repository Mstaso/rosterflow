import { useState } from "react";
import { Button } from "~/components/ui/button";
import type { Team, TradeScenario } from "~/types";
import TradeCard from "./trade-card";

export default function TradeContainer({
  tradesData,
  involvedTeams,
}: {
  tradesData: TradeScenario[];
  involvedTeams: Team[];
}) {
  const [selectedTrade, setSelectedTrade] = useState<TradeScenario | null>(
    null
  );
  console.log("been hit tradesData", tradesData);
  const handleSelectTrade = (trade: TradeScenario) => {
    setSelectedTrade(trade);
  };

  return (
    <div>
      <Button variant="outline" className="w-full md:w-auto border-indigoMain">
        Back to Trade Generator
      </Button>
      <div>
        {tradesData.map((trade) => (
          <TradeCard
            trade={trade}
            involvedTeams={involvedTeams}
            key={trade.teams.map((team) => team.teamName).join(",")}
          />
        ))}
      </div>
    </div>
  );
}
