/**
 * Stepien rule helpers — pure, client-safe.
 *
 * Teams can't trade their own R1 picks in consecutive future years. These two
 * helpers are the source of truth for that rule and are re-exported from
 * `server-utils.ts` so existing server callers keep working.
 */

import type { DraftPick, Team } from "~/types";

/**
 * True if a draft pick is the team's OWN future pick (vs one acquired from
 * another team via a prior trade). Own picks are subject to the Stepien rule.
 */
export function isOwnPick(pick: DraftPick): boolean {
  const desc = (pick.description ?? "").trim().toLowerCase();
  return desc === "" || desc === "own" || desc.startsWith("own");
}

/**
 * Years in which a team's OWN first-round pick is un-tradable under the
 * Stepien rule (no consecutive future R1s). Returns only blocked years for
 * picks the team actually still holds — acquired picks from other teams are
 * unaffected.
 */
export function getOwnStepienBlockedYears(team: Team): Set<number> {
  const blocked = new Set<number>();
  const r1Picks = (
    (team as { draftPicks?: DraftPick[] }).draftPicks || []
  ).filter((p) => p.round === 1);
  const ownYears = new Set<number>();
  for (const pick of r1Picks) {
    if (isOwnPick(pick)) ownYears.add(pick.year);
  }
  for (let y = 2025; y <= 2031; y++) {
    if (ownYears.has(y)) continue;
    if (ownYears.has(y - 1)) blocked.add(y - 1);
    if (ownYears.has(y + 1)) blocked.add(y + 1);
  }
  return blocked;
}
