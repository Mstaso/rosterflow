import { db } from "../lib/db";

interface DraftPick {
  round: number;
  year: number;
  sequence?: number;
}

export async function getNBATeams() {
  return db.teams.getAll();
}

export async function getNBATeamWithRosterAndDraftPicks(teamId: number) {
  const team = await db.teams.getById(teamId);

  if (team) {
    // Sort draft picks by round, then year
    if (team.draftPicks) {
      team.draftPicks.sort((a: DraftPick, b: DraftPick) => {
        if (a.round !== b.round) return a.round - b.round;
        if (a.year !== b.year) return a.year - b.year;
        return (a.sequence ?? 0) - (b.sequence ?? 0);
      });
    }

    // Sort players by highest salary (descending)
    if (team.players && Array.isArray(team.players)) {
      team.players.sort((a: any, b: any) => {
        const aSalary =
          a.contract && typeof a.contract.salary === "number"
            ? a.contract.salary
            : 0;
        const bSalary =
          b.contract && typeof b.contract.salary === "number"
            ? b.contract.salary
            : 0;
        return bSalary - aSalary;
      });
    }
  }

  return team;
}
