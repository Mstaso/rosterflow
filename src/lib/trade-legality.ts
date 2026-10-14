/**
 * Deterministic legality check for a proposed trade.
 *
 * The model picks who moves; this module decides whether the result is a
 * real, legal trade. It resolves every named team, player and pick back to
 * database rows (nothing the model says about salary or ownership is used),
 * then applies the same cap/Stepien rules the result card shows
 * (`collectTradeWarnings`), so the server and the UI cannot disagree.
 *
 * Pure functions — safe to import from client components.
 */

import type { DraftPick, Player, SelectedAsset, Team } from "~/types";
import { getOwnStepienBlockedYears, isOwnPick } from "./stepien";
import { collectTradeWarnings, type TeamTradeMove } from "./trade-warnings";

const STANDARD_ROSTER_LIMIT = 15;

export type ViolationCode =
  | "STRUCTURE" // malformed: missing teams, team gives nothing, asset given twice
  | "UNKNOWN_TEAM" // team isn't part of this request
  | "UNKNOWN_PLAYER" // no such player on any involved team
  | "WRONG_TEAM" // real asset, but the stated team doesn't hold it
  | "UNKNOWN_PICK" // stated team holds no pick for that year/round
  | "UNTRADABLE_PICK" // already owed elsewhere, frozen, or draft already held
  | "STEPIEN"
  | "ROUTING" // an asset has no valid destination, or is received without being given
  | "SALARY" // cap-tier matching
  | "ROSTER" // trade pushes a team past 15 players
  | "REQUEST"; // ignores what the user asked for (selected asset, destination)

export interface Violation {
  code: ViolationCode;
  message: string;
}

export function norm(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .trim();
}

// --- Pick tradability -------------------------------------------------------

/** The next draft that hasn't happened yet (the draft is in late June). */
export function nextDraftYear(now: Date = new Date()): number {
  return now.getUTCMonth() >= 6 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
}

/**
 * Why a pick row can't be traded by the team it's listed under, or null if it
 * can. The pick table lists a team's obligations next to its holdings, so a
 * row is not proof of ownership: "To PHL (…)" is a pick the team already owes.
 */
export function pickUntradableReason(
  pick: DraftPick,
  team: Team,
  now: Date = new Date()
): string | null {
  if (pick.year < nextDraftYear(now)) return "that draft has already happened";
  const desc = (pick.description ?? "").trim().toLowerCase();
  if (desc.startsWith("to ")) return "already owed to another team";
  if (desc.includes("frozen")) return "frozen";
  if (
    pick.round === 1 &&
    isOwnPick(pick) &&
    getOwnStepienBlockedYears(team).has(pick.year)
  ) {
    return "Stepien rule (no consecutive future R1s)";
  }
  return null;
}

export function tradablePicks(team: Team, now: Date = new Date()): DraftPick[] {
  return (team.draftPicks ?? []).filter(
    (p) => pickUntradableReason(p, team, now) === null
  );
}

/**
 * Name the model must use for a pick. Teams often hold two picks in the same
 * year and round; the second and later get "#2", "#3" so the name maps back to
 * exactly one row.
 */
export function pickLabel(pick: DraftPick, team: Team, now: Date = new Date()): string {
  const base = `${pick.year} R${pick.round}`;
  const siblings = tradablePicks(team, now).filter(
    (p) => p.year === pick.year && p.round === pick.round
  );
  const index = siblings.findIndex((p) => p.id === pick.id);
  return index > 0 ? `${base} #${index + 1}` : base;
}

