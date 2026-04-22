/**
 * Team role classifier for trade generation.
 *
 * Before the Claude prompt is built, each team in the trade is assigned a
 * role that reflects its function in the deal:
 *
 *   PRINCIPAL_SELLER   — team shipping out the headliner asset(s)
 *   PRINCIPAL_BUYER    — team acquiring the headliner (explicit destination
 *                        or inferred for obvious contender/rebuilder matchups)
 *   SECONDARY          — team with selected assets but not the headliner
 *   FACILITATOR        — team with no selected assets; absorbs salary or
 *                        provides a pick in exchange for cap relief
 *
 * The role drives per-team guidance that's injected into the prompt, so
 * the AI stops doing things like routing a star player to a facilitator
 * team or dropping facilitators from multi-team trades.
 */

import type { DraftPick, Player, SelectedAsset, Team } from "~/types";
import { computePlayerRating } from "~/lib/server-utils";

export type TeamRole =
  | "PRINCIPAL_SELLER"
  | "PRINCIPAL_BUYER"
  | "SECONDARY"
  | "SWAP_PARTNER"
  | "FACILITATOR";

export interface TeamRoleInfo {
  teamId: number;
  teamName: string;
  role: TeamRole;
  /** Short human reason — for logs + prompt context. */
  reason: string;
  /** Prompt-ready directive sentence injected into the TEAM ROLES section. */
  guidance: string;
}

/**
 * Threshold at which an asset is a "headliner" vs just a depth piece.
 * Rating 75 matches the star-rebuilder archetype's lower bound; below that
 * we consider the trade a role-player swap rather than a star-driven deal.
 */
const HEADLINER_RATING = 75;
const HEADLINER_PICK_VAL = 75;

/** Facilitators must not receive a player above this rating. */
export const FACILITATOR_MAX_INCOMING_RATING = 78;

/** Rough contender / rebuilder classification — mirrors prompt outlook. */
function teamWinPct(team: Team): number {
  const r: any = (team as any).record;
  if (!r) return 0.5;
  if (typeof r === "string") {
    const [w, l] = r.split("-").map(Number);
    return (w ?? 0) / Math.max(1, (w ?? 0) + (l ?? 0));
  }
  if (typeof r.winPercentage === "number") return r.winPercentage;
  const w = r.wins ?? 0;
  const l = r.losses ?? 0;
  return w / Math.max(1, w + l);
}
const isContender = (t: Team) => teamWinPct(t) >= 0.6;
const isRebuilding = (t: Team) => teamWinPct(t) < 0.4;

interface AssetValue {
  asset: SelectedAsset;
  value: number;
  isPlayer: boolean;
  name: string;
}

/** Compute a single numeric value for a selected asset, used for headliner detection. */
function valueOfAsset(
  asset: SelectedAsset,
  involvedTeams: Team[]
): AssetValue | null {
  const team = involvedTeams.find((t) => t.id === asset.teamId);
  if (!team) return null;
  if (asset.type === "player") {
    const player = (team.players ?? []).find((p) => p.id === asset.id);
    if (!player) return null;
    const { rating } = computePlayerRating(player as Player);
    return { asset, value: rating, isPlayer: true, name: player.fullName };
  }
  const pick = (team.draftPicks ?? []).find((p) => p.id === asset.id) as
    | DraftPick
    | undefined;
  if (!pick) return null;
  return {
    asset,
    value: pick.estimatedValue ?? 0,
    isPlayer: false,
    name: `${pick.year} R${pick.round}`,
  };
}

/**
 * Main classifier. Returns one TeamRoleInfo per team in `involvedTeams`, in
 * the same order as the input array.
 *
 * @param additionalTeamIds Team IDs that were added as "extra" trade
 *   partners (no selected assets from the user). Only these become
 *   FACILITATOR — primary teams without assets are SWAP_PARTNER instead,
 *   which carries no "can't receive rating 78+" restriction.
 */
