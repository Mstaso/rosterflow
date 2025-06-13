import { db } from "../lib/db";

interface DraftPick {
  round: string;
  year: number;
}

export async function getNBATeams() {
  return db.teams.getAll();
}

export async function getNBATeamWithRosterAndDraftPicks(teamId: number) {
  const team = await db.teams.getById(teamId);
  if (team && team.draftPicks) {
    team.draftPicks.sort((a: DraftPick, b: DraftPick) => {
      if (a.round !== b.round) {
        return String(a.round).localeCompare(String(b.round));
      }
      return a.year - b.year;
    });
  }
  return team;
}
