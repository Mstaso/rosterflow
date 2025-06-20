import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import type { Team, TradeScenario } from "~/types";
import TradeCard from "./trade-card";

export default function TradeContainer({
  tradesData,
  involvedTeams,
}: {
  tradesData: TradeScenario[];
  involvedTeams: Team[];
}) {
  console.log("been hit tradesData", tradesData);

  return (
    <div className="flex-grow p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <Button
          variant="outline"
          className="w-full sm:w-auto bg-indigoMain text-primary-white hover:bg-indigoMain/70
          disabled:bg-muted disabled:text-muted-foreground/70 disabled:border disabled:border-muted-foreground/30 disabled:cursor-not-allowed
          transition-all duration-150 ease-in-out"
        >
          Back to Trade Generator
        </Button>
      </div>

      <Tabs defaultValue="trade-0" className="w-full">
        <TabsList
          className="grid w-full"
          style={{
            gridTemplateColumns: `repeat(${tradesData.length}, 1fr)`,
          }}
        >
          {tradesData.map((trade, index) => (
            <TabsTrigger key={index} value={`trade-${index}`} className="p-2">
              Trade {index + 1}
            </TabsTrigger>
          ))}
        </TabsList>

        {tradesData.map((trade, index) => (
          <TabsContent key={index} value={`trade-${index}`} className="mt-6">
            <TradeCard trade={trade} involvedTeams={involvedTeams} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
