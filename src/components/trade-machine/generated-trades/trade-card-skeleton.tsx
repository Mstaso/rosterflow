import { Card, CardContent, CardHeader } from "~/components/ui/card";

export default function TradeCardSkeleton() {
  return (
    <div>
      <div className="flex flex-col md:flex-row gap-4 justify-center mb-4">
        {[1, 2].map((i) => (
          <Card
            key={i}
            className="flex flex-col h-auto overflow-hidden bg-surface-low md:flex-1"
          >
            <CardHeader className="flex flex-row items-center justify-center space-y-0 pb-2 pt-4 px-4 bg-surface-container">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-surface-high animate-pulse" />
                <div className="h-5 w-32 rounded bg-surface-high animate-pulse" />
              </div>
            </CardHeader>

            {/* Salary row skeleton */}
            <div className="px-4 py-3 bg-surface-low">
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="flex flex-col items-center gap-1.5">
                    <div className="h-3 w-16 rounded bg-surface-container animate-pulse" />
                    <div className="h-4 w-12 rounded bg-surface-high animate-pulse" />
                  </div>
                ))}
              </div>
            </div>

            <CardContent className="px-4 py-4 flex-grow flex flex-col bg-surface-container">
              {/* Cap table skeleton */}
              <div className="mb-4">
                <div className="h-4 w-36 rounded bg-surface-high animate-pulse mb-2" />
                <div className=" rounded overflow-hidden">
                  {[1, 2, 3, 4].map((j) => (
                    <div
                      key={j}
                      className={`flex justify-between py-2 px-2 ${j % 2 === 1 ? "bg-surface-high" : "bg-background"}`}
                    >
                      <div className="h-3 w-20 rounded bg-surface-container animate-pulse" />
                      <div className="h-3 w-14 rounded bg-surface-container animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Player section label skeleton */}
              <div className="h-4 w-28 rounded bg-surface-high animate-pulse mb-3" />

              {/* Player cards skeleton */}
              <div className="space-y-2">
                {[1, 2].map((j) => (
                  <div
                    key={j}
                    className="flex items-center gap-3 p-3 rounded-md bg-surface-low rounded-lg"
                  >
                    <div className="w-12 h-12 rounded-full bg-surface-container animate-pulse flex-shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-4 w-28 rounded bg-surface-high animate-pulse" />
                      <div className="h-3 w-20 rounded bg-surface-container animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
