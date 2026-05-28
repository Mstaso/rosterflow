"use client";

import { useEffect, useRef, useState } from "react";
import { Undo2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
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
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {!(isStreaming && !hasTrades) && (
            <Button
              onClick={onBack}
              variant="ghost"
              className="text-on-surface-variant p-0 h-auto hover:text-foreground hover:bg-transparent justify-start sm:justify-center"
            >
              <Undo2 className="h-4 w-4 text-primary" />
              Back to Trade Generator
            </Button>
          )}

          {!hasTrades && isStreaming && (
            <div className="flex items-center gap-2.5 text-on-surface-variant">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <p className="font-supermolot text-[11px] tracking-[0.22em]">
                Generating Scenarios
              </p>
            </div>
          )}

          {hasTrades && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCurrentTradeIndex((i) => Math.max(i - 1, 0))}
                disabled={currentTradeIndex === 0}
                aria-label="Previous scenario"
                className="h-9 w-9 text-on-surface-variant hover:text-foreground hover:bg-surface-high disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>

              {/* Segmented progress — one bar per scenario, active bar widens
                  and tints primary. Replaces the previous dot indicators for
                  a more editorial "chapter marker" feel. */}
              <div className="flex items-center gap-1.5 px-1">
                {tradesData.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentTradeIndex(index)}
                    aria-label={`View scenario ${index + 1}`}
                    aria-current={index === currentTradeIndex ? "true" : undefined}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      index === currentTradeIndex
                        ? "w-8 bg-primary"
                        : "w-5 bg-on-surface-variant/25 hover:bg-on-surface-variant/50"
                    }`}
                  />
                ))}
                {isStreaming && (
                  <span className="relative inline-flex h-1.5 w-1.5 ml-1">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary/60" />
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
                aria-label="Next scenario"
                className="h-9 w-9 text-on-surface-variant hover:text-foreground hover:bg-surface-high disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>

              <span className="ml-1 font-supermolot text-[11px] tracking-[0.22em] text-on-surface-variant tabular-nums">
                {String(currentTradeIndex + 1).padStart(2, "0")} /{" "}
                {String(tradesData.length).padStart(2, "0")}
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
            scenarioIndex={currentTradeIndex}
            scenarioCount={tradesData.length}
          />
        ) : isStreaming ? (
          <TradeCardSkeleton />
        ) : null}
      </div>
    </div>
  );
}
