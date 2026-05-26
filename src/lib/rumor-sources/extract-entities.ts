import Anthropic from "@anthropic-ai/sdk";
import { env } from "~/env";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const CLASSIFIER_MODEL = "claude-sonnet-4-6";
const MAX_BODY_CHARS = 3000;

export interface EntityRef {
  entityType: "player" | "team";
  entityName: string;
  playerId: number | null;
  teamId: number | null;
}

export type RumorType = "trade_rumor" | "trade_idea" | "news";

export interface ExtractionResult {
  entities: EntityRef[];
  rumorType: RumorType;
  isTradeRelevant: boolean;
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

const VALID_TYPES: RumorType[] = ["trade_rumor", "trade_idea", "news"];

const CLASSIFIER_SYSTEM = `You are classifying NBA news items for a "rumor mill" feature that ONLY shows trade-related content.

For each item, decide:
1. isTradeRelevant: TRUE only if the item discusses an actual or hypothetical NBA player trade, trade interest/speculation, or trade-blocking salary/cap dynamics. FALSE for: coach/GM hires, front-office shuffles, draft entry/withdrawal deadlines, injury reports, game recaps/highlights/scores, opinion columns about "blow it up" without specific trade content, generic free-agency power rankings, contract extensions of a team's own player.
2. rumorType: one of "trade_rumor" (real reported/rumored trade), "trade_idea" (hypothetical trade proposed by author/fan), or "news" (everything else — used when isTradeRelevant is false).
3. players[]: full names of NBA players actually mentioned in the text as trade subjects. Include ONLY players whose names literally appear. Do NOT include players merely implied. Exclude coaches, GMs, owners, reporters.
4. teams[]: NBA team names actually mentioned as parties to a potential trade.

Respond with valid JSON only, no markdown:
{"isTradeRelevant": boolean, "rumorType": "trade_rumor" | "trade_idea" | "news", "players": ["Full Name", ...], "teams": ["Team Name", ...]}`;

function stringMatchCandidates(
  text: string,
  players: PlayerRef[],
  teams: TeamRef[]
): { playerNames: string[]; teamNames: string[] } {
  const lower = text.toLowerCase();
  const playerNames: string[] = [];
  const teamNames: string[] = [];

  for (const p of players) {
    const matchDisplay = lower.includes(p.displayName.toLowerCase());
    const matchLast =
      p.lastName.length >= 4 && lower.includes(p.lastName.toLowerCase());
    if (matchDisplay || matchLast) playerNames.push(p.displayName);
  }
  for (const t of teams) {
    const matchDisplay = lower.includes(t.displayName.toLowerCase());
    const matchNick =
      t.nickname.length >= 4 && lower.includes(t.nickname.toLowerCase());
    const matchAbbr = new RegExp(
      `\\b${t.abbreviation.toLowerCase()}\\b`
    ).test(lower);
    if (matchDisplay || matchNick || matchAbbr) teamNames.push(t.displayName);
  }
  return { playerNames, teamNames };
}

function resolvePlayer(name: string, players: PlayerRef[]): PlayerRef | null {
  const lower = name.toLowerCase().trim();
  return (
    players.find(
      (p) =>
        p.displayName.toLowerCase() === lower ||
        p.displayName.toLowerCase().includes(lower) ||
        lower.includes(p.displayName.toLowerCase()) ||
        (p.lastName.length >= 4 && lower.includes(p.lastName.toLowerCase()))
    ) ?? null
  );
}

function resolveTeam(name: string, teams: TeamRef[]): TeamRef | null {
  const lower = name.toLowerCase().trim();
  return (
    teams.find(
      (t) =>
        t.displayName.toLowerCase() === lower ||
        t.displayName.toLowerCase().includes(lower) ||
        lower.includes(t.nickname.toLowerCase()) ||
        t.abbreviation.toLowerCase() === lower
    ) ?? null
  );
}

function stripCodeFences(s: string): string {
  let cleaned = s.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  return cleaned;
}

/**
 * Classify a rumor and extract its entities via a single LLM call.
 * The LLM is the authoritative source for both rumorType and relevance.
 * String-matched candidates are passed in as hints to ground the model.
 */
export async function extractEntities(
  title: string,
  body: string,
  players: PlayerRef[],
  teams: TeamRef[]
): Promise<ExtractionResult> {
  const boundedBody = body.slice(0, MAX_BODY_CHARS);
  const combined = `${title}\n${boundedBody}`;
  const { playerNames, teamNames } = stringMatchCandidates(
    combined,
    players,
    teams
  );

  const userPrompt = `Title: ${title}
Content: ${boundedBody || "(no body text)"}

Candidate players (may include false positives — only include those literally named in the text): ${playerNames.slice(0, 30).join(", ") || "(none)"}
Candidate teams: ${teamNames.join(", ") || "(none)"}

Respond with JSON only.`;

  let parsed: {
    isTradeRelevant?: boolean;
    rumorType?: string;
    players?: string[];
    teams?: string[];
  };

  try {
    const res = await anthropic.messages.create({
      model: CLASSIFIER_MODEL,
      system: CLASSIFIER_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
      max_tokens: 500,
      temperature: 0,
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    parsed = JSON.parse(stripCodeFences(text));
  } catch (err) {
    console.error("Rumor classification failed:", err);
    return { entities: [], rumorType: "news", isTradeRelevant: false };
  }

  const rumorType: RumorType = VALID_TYPES.includes(parsed.rumorType as RumorType)
    ? (parsed.rumorType as RumorType)
    : "news";
  const isTradeRelevant = parsed.isTradeRelevant === true;

  const entities: EntityRef[] = [];
  const seenPlayers = new Set<number>();
  const seenTeams = new Set<number>();

  for (const name of parsed.players ?? []) {
    const match = resolvePlayer(name, players);
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
  for (const name of parsed.teams ?? []) {
    const match = resolveTeam(name, teams);
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

  return { entities, rumorType, isTradeRelevant };
}
