import type { Team, TradeScenario } from "~/types";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "~/components/ui/card";
import { ScrollArea } from "~/components/ui/scroll-area";
import { UsersIcon, FileTextIcon } from "lucide-react";
import Image from "next/image";

export default function TradeCard({
  trade,
  involvedTeams,
}: {
  trade: TradeScenario;
  involvedTeams: Team[];
}) {
  const formatPlayerName = (playerName: string) => {
    const copyPlayerName = playerName;
    const splitPlayerName = copyPlayerName.split(" ");
    splitPlayerName.pop();
    return `${splitPlayerName.join(" ")}`;
  };

  const TradesWithInfo = trade.teams.map((tradeTeam) => {
    const findTeam = involvedTeams.find(
      (team) => team.displayName === tradeTeam.teamName
    );

    const findReceivedPlayers = tradeTeam.receives?.players?.map((player) => {
      const findPlayerFromResponse = involvedTeams.find(
        (team) => team.displayName === player.from
      );
      return findPlayerFromResponse?.players?.find(
        (p) => p.fullName === formatPlayerName(player.name)
      );
    });

    const findGivenPlayers = tradeTeam.gives?.players?.map((player) => {
      return findTeam?.players?.find(
        (p) => p.fullName === formatPlayerName(player.name)
      );
    });

    const outGoingSalary = findGivenPlayers?.reduce((acc, player) => {
      return acc + (player?.contract?.salary || 0);
    }, 0);

    const inComingSalary = findReceivedPlayers?.reduce((acc, player) => {
      return acc + (player?.contract?.salary || 0);
    }, 0);

    return {
      team: findTeam,
      playersReceived: findReceivedPlayers,
      picksReceived: tradeTeam.receives?.picks,
      outGoingSalary,
      inComingSalary,
    };
  });

  return (
    <div
      className="grid gap-4 justify-center"
      style={{
        gridTemplateColumns: `repeat(${trade.teams.length}, 1fr)`,
      }}
    >
      {TradesWithInfo.map((tradeInfo, index) => (
        <Card
          key={index}
          className="flex flex-col h-auto overflow-hidden border-indigoMain bg-gradient-to-br from-background via-background/95 to-muted/80"
        >
          <CardHeader className="flex flex-row items-center justify-center space-y-0 pb-2 pt-4 px-4 bg-muted/60">
            <div className="flex items-center gap-2">
              {tradeInfo.team?.logos?.[0] && (
                <Image
                  src={tradeInfo.team.logos[0].href}
                  alt={tradeInfo.team.logos[0].alt}
                  width={24}
                  height={24}
                  className="object-contain"
                />
              )}
              <span className="text-lg font-semibold">
                {tradeInfo.team?.displayName}
              </span>
            </div>
          </CardHeader>
          <div className="px-4 py-3 bg-muted/40">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  Outgoing Salary
                </div>
                <div className="text-sm font-medium">
                  $
                  {tradeInfo.outGoingSalary
                    ? (tradeInfo.outGoingSalary / 1000000).toFixed(1)
                    : 0}
                  M
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  Incoming Salary
                </div>
                <div className="text-sm font-medium">
                  $
                  {tradeInfo.inComingSalary
                    ? (tradeInfo.inComingSalary / 1000000).toFixed(1)
                    : 0}
                  M
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">
                  Cap Difference
                </div>
                <div
                  className={`text-sm font-medium ${
                    tradeInfo.inComingSalary && tradeInfo.outGoingSalary
                      ? (tradeInfo.inComingSalary - tradeInfo.outGoingSalary) /
                          1000000 >
                        0
                        ? "text-red-500"
                        : (tradeInfo.inComingSalary -
                            tradeInfo.outGoingSalary) /
                            1000000 <
                          0
                        ? "text-green-500"
                        : "text-foreground"
                      : "text-foreground"
                  }`}
                >
                  $
                  {tradeInfo.inComingSalary && tradeInfo.outGoingSalary
                    ? (
                        (tradeInfo.inComingSalary - tradeInfo.outGoingSalary) /
                        1000000
                      ).toFixed(1)
                    : 0}
                  M
                </div>
              </div>
            </div>
          </div>
          <CardContent className="px-4 pb-4 flex-grow flex flex-col bg-muted/60 border-indigoMain">
            <div className="space-y-4">
              {/* Players Received */}
              {tradeInfo.playersReceived &&
                tradeInfo.playersReceived.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 text-sm font-medium text-muted-foreground">
                      <UsersIcon className="w-4 h-4" strokeWidth={1.5} />
                      Players Received
                    </div>
                    <ScrollArea className="h-auto pr-3">
                      <div className="space-y-2">
                        {tradeInfo.playersReceived.map(
                          (player, playerIndex) => (
                            <div
                              key={playerIndex}
                              className="group relative flex items-center justify-between p-2.5 rounded-md border-2 border-border bg-slate-950"
                            >
                              <div className="flex items-center gap-3">
                                {player?.headshot && (
                                  <div className="bg-white/20 p-1 rounded-full">
                                    <Image
                                      src={player.headshot.href}
                                      alt={player.displayName}
                                      width={40}
                                      height={40}
                                      className="rounded-full object-cover"
                                    />
                                  </div>
                                )}
                                <div>
                                  <div className="font-medium text-sm">
                                    {player?.displayName}{" "}
                                    <span className="text-xs text-muted-foreground">
                                      (
                                      {player?.position?.abbreviation ||
                                        "Unknown"}
                                      )
                                    </span>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {player?.contract
                                      ? `Salary: $${(
                                          player.contract.salary / 1000000
                                        ).toFixed(1)}M`
                                      : "No contract"}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}

              {/* Picks Received */}
              {tradeInfo.picksReceived &&
                tradeInfo.picksReceived.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2 text-sm font-medium text-muted-foreground">
                      <FileTextIcon className="w-4 h-4" strokeWidth={1.5} />
                      Picks Received
                    </div>
                    <ScrollArea className="h-auto pr-3">
                      <div className="space-y-2">
                        {tradeInfo.picksReceived.map((pick, pickIndex) => (
                          <div
                            key={pickIndex}
                            className="group relative flex items-center justify-between p-2.5 rounded-md border-2 border-border bg-slate-950"
                          >
                            <div>
                              <div className="font-medium text-sm">
                                {pick?.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Draft pick
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

              {/* No assets received */}
              {(!tradeInfo.playersReceived ||
                tradeInfo.playersReceived.length === 0) &&
                (!tradeInfo.picksReceived ||
                  tradeInfo.picksReceived.length === 0) && (
                  <div className="text-center py-4 text-muted-foreground">
                    <div className="text-sm">No assets received</div>
                  </div>
                )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-row gap-2 px-4 pb-4">
            <div className="text-sm text-muted-foreground">
              {trade.explanation}
            </div>
            <div className="text-sm text-muted-foreground">
              {trade.salaryMatch}
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
