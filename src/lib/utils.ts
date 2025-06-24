import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Team, TradeScenario } from "~/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function validateTrade(trade: TradeScenario, involvedTeams: Team[]) {
  const tradeTeams = trade.teams.map((tradeTeam) => {
    const team = involvedTeams.find(
      (team) => team.displayName === tradeTeam.teamName
    );
    return team;
  });

  // TODO: Validate that the trade is valid

  // const findReceivedPlayers = tradeTeam.receives?.players?.map((player) => {
  //   const findPlayerFromResponse = involvedTeams.find(
  //     (team) => team.displayName === player.from
  //   );
  //   return findPlayerFromResponse?.players?.find(
  //     (p) => p.fullName === formatPlayerName(player.name)
  //   );
  // });

  // const findGivenPlayers = tradeTeam.gives?.players?.map((player) => {
  //   return findTeam?.players?.find(
  //     (p) => p.fullName === formatPlayerName(player.name)
  //   );
  // });

  // const outGoingSalary = findGivenPlayers?.reduce((acc, player) => {
  //   return acc + (player?.contract?.salary || 0);
  // }, 0);

  // const inComingSalary = findReceivedPlayers?.reduce((acc, player) => {
  //   return acc + (player?.contract?.salary || 0);
  // }, 0);
}
