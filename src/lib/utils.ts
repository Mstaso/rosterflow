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
}

// function getTeamInfo(team: Team) {
//   return team;
// }