function parsePickName(
  name: string
): { year: number; round: number; index: number } | null {
  const m = /^(\d{4})\s+R([12])(?:\s*#(\d+))?/i.exec((name ?? "").trim());
  if (!m) return null;
  return {
    year: parseInt(m[1]!, 10),
    round: parseInt(m[2]!, 10),
    index: m[3] ? parseInt(m[3], 10) - 1 : 0,
  };
}

// --- Resolution ---------------------------------------------------------------

function findTeam(teams: Team[], name: string): Team | undefined {
  const target = norm(name);
  return teams.find(
    (t) => norm(t.displayName ?? "") === target || norm(t.name ?? "") === target
  );
}

function findPlayer(team: Team, name: string): Player | undefined {
  const target = norm(name);
  return (team.players ?? []).find((p) => norm(p.fullName) === target);
}

export interface LegalityResult {
  violations: Violation[];
  /** Resolved per-team view; only complete when there are no resolution violations. */
  moves: TeamTradeMove[];
}

/**
 * Check a trade in the generator's `{ teams: [{ teamName, gives, receives }] }`
 * shape (after `reconstructReceives`). As a side effect, stamps the resolved
 * database `id` onto each pick so the client renders the exact row.
 */
export function checkTradeLegality(
  trade: any,
  involvedTeams: Team[],
  selectedAssets: SelectedAsset[] = [],
  now: Date = new Date()
): LegalityResult {
  const violations: Violation[] = [];
  const add = (code: ViolationCode, message: string) =>
    violations.push({ code, message });

  const tradeTeams: any[] = Array.isArray(trade?.teams) ? trade.teams : [];
  if (tradeTeams.length < 2) {
    add("STRUCTURE", "A trade needs at least two teams.");
    return { violations, moves: [] };
  }

  const selectedPickIds = new Set(
    selectedAssets.filter((a) => a.type === "pick").map((a) => a.id)
  );
  const moveByTeamId = new Map<number, TeamTradeMove>();
  const sides: { tt: any; team: Team; move: TeamTradeMove }[] = [];

  for (const tt of tradeTeams) {
    const team = findTeam(involvedTeams, tt.teamName);
    if (!team) {
      add("UNKNOWN_TEAM", `"${tt.teamName}" is not one of the teams in this trade.`);
      continue;
    }
    if (moveByTeamId.has(team.id)) {
      add("STRUCTURE", `${team.displayName} is listed twice.`);
      continue;
    }
    const move: TeamTradeMove = {
      team,
      playersSent: [],
      picksSent: [],
      playersReceived: [],
      picksReceived: [],
      outgoingSalary: 0,
      incomingSalary: 0,
      capDifference: 0,
    };
    moveByTeamId.set(team.id, move);
    sides.push({ tt, team, move });
  }

  // What each team gives, resolved against its own roster and picks only.
  const givenPlayers = new Map<string, Player>(); // "teamId:normName" → player
  const givenPicks = new Map<string, DraftPick>(); // "teamId:normName" → pick
  const failedGives = new Set<string>(); // already reported; don't report again as routing
  for (const { tt, team, move } of sides) {
    const players: any[] = tt.gives?.players ?? [];
    const picks: any[] = tt.gives?.picks ?? [];
    if (players.length + picks.length === 0) {
      add("STRUCTURE", `${team.displayName} gives nothing.`);
    }

    for (const p of players) {
      const player = findPlayer(team, p.name);
      if (!player) {
        const holder = involvedTeams.find((t) => t.id !== team.id && findPlayer(t, p.name));
        add(
          holder ? "WRONG_TEAM" : "UNKNOWN_PLAYER",
          holder
            ? `${p.name} plays for ${holder.displayName}, not ${team.displayName}.`
            : `${p.name} is not on ${team.displayName}'s roster.`
        );
        failedGives.add(`${team.id}:${norm(p.name)}`);
        continue;
      }
      const key = `${team.id}:${norm(p.name)}`;
      if (givenPlayers.has(key)) {
        add("STRUCTURE", `${player.fullName} is traded more than once.`);
        continue;
      }
      givenPlayers.set(key, player);
      move.playersSent.push(player);
    }

    for (const pk of picks) {
      const parsed = parsePickName(pk.name);
      const held = parsed
        ? (team.draftPicks ?? []).filter(
            (d) => d.year === parsed.year && d.round === parsed.round
          )
        : [];
      failedGives.add(`${team.id}:${norm(pk.name)}`); // cleared below once resolved
      if (!parsed || held.length === 0) {
        add("UNKNOWN_PICK", `${team.displayName} has no "${pk.name}" pick.`);
        continue;
      }
      // A pick the user selected themselves is their call; resolve it as-is.
      const userPick = held.find((d) => selectedPickIds.has(d.id));
      const tradable = held.filter((d) => pickUntradableReason(d, team, now) === null);
      const pick = userPick ?? tradable[parsed.index];
      if (!pick) {
        const reason = pickUntradableReason(held[0]!, team, now);
        if (tradable.length === 0 && reason) {
          add(
            reason.startsWith("Stepien") ? "STEPIEN" : "UNTRADABLE_PICK",
            `${team.displayName} can't trade their ${pk.name}: ${reason}.`
          );
        } else {
          add("UNKNOWN_PICK", `${team.displayName} has no "${pk.name}" pick.`);
        }
        continue;
      }
      const key = `${team.id}:${norm(pk.name)}`;
      if (givenPicks.has(key)) {
        add("STRUCTURE", `${team.displayName}'s ${pk.name} is traded more than once.`);
        continue;
      }
      givenPicks.set(key, pick);
      failedGives.delete(key);
      pk.id = pick.id;
      move.picksSent.push(pick);
    }
  }

  // What each team receives must be exactly what another team gave.
  const received = new Set<string>();
  for (const { tt, team, move } of sides) {
    const incoming: { item: any; isPick: boolean }[] = [
      ...(tt.receives?.players ?? []).map((item: any) => ({ item, isPick: false })),
      ...(tt.receives?.picks ?? []).map((item: any) => ({ item, isPick: true })),
    ];
    for (const { item, isPick } of incoming) {
      const from = findTeam(involvedTeams, item.from ?? "");
      const key = from ? `${from.id}:${norm(item.name)}` : "";
      const asset = isPick ? givenPicks.get(key) : givenPlayers.get(key);
      if (failedGives.has(key)) continue;
      if (!from || from.id === team.id || !asset || received.has(`${isPick}:${key}`)) {
        add(
          "ROUTING",
          `${team.displayName} receives ${item.name}, which ${item.from ?? "nobody"} did not send them.`
        );
        continue;
      }
      received.add(`${isPick}:${key}`);
      if (isPick) {
        item.id = (asset as DraftPick).id;
        move.picksReceived.push(asset as DraftPick);
      } else {
        move.playersReceived.push(asset as Player);
      }
    }
  }
  for (const [key, player] of givenPlayers) {
    if (!received.has(`false:${key}`)) {
      add("ROUTING", `${player.fullName} is sent away but no team receives him.`);
    }
  }
  for (const [key, pick] of givenPicks) {
    if (!received.has(`true:${key}`)) {
      add("ROUTING", `A ${pick.year} R${pick.round} pick is sent away but no team receives it.`);
    }
  }

  // The user's request: every selected asset moves, to the team they chose.
  for (const asset of selectedAssets) {
    const move = moveByTeamId.get(asset.teamId);
    const sent = asset.type === "player" ? move?.playersSent : move?.picksSent;
    if (!sent?.some((a) => a.id === asset.id)) {
      add("REQUEST", `A selected ${asset.type} (id ${asset.id}) is not in the trade.`);
      continue;
    }
    if (asset.targetTeamId) {
      const dest = moveByTeamId.get(asset.targetTeamId);
      const got = asset.type === "player" ? dest?.playersReceived : dest?.picksReceived;
      if (!got?.some((a) => a.id === asset.id)) {
        add("REQUEST", `A selected ${asset.type} (id ${asset.id}) does not go to the requested team.`);
      }
    }
  }

  const moves = sides.map(({ move }) => move);
  const sum = (ps: Player[]) => ps.reduce((a, p) => a + (p.contract?.salary ?? 0), 0);
  for (const move of moves) {
    move.outgoingSalary = sum(move.playersSent);
    move.incomingSalary = sum(move.playersReceived);
    move.capDifference = move.incomingSalary - move.outgoingSalary;

    const before = move.team.players?.length ?? 0;
    const after = before - move.playersSent.length + move.playersReceived.length;
    if (after > before && after > STANDARD_ROSTER_LIMIT) {
      add(
        "ROSTER",
        `${move.team.displayName} would hold ${after} players; the limit is ${STANDARD_ROSTER_LIMIT}.`
      );
    }
  }

  // Cap + Stepien rules are only meaningful once every name resolved; salary
  // math on a trade with a missing player is fiction.
  if (violations.every((v) => v.code === "ROSTER" || v.code === "REQUEST")) {
    for (const w of collectTradeWarnings(moves)) {
      // Stepien was already checked per pick above (and waived for picks the
      // user selected themselves; the card still warns about those).
      if (w.severity !== "blocker" || w.message.includes("Stepien")) continue;
      add("SALARY", w.message);
    }
  }

  return { violations, moves };
}
