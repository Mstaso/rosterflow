"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import type { Team, TradeInfo, TradeScenario } from "~/types";
import TradeCard from "./trade-card";
import TradeCardSkeleton from "./trade-card-skeleton";

export default function TradeContainer({
  tradesData,
  involvedTeams,
  onBack,
  onEditTrade,
  isStreaming = false,
}: {
  tradesData: TradeScenario[];
  involvedTeams: Team[];
  onBack: () => void;
  onEditTrade: (tradeToEdit: TradeInfo[], involvedTeams: Team[]) => void;
  isStreaming?: boolean;
}) {
  const hasTrades = tradesData.length > 0;
  const tabCount = tradesData.length + (isStreaming ? 1 : 0);
  const tabsListRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(tradesData.length);
  const [activeTradeTab, setActiveTradeTab] = useState("trade-0");

  const scrollToEnd = useCallback(() => {
    const el = tabsListRef.current;
    if (!el) return;
    el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
  }, []);

  const scrollActiveTabIntoView = useCallback(() => {
    const el = tabsListRef.current;
    if (!el) return;

    const activeTrigger = el.querySelector<HTMLButtonElement>(
      '[role="tab"][data-state="active"]'
    );
    if (!activeTrigger) return;

    activeTrigger.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, []);

  // Auto-scroll to reveal new tabs as they arrive
  useEffect(() => {
    if (tradesData.length > prevCount.current) {
      scrollToEnd();
    }
    prevCount.current = tradesData.length;
  }, [tradesData.length, scrollToEnd]);

  // Keep the selected tab fully visible in horizontally scrollable tab bars.
  useEffect(() => {
    scrollActiveTabIntoView();
  }, [activeTradeTab, tabCount, scrollActiveTabIntoView]);

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

        {hasTrades ? (
          <Tabs
            value={activeTradeTab}
            onValueChange={setActiveTradeTab}
            className="w-full"
          >
            <TabsList
              ref={tabsListRef}
              className="flex w-full h-auto overflow-x-auto scrollbar-none gap-2"
              style={
                tabCount <= 4
                  ? { display: "grid", gridTemplateColumns: `repeat(${tabCount}, 1fr)` }
                  : undefined
              }
            >
              {tradesData.map((_trade, index) => (
                <TabsTrigger key={index} value={`trade-${index}`} className="flex-shrink-0">
                  Trade {index + 1}
                </TabsTrigger>
              ))}
              {isStreaming && (
                <TabsTrigger
                  value="trade-loading"
                  className="flex-shrink-0 border-dashed border-indigoMain/30 bg-indigoMain/5"
                  disabled
                >
                  <span className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigoMain opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-indigoMain" />
                    </span>
                    Generating...
                  </span>
                </TabsTrigger>
              )}
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
        ) : isStreaming ? (
          <TradeCardSkeleton />
        ) : null}
      </div>
    </div>
  );
}
