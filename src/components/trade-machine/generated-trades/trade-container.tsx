"use client";

import { useEffect, useRef, useState } from "react";
import { Undo2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "~/components/ui/button";
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
  const prevCount = useRef(tradesData.length);
  const [currentTradeIndex, setCurrentTradeIndex] = useState(0);

  // Track trade count for dot indicators (no auto-advance).
  useEffect(() => {
    prevCount.current = tradesData.length;
  }, [tradesData.length]);

  // Keep index in bounds if trade list shrinks.
  useEffect(() => {
    if (tradesData.length === 0) return;
    if (currentTradeIndex > tradesData.length - 1) {
      setCurrentTradeIndex(tradesData.length - 1);
    }
  }, [currentTradeIndex, tradesData.length]);

  return (
    <div className="flex-grow">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-6">
        <div className="mb-6 flex items-center justify-between">
          <Button
            onClick={onBack}
            variant="ghost"
            className="text-muted-foreground p-0 h-auto hover:text-white hover:bg-transparent"
          >
            <Undo2 className="h-4 w-4 text-indigoMain" />
            Back to Trade Generator
          </Button>

          {hasTrades && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentTradeIndex((i) => Math.max(i - 1, 0))}
                disabled={currentTradeIndex === 0}
                className="h-8 w-8 text-muted-foreground hover:text-white hover:bg-muted/40 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex items-center gap-1.5 px-2">
                {tradesData.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentTradeIndex(index)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      index === currentTradeIndex
                        ? "w-6 bg-indigoMain"
                        : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    }`}
                  />
                ))}
                {isStreaming && (
                  <span className="relative flex h-2 w-2 ml-0.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigoMain opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-indigoMain/50" />
                  </span>
                )}
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setCurrentTradeIndex((i) =>
                    Math.min(i + 1, tradesData.length - 1)
                  )
                }
                disabled={currentTradeIndex === tradesData.length - 1}
                className="h-8 w-8 text-muted-foreground hover:text-white hover:bg-muted/40 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              <span className="text-xs text-muted-foreground ml-1 tabular-nums">
                {currentTradeIndex + 1}/{tradesData.length}
                {isStreaming && "+"}
              </span>
            </div>
          )}
        </div>

        {hasTrades ? (
          <TradeCard
            key={currentTradeIndex}
            trade={tradesData[currentTradeIndex]!}
            involvedTeams={involvedTeams}
            onEditTrade={onEditTrade}
          />
        ) : isStreaming ? (
          <TradeCardSkeleton />
        ) : null}
      </div>
    </div>
  );
}
