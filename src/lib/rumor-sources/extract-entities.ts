import OpenAI from "openai";
import { env } from "~/env";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export interface EntityRef {
  entityType: "player" | "team";
  entityName: string;
  playerId: number | null;
  teamId: number | null;
}

export interface PlayerRef {
  id: number;
  displayName: string;
  lastName: string;
  teamId: number;
}

export interface TeamRef {
  id: number;
  displayName: string;
  abbreviation: string;
  nickname: string;
}

/**
 * Extract player and team entities from rumor text.
 * Uses fast string matching first, falls back to OpenAI for ambiguous cases.
 */
export async function extractEntities(
  title: string,
  summary: string,
  players: PlayerRef[],
  teams: TeamRef[]
): Promise<EntityRef[]> {
  const text = `${title} ${summary}`.toLowerCase();
  const entities: EntityRef[] = [];
  const seenPlayers = new Set<number>();
  const seenTeams = new Set<number>();

  // Pass 1: String matching against known players
  for (const player of players) {
    // Match full display name or last name (if last name is 4+ chars to avoid false positives)
    const matchesDisplay = text.includes(player.displayName.toLowerCase());
    const matchesLast =
      player.lastName.length >= 4 &&
      text.includes(player.lastName.toLowerCase());

    if ((matchesDisplay || matchesLast) && !seenPlayers.has(player.id)) {
      seenPlayers.add(player.id);
      entities.push({
        entityType: "player",
        entityName: player.displayName,
        playerId: player.id,
        teamId: null,
      });
    }
  }

  // Pass 1: String matching against known teams
  for (const team of teams) {
    const matchesDisplay = text.includes(team.displayName.toLowerCase());
    const matchesNickname =
      team.nickname.length >= 4 &&
      text.includes(team.nickname.toLowerCase());
    const matchesAbbr =
      // Only match abbreviation with word boundaries to avoid false positives
      new RegExp(`\\b${team.abbreviation.toLowerCase()}\\b`).test(text);

    if (
      (matchesDisplay || matchesNickname || matchesAbbr) &&
      !seenTeams.has(team.id)
    ) {
      seenTeams.add(team.id);
      entities.push({
        entityType: "team",
        entityName: team.displayName,
        playerId: null,
        teamId: team.id,
      });
    }
  }

  // Pass 2: If string matching found nothing, try OpenAI
  if (entities.length === 0) {
    const aiEntities = await extractWithOpenAI(title, summary, players, teams);
    entities.push(...aiEntities);
  }

  return entities;
}

async function extractWithOpenAI(
  title: string,
  summary: string,
  players: PlayerRef[],
  teams: TeamRef[]
): Promise<EntityRef[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content:
            "Extract NBA player names and team names from this trade rumor. Return valid JSON only: {\"players\": [\"Full Name\", ...], \"teams\": [\"Team Name\", ...]}. If none found, return {\"players\": [], \"teams\": []}.",
        },
        {
          role: "user",
          content: `Title: ${title}\nContent: ${summary}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return [];

    const parsed = JSON.parse(content) as {
      players?: string[];
      teams?: string[];
    };

    const entities: EntityRef[] = [];
    const seenPlayers = new Set<number>();
    const seenTeams = new Set<number>();

    // Fuzzy match AI-extracted player names against DB
    for (const name of parsed.players ?? []) {
      const lower = name.toLowerCase();
      const match = players.find(
        (p) =>
          p.displayName.toLowerCase() === lower ||
          p.displayName.toLowerCase().includes(lower) ||
          lower.includes(p.displayName.toLowerCase()) ||
          lower.includes(p.lastName.toLowerCase())
      );
      if (match && !seenPlayers.has(match.id)) {
        seenPlayers.add(match.id);
        entities.push({
          entityType: "player",
          entityName: match.displayName,
          playerId: match.id,
          teamId: null,
        });
      }
    }

    // Fuzzy match AI-extracted team names against DB
    for (const name of parsed.teams ?? []) {
      const lower = name.toLowerCase();
      const match = teams.find(
        (t) =>
          t.displayName.toLowerCase() === lower ||
          t.displayName.toLowerCase().includes(lower) ||
          lower.includes(t.nickname.toLowerCase()) ||
          t.abbreviation.toLowerCase() === lower
      );
      if (match && !seenTeams.has(match.id)) {
        seenTeams.add(match.id);
        entities.push({
          entityType: "team",
          entityName: match.displayName,
          playerId: null,
          teamId: match.id,
        });
      }
    }

    return entities;
  } catch (error) {
    console.error("OpenAI entity extraction failed:", error);
    return [];
  }
}