export function classifyTeamRoles(
  selectedAssets: SelectedAsset[],
  involvedTeams: Team[],
  additionalTeamIds: Set<number> = new Set()
): TeamRoleInfo[] {
  // --- Step 1: gather all asset values + find the headliner ---
  const assetValues = selectedAssets
    .map((a) => valueOfAsset(a, involvedTeams))
    .filter((v): v is AssetValue => v !== null);

  // Headliner = max-valued asset, but only if it clears the star threshold.
  // Below the threshold, no one's "PRINCIPAL" in the star-trade sense —
  // we fall through to SECONDARY-only roles for asset holders.
  assetValues.sort((a, b) => b.value - a.value || a.asset.id - b.asset.id);
  const top = assetValues[0];
  const hasHeadliner =
    !!top &&
    ((top.isPlayer && top.value >= HEADLINER_RATING) ||
      (!top.isPlayer && top.value >= HEADLINER_PICK_VAL));

  // Teams that are shipping out *any* headliner-grade asset = principal sellers.
  const principalSellerIds = new Set<number>();
  if (hasHeadliner) {
    for (const v of assetValues) {
      const isStar =
        (v.isPlayer && v.value >= HEADLINER_RATING) ||
        (!v.isPlayer && v.value >= HEADLINER_PICK_VAL);
      if (isStar) principalSellerIds.add(v.asset.teamId);
    }
  }

  // --- Step 2: figure out which teams have ANY selected assets ---
  const teamsWithAssets = new Set<number>();
  for (const a of selectedAssets) teamsWithAssets.add(a.teamId);

  // --- Step 3: principal-buyer detection ---
  //
  // Priority 1: user-provided destination (targetTeamId on the headliner).
  // Priority 2: single contender in the trade when seller is a rebuilder.
  // Otherwise: unknown — leave everyone else as SECONDARY/FACILITATOR.
  let principalBuyerId: number | null = null;
  if (hasHeadliner && top) {
    if (top.asset.targetTeamId) {
      principalBuyerId = top.asset.targetTeamId;
    } else {
      const seller = involvedTeams.find((t) => principalSellerIds.has(t.id));
      const contendersInTrade = involvedTeams.filter(
        (t) =>
          isContender(t) &&
          !principalSellerIds.has(t.id) &&
          !teamsWithAssets.has(t.id) === false // allow contenders with no assets too
      );
      // More robust: contenders that aren't the seller
      const buyers = involvedTeams.filter(
        (t) => isContender(t) && !principalSellerIds.has(t.id)
      );
      if (seller && isRebuilding(seller) && buyers.length === 1) {
        principalBuyerId = buyers[0]!.id;
      }
      // Mark unused variable lint-clean
      void contendersInTrade;
    }
  }

  // --- Step 4: build per-team info ---
  return involvedTeams.map((team) => {
    const teamName = (team as any).displayName ?? team.name ?? `Team ${team.id}`;
    const hasAssets = teamsWithAssets.has(team.id);
    const isSeller = principalSellerIds.has(team.id);
    const isBuyer = team.id === principalBuyerId;

    if (isSeller) {
      return {
        teamId: team.id,
        teamName,
        role: "PRINCIPAL_SELLER",
        reason: "ships headliner asset(s)",
        guidance: `${teamName} is the PRINCIPAL SELLER. They are moving their headliner — expect their return to be weighted toward future draft capital, players age 25 or younger, or "elite value"/"good value" contracts. Do NOT send them aging veterans on long-term deals or overpaid contracts.`,
      };
    }
    if (isBuyer) {
      return {
        teamId: team.id,
        teamName,
        role: "PRINCIPAL_BUYER",
        reason: "acquires headliner",
        guidance: `${teamName} is the PRINCIPAL BUYER. They are acquiring the headliner and should pay a premium — picks, young rotation players, and taking on longer contracts is acceptable. They typically will not give up their own top star in return.`,
      };
    }
    if (hasAssets) {
      return {
        teamId: team.id,
        teamName,
        role: "SECONDARY",
        reason: "has selected assets, not headliner",
        guidance: `${teamName} is a SECONDARY participant. They have selected assets in the deal but are not the principal seller/buyer. Their incoming value should be roughly proportional to what they give up.`,
      };
    }
    // No selected assets. If they're an "additional team" the user added,
    // they're a FACILITATOR (hard restriction on incoming talent). Otherwise
    // they're a primary trade partner expected to send comparable value back
    // — SWAP_PARTNER with no talent restriction.
    if (additionalTeamIds.has(team.id)) {
      return {
        teamId: team.id,
        teamName,
        role: "FACILITATOR",
        reason: "added team, no selected assets",
        guidance: `${teamName} is a FACILITATOR. They are available to absorb salary or provide a minor asset (second-round pick, end-of-bench player, expiring contract) ONLY if they make the deal better. Include them only when they unlock salary matching or provide a needed piece — otherwise omit them. If included, they MUST NOT receive any player rated ${FACILITATOR_MAX_INCOMING_RATING}+ — their role is cap relief, not acquiring talent.`,
      };
    }
    return {
      teamId: team.id,
      teamName,
      role: "SWAP_PARTNER",
      reason: "primary team, no selected assets",
      guidance: `${teamName} is a SWAP PARTNER. They are a primary trade partner but the user didn't pre-select their outgoing assets — treat them as a full counterparty. Send back a realistic package of comparable value (players, picks, or a mix). They can receive any caliber of player, including stars, if the return justifies it.`,
    };
  });
}

/**
 * Format role info into the prompt-ready "TEAM ROLES" block.
 */
export function formatRolesContext(roles: TeamRoleInfo[]): string {
  const lines = roles.map(
    (r) => `- ${r.teamName}: ${r.role} — ${r.guidance.replace(/^[^—]+— /, "")}`
  );
  return `TEAM ROLES (respect these when allocating assets):\n${lines.join("\n")}`;
}
