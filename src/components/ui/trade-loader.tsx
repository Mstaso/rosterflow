"use client";

import { Loader2, Circle } from "lucide-react";
import { Card, CardContent } from "./card";

export function TradeLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-96 border-2 border-primary/20 shadow-lg">
        <CardContent className="flex flex-col items-center justify-center space-y-6 p-8">
          <div className="relative">
            <Circle className="h-16 w-16 text-indigoMain animate-bounce" />
            <Loader2 className="absolute inset-0 h-16 w-16 animate-spin text-indigoMain/30" />
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-foreground">
              Generating Trades
            </h2>
            <p className="text-muted-foreground">
              Our AI is analyzing rosters, salary caps, and trade rules to
              create realistic scenarios...
            </p>
          </div>

          <div className="flex space-x-2">
            <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="h-2 w-2 bg-primary rounded-full animate-bounce"></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
