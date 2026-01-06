import type { Team, TradeScenario, TradeInfo } from "~/types";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { UsersIcon, FileTextIcon, AlertCircle, PencilIcon } from "lucide-react";
import Image from "next/image";
import SaveTradeModal from "../save-trade-modal";
import { Button } from "~/components/ui/button";
import { Activity } from "react";

export default function TradeCard({
  trade,
  involvedTeams,
  onEditTrade,
}: {
  trade: TradeScenario;
  involvedTeams: Team[];
  onEditTrade: (tradeToEdit: TradeInfo[], involvedTeams: Team[]) => void;
}) {
  let isValidTrade = true;
  let salaryRationale = "";

  const TradesWithInfo: TradeInfo[] = trade.teams.map((tradeTeam) => {
    const findTeam = involvedTeams.find(
      (team) => team.displayName === tradeTeam.teamName
    );

    const findReceivedPlayers = tradeTeam.receives?.players?.map((player) => {
      const findPlayerFromResponse = involvedTeams.find(
        (team) => team.displayName === player.from
      );
      return findPlayerFromResponse?.players?.find(
        (p) => p.fullName === player.name
      );
    });

    const findGivenPlayers = tradeTeam.gives?.players?.map((player) => {
      return findTeam?.players?.find((p) => p.fullName === player.name);
    });

    const outGoingSalary = findGivenPlayers?.reduce((acc, player) => {
      return acc + (player?.contract?.salary || 0);
    }, 0);

    const inComingSalary = findReceivedPlayers?.reduce((acc, player) => {
      return acc + (player?.contract?.salary || 0);
    }, 0);

    const capDifference =
      inComingSalary && outGoingSalary ? inComingSalary - outGoingSalary : 0;

    if (
      findTeam?.secondApronSpace &&
      findTeam?.secondApronSpace < 0 &&
      capDifference > 0
    ) {
      console.log(
        "INVALID TRADE SECOND APRON SPACE",
        findTeam.displayName,
        capDifference
      );
      isValidTrade = false;
      salaryRationale = `INVALID TRADE, ${findTeam.displayName} goes into SECOND APRON SPACE`;
    } else if (
      findTeam?.firstApronSpace &&
      findTeam?.firstApronSpace < 0 &&
      outGoingSalary &&
      inComingSalary &&
      inComingSalary > outGoingSalary * 1.1 + 100000
    ) {
      console.log("INVALID TRADE FIRST APRON SPACE", findTeam.displayName);
      isValidTrade = false;
      salaryRationale = `INVALID TRADE, ${findTeam.displayName} goes into FIRST APRON SPACE`;
    }
    return {
      team: findTeam,
      playersReceived: findReceivedPlayers,
      picksReceived: tradeTeam.receives?.picks,
      outGoingSalary,
      inComingSalary,
      capDifference,
    };
  });

  const calculateUpdatedTaxValue = (
    currentValue: number,
    capDifference: number
  ) => {
    if (currentValue < 0 && capDifference < 0) {
      return currentValue + capDifference;
    } else if (currentValue < 0 && capDifference > 0) {
      return currentValue - capDifference;
    } else if (currentValue > 0 && capDifference > 0) {
      return currentValue - capDifference;
    } else if (currentValue > 0 && capDifference < 0) {
      return currentValue - capDifference;
    } else {
      return 0;
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-3 mb-4">
        <SaveTradeModal
          isLoading={false}
          tradeInfo={TradesWithInfo}
          isValidTrade={isValidTrade}
        />
        <Button
          variant="outline"
          className="w-full sm:w-auto border-white text-white bg-transparent hover:bg-white/10 transition-all duration-150 ease-in-out"
          onClick={() => onEditTrade(TradesWithInfo, involvedTeams)}
        >
          <PencilIcon className="mr-2 h-5 w-5" strokeWidth={1.5} />
          Edit Trade
        </Button>
      </div>
      <Activity mode={!isValidTrade ? "visible" : "hidden"}>
        <div
          className="flex items-center gap-2 py-3 px-4 mb-4 rounded-md border border-destructive/50 bg-destructive/10 text-destructive
          justify-center w-fit mx-auto md:mx-0 md:justify-start"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <div className="text-sm font-medium">
            {salaryRationale || "Invalid trade"}
          </div>
        </div>
      </Activity>
      <div className="flex flex-col md:flex-row gap-4 justify-center">
        {TradesWithInfo.map((tradeInfo, index) => (
          <Card
            key={index}
            className="flex flex-col h-auto overflow-hidden border-indigoMain bg-gradient-to-br from-background via-background/95 to-muted/80 md:flex-1"
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
            <div className="px-4 py-3 bg-muted/10 ">
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
                        ? (tradeInfo.inComingSalary -
                            tradeInfo.outGoingSalary) /
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
                          (tradeInfo.inComingSalary -
                            tradeInfo.outGoingSalary) /
                          1000000
                        ).toFixed(1)
                      : 0}
                    M
                  </div>
                </div>
              </div>
            </div>
            <CardContent className="px-4 py-4 flex-grow flex flex-col bg-muted/60 border-indigoMain">
              <div>
                <div className="mb-4">
                  <div className="text-sm font-semibold mb-2">
                    Updated Team Cap Info
                  </div>
                  <table className="w-full border border-border rounded text-xs">
                    <tbody>
                      <tr className="bg-muted/40">
                        <td className="px-2 py-1 text-muted-foreground w-1/2">
                          Total Cap
                        </td>
                        <td className="px-2 py-1 font-medium w-1/2 text-right">
                          $
                          {tradeInfo.team?.totalCapAllocation
                            ? (
                                tradeInfo.team?.totalCapAllocation / 1000000
                              ).toFixed(1)
                            : "0.0"}
                          M
                        </td>
                      </tr>
                      <tr className="bg-background">
                        <td className="px-2 py-1 text-muted-foreground w-1/2">
                          Cap Space
                        </td>
                        <td className="px-2 py-1 font-medium w-1/2 text-right">
                          $
                          {(
                            calculateUpdatedTaxValue(
                              tradeInfo.team?.capSpace || 0,
                              tradeInfo.capDifference
                            ) / 1000000
                          ).toFixed(1)}
                          M
                        </td>
                      </tr>
                      <tr className="bg-muted/40">
                        <td className="px-2 py-1 text-muted-foreground w-1/2">
                          1st Apron Space
                        </td>
                        <td className="px-2 py-1 font-medium w-1/2 text-right">
                          $
                          {(
                            calculateUpdatedTaxValue(
                              tradeInfo.team?.firstApronSpace || 0,
                              tradeInfo.capDifference
                            ) / 1000000
                          ).toFixed(1)}
                          M
                        </td>
                      </tr>
                      <tr className="bg-background">
                        <td className="px-2 py-1 text-muted-foreground w-1/2">
                          2nd Apron Space
                        </td>
                        <td className="px-2 py-1 font-medium w-1/2 text-right">
                          $
                          {(
                            calculateUpdatedTaxValue(
                              tradeInfo.team?.secondApronSpace || 0,
                              tradeInfo.capDifference
                            ) / 1000000
                          ).toFixed(1)}
                          M
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-6">
                {/* Players Received */}
                {tradeInfo.playersReceived &&
                  tradeInfo.playersReceived.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-3 text-sm font-medium text-muted-foreground">
                        <UsersIcon className="w-4 h-4" strokeWidth={1.5} />
                        Players Received
                      </div>
                      <div className="h-auto">
                        <div className="space-y-3">
                          {tradeInfo.playersReceived.map(
                            (player, playerIndex) => (
                              <div
                                key={playerIndex}
                                className="group relative flex items-center justify-between p-3 rounded-md border-2 border-border bg-slate-950"
                              >
                                <div className="flex items-center gap-3">
                                  {player?.headshot && (
                                    <div className="bg-white/20 p-1 rounded-full">
                                      <Image
                                        src={player.headshot.href}
                                        alt={player.displayName}
                                        width={40}
                                        height={40}
                                        className="rounded-full object-cover w-10 h-10"
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
                                      {" | "}
                                      {player?.contract?.yearsRemaining}
                                      {` ${
                                        player?.contract?.yearsRemaining === 1
                                          ? "yr"
                                          : "yrs"
                                      }`}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                {/* Picks Received */}
                {tradeInfo.picksReceived &&
                  tradeInfo.picksReceived.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-3 text-sm font-medium text-muted-foreground">
                        <FileTextIcon className="w-4 h-4 " strokeWidth={1.5} />
                        Picks Received
                      </div>
                      <div className="h-auto">
                        <div className="space-y-3">
                          {tradeInfo.picksReceived.map((pick, pickIndex) => (
                            <div
                              key={pickIndex}
                              className="group relative flex items-center justify-between p-3 rounded-md border-2 border-border bg-slate-950"
                            >
                              <div className="flex flex-col gap-1">
                                <div className="text-xs text-muted-foreground">
                                  from {pick?.from}
                                </div>
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
                      </div>
                    </div>
                  )}

                {/* No assets received */}
                {(!tradeInfo.playersReceived ||
                  tradeInfo.playersReceived.length === 0) &&
                  (!tradeInfo.picksReceived ||
                    tradeInfo.picksReceived.length === 0) && (
                    <div className="text-center py-6 text-muted-foreground">
                      <div className="text-sm">No assets received</div>
                    </div>
                  )}
              </div>
            </CardContent>
            {/* <CardFooter className="flex flex-col gap-2 px-4 pb-4">
            <div className="text-sm text-muted-foreground">
              <strong>Trade Rationale:</strong>{" "}
              {trade.teams[index]?.explanation}
            </div>
            <div className="text-sm text-muted-foreground">
              <strong>Salary Details:</strong> {trade.teams[index]?.salaryMatch}
            </div>
          </CardFooter> */}
          </Card>
        ))}
      </div>
    </>
  );
}
