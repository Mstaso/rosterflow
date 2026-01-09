import { ArrowLeft } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import type { Team, TradeInfo, TradeScenario } from "~/types";
import TradeCard from "./trade-card";

export default function TradeContainer({
  tradesData,
  involvedTeams,
  onBack,
  onEditTrade,
}: {
  tradesData: TradeScenario[];
  involvedTeams: Team[];
  onBack: () => void;
  onEditTrade: (tradeToEdit: TradeInfo[], involvedTeams: Team[]) => void;
}) {
  return (
    <div className="flex-grow">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-6">
        <div className="mb-6 flex gap-4">
          <Button
            onClick={onBack}
            variant="ghost"
            className="text-muted-foreground w-full sm:w-auto p-0 h-auto hover:text-white hover:bg-transparent justify-start sm:justify-center"
          >
            <ArrowLeft className="text-indigoMain" />
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
              <TradeCard
                trade={trade}
                involvedTeams={involvedTeams}
                onEditTrade={onEditTrade}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
