/**
 * Deterministic repair for a trade that fails only on salary matching or
 * roster size.
 *
 * The legality checker is the oracle: we try small edits (add one role player
 * between two teams already in the deal, or drop one the model added) and keep
 * the best combination of at most two edits that the checker accepts. Only
 * role players are eligible, and among legal options the one moving the least
 * talent wins, so a repair reads as salary filler, never a second headliner.
 */

import type { Player, SelectedAsset, Team } from "~/types";
import { computePlayerRating } from "~/lib/server-utils";
import { checkTradeLegality, norm, type Violation } from "~/lib/trade-legality";

/**
 * Repairs only move filler: nobody rated as a starter or better (58+, see
 * `getTier`). Without this the cheapest legal fix is sometimes "add the other
 * team's superstar", which is legal and absurd. A trade that can't be fixed
 * with role players goes back to the model instead.
 */
const FILLER_MAX_RATING = 57;
/** Single edits carried into the two-edit search. */
const BEAM = 30;

type Edit =
  | { kind: "add"; from: string; to: string; player: Player }
  | { kind: "remove"; from: string; player: Player };

function apply(trade: any, edit: Edit): any {
  const next = structuredClone(trade);
  const from = next.teams.find((t: any) => t.teamName === edit.from);
  if (edit.kind === "add") {
    const to = next.teams.find((t: any) => t.teamName === edit.to);
    from.gives ??= {};
    (from.gives.players ??= []).push({ name: edit.player.fullName, type: "player" });
    to.receives ??= {};
    (to.receives.players ??= []).push({
      name: edit.player.fullName,
      type: "player",
      from: edit.from,
    });
    return next;
  }
  const name = norm(edit.player.fullName);
  from.gives.players = from.gives.players.filter((p: any) => norm(p.name) !== name);
  for (const t of next.teams) {
    if (!t.receives?.players) continue;
    t.receives.players = t.receives.players.filter(
      (p: any) => !(norm(p.name) === name && norm(p.from ?? "") === norm(edit.from))
    );
  }
  return next;
}

function candidateEdits(
  trade: any,
  involvedTeams: Team[],
  selectedAssets: SelectedAsset[]
): Edit[] {
  const selectedPlayerIds = new Set(
    selectedAssets.filter((a) => a.type === "player").map((a) => a.id)
  );
  const edits: Edit[] = [];
  for (const tt of trade.teams) {
    const team = involvedTeams.find((t) => norm(t.displayName) === norm(tt.teamName));
    if (!team) continue;
    const sending = new Set((tt.gives?.players ?? []).map((p: any) => norm(p.name)));
    for (const player of team.players ?? []) {
      if (computePlayerRating(player).rating > FILLER_MAX_RATING) continue;
      if (sending.has(norm(player.fullName))) {
        if (!selectedPlayerIds.has(player.id)) {
          edits.push({ kind: "remove", from: tt.teamName, player });
        }
        continue;
      }
      for (const other of trade.teams) {
        if (other.teamName !== tt.teamName) {
          edits.push({ kind: "add", from: tt.teamName, to: other.teamName, player });
        }
      }
    }
  }
  return edits;
}

/**
 * Returns a legal version of `trade`, or null if no edit of at most two moves
 * fixes it. Only attempted when every violation is SALARY or ROSTER — a
 * hallucinated player or an untradable pick isn't something filler can fix.
 */
export function repairTrade(
  trade: any,
  violations: Violation[],
  involvedTeams: Team[],
  selectedAssets: SelectedAsset[]
): { trade: any; notes: string[] } | null {
  if (!violations.every((v) => v.code === "SALARY" || v.code === "ROSTER")) return null;

  const rating = (e: Edit) => computePlayerRating(e.player).rating;
  const describe = (e: Edit) =>
    e.kind === "add"
      ? `added ${e.player.fullName} (${e.from} → ${e.to})`
      : `removed ${e.player.fullName} (${e.from})`;
  const check = (t: any) => checkTradeLegality(t, involvedTeams, selectedAssets).violations.length;

  const singles = candidateEdits(trade, involvedTeams, selectedAssets)
    .map((edit) => {
      const result = apply(trade, edit);
      return { edit, result, remaining: check(result), cost: rating(edit) };
    })
    .sort((a, b) => a.remaining - b.remaining || a.cost - b.cost);

  const fixed = singles.filter((s) => s.remaining === 0);
  if (fixed.length > 0) {
    const best = fixed[0]!; // already sorted by cost
    return { trade: best.result, notes: [describe(best.edit)] };
  }

  let best: { trade: any; notes: string[]; cost: number } | null = null;
  for (const first of singles.slice(0, BEAM)) {
    for (const second of candidateEdits(first.result, involvedTeams, selectedAssets)) {
      // Undoing the first edit is not a repair.
      if (second.player.id === first.edit.player.id) continue;
      const cost = first.cost + rating(second);
      if (best && cost >= best.cost) continue;
      const result = apply(first.result, second);
      if (check(result) === 0) {
        best = { trade: result, notes: [describe(first.edit), describe(second)], cost };
      }
    }
  }
  return best && { trade: best.trade, notes: best.notes };
}
