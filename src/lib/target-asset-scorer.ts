/**
 * Target-asset scorer.
 *
 * Picks plausible trade-partner teams (and starter packages from those teams)
 * for a single offered player. Replaces the random `Math.random()` selection
 * in the client when the user offers only one player and one team.
 *
 * Pure functions: no DB, no LLM, no network. Caller hydrates the candidate
 * team pool via `db.teams.getAllWithRosters()`.
 */

import type { DraftPick, Player, Team } from "~/types";
import {
  computeMatchingBounds,
  computePlayerRating,
  getCapTier,
  getOwnStepienBlockedYears,
  isContender,
  isOwnPick,
  isRebuilding,
  MIN_SALARY_THRESHOLD,
  type CapTier,
} from "~/lib/server-utils";

// ---------- public types ----------

export interface SuggestedPackageAsset {
  type: "player" | "pick";
  id: number;
  name: string;
  // player-only
  salary?: number;
  position?: string;
  age?: number;
  rating?: number;
  // pick-only
  pickYear?: number;
  pickRound?: number;
  pickValue?: number;
}

export interface SuggestedPackage {
  assets: SuggestedPackageAsset[];
  totalSalary: number;
}

export interface FitPartner {
  team: Team;
  packages: SuggestedPackage[];
  /** Aggregate fit score across the team's top assets. For telemetry/debug. */
  fitScore: number;
}

export interface PickFitPartnersOptions {
  topN?: number;
  sampleCount?: number;
  packagesPerTeam?: number;
  /** Deterministic RNG (0..1). Defaults to Math.random. Tests inject. */
  rng?: () => number;
}

// ---------- scoring ----------

/**
 * Score a single target asset (player or pick) from the seller's perspective.
 * Returns 0 for hard-rejected assets (Stepien, below salary threshold, etc.).
 */
export function scoreTargetAsset(
  offered: Player,
  target: Player | DraftPick,
  targetTeam: Team,
  sellerTeam: Team,
  unTradablePickKeys: Set<string>
): number {
  const sellerCapTier = getCapTier(sellerTeam);
  const offeredSalary = offered.contract?.salary ?? 0;
  const offeredRating = computePlayerRating(offered).rating;
  const bounds = computeMatchingBounds(offeredSalary, sellerCapTier);

  if ("contract" in target) {
    return scorePlayerTarget(
      target as Player,
      targetTeam,
      sellerTeam,
      offered,
      offeredRating,
      bounds
    );
  }

  return scorePickTarget(
    target as DraftPick,
    targetTeam,
    sellerTeam,
    offered,
    unTradablePickKeys
  );
}

function scorePlayerTarget(
  target: Player,
  targetTeam: Team,
  sellerTeam: Team,
  offered: Player,
  offeredRating: number,
  bounds: { min: number; max: number } | null
): number {
  // Hard filter: same team's own player can't be a target.
  if (target.teamId === offered.teamId) return 0;
  // Hard filter: skip low-salary noise (matches roster-context threshold).
  const salary = target.contract?.salary ?? 0;
  if (salary < MIN_SALARY_THRESHOLD) return 0;

  const targetRating = computePlayerRating(target).rating;

  let score = 0;

  // --- Salary fit (0-40 pts) ---
  if (!bounds) {
    // Seller is UNDER_CAP — no matching required, neutral fit
    score += 25;
  } else {
    if (salary >= bounds.min && salary <= bounds.max) {
      score += 40;
    } else {
      // Distance penalty: how far outside the band, normalized to band width
      const bandWidth = Math.max(1, bounds.max - bounds.min);
      const distance =
        salary < bounds.min ? bounds.min - salary : salary - bounds.max;
      const norm = Math.min(1, distance / bandWidth);
      score += Math.max(0, 40 * (1 - norm * 1.5));
    }
  }

  // --- Rating parity (0-25 pts) — closer to offered = better ---
  const ratingGap = Math.abs(targetRating - offeredRating);
  if (ratingGap <= 3) score += 25;
  else if (ratingGap <= 8) score += 18;
  else if (ratingGap <= 14) score += 10;
  else score += 0;

  // --- Seller orientation (0-20 pts) ---
  if (isRebuilding(sellerTeam)) {
    // Rebuilding seller wants young players + contract value
    if (target.age <= 23) score += 18;
    else if (target.age <= 25) score += 12;
    else if (target.age <= 28) score += 4;
    // bonus if target is a value contract
    const estimatedMarket = targetRating * targetRating * 7000 + 2_000_000;
    if (estimatedMarket / salary > 1.3) score += 5;
  } else if (isContender(sellerTeam)) {
    // Contending seller wants win-now talent + expiring filler
    if (targetRating >= 78) score += 18;
    else if (targetRating >= 72) score += 10;
    // expiring deals are useful even off-rating
    const yearsRemaining = target.contract?.yearsRemaining ?? 0;
    if (yearsRemaining <= 1) score += 6;
  } else {
    // Mid-tier seller — flat bonus for plausibly comparable production
    if (targetRating >= 65) score += 8;
  }

  // --- Position fit (0-10 pts) ---
  const offeredPos = offered.position?.abbreviation ?? "";
  const targetPos = target.position?.abbreviation ?? "";
  if (offeredPos && targetPos) {
    if (offeredPos === targetPos) score += 10;
    else if (positionsAdjacent(offeredPos, targetPos)) score += 6;
    else if (sameSidePosition(offeredPos, targetPos)) score += 3;
  }

  // --- Target-team cap-tier penalty ---
  const targetTier = getCapTier(targetTeam);
  if (targetTier === "SECOND_APRON") score -= 8; // can't aggregate, harder to deal
  else if (targetTier === "FIRST_APRON") score -= 3;

  return Math.max(0, score);
}

function scorePickTarget(
  pick: DraftPick,
  targetTeam: Team,
  sellerTeam: Team,
  offered: Player,
  unTradablePickKeys: Set<string>
): number {
  // Hard filter: Stepien-restricted picks
  const key = `${targetTeam.id}:${pick.year}:${pick.round}`;
  if (unTradablePickKeys.has(key)) return 0;

  // Picks only meaningfully help rebuilding or mid-tier sellers; contending
  // sellers shedding talent for picks is rarer.
  let base = 0;
  const pickValue = pick.estimatedValue ?? 30;

  if (isRebuilding(sellerTeam)) {
    base = pick.round === 1 ? 35 + pickValue * 0.25 : 8;
  } else if (isContender(sellerTeam)) {
    // Contender selling a star for picks is unusual — light score
    base = pick.round === 1 ? 12 + pickValue * 0.1 : 3;
  } else {
    base = pick.round === 1 ? 20 + pickValue * 0.15 : 5;
  }

  // Light bonus for fitting the offered player's value tier (high-value pick
  // for a star, low-value pick for a role player)
  const offeredRating = computePlayerRating(offered).rating;
  if (offeredRating >= 80 && pickValue >= 60) base += 8;
  else if (offeredRating <= 70 && pickValue <= 40) base += 4;

  return Math.max(0, base);
}

// Position adjacency: PG↔SG, SG↔SF, SF↔PF, PF↔C
const POS_ORDER = ["PG", "SG", "SF", "PF", "C"];
function positionsAdjacent(a: string, b: string): boolean {
  const ai = POS_ORDER.indexOf(a);
  const bi = POS_ORDER.indexOf(b);
  if (ai < 0 || bi < 0) return false;
  return Math.abs(ai - bi) === 1;
}
function sameSidePosition(a: string, b: string): boolean {
  const guards = new Set(["PG", "SG"]);
  const wings = new Set(["SG", "SF"]);
  const bigs = new Set(["PF", "C"]);
  return (
    (guards.has(a) && guards.has(b)) ||
    (wings.has(a) && wings.has(b)) ||
    (bigs.has(a) && bigs.has(b))
  );
}

// ---------- partner selection ----------

interface ScoredAsset {
  asset: Player | DraftPick;
  assetType: "player" | "pick";
  team: Team;
  score: number;
}

export function pickFitPartners(
  offered: Player,
  sellerTeam: Team,
  otherTeams: Team[],
  opts: PickFitPartnersOptions = {}
): FitPartner[] {
  const {
    topN = 8,
    sampleCount = 2,
    packagesPerTeam = 2,
    rng = Math.random,
  } = opts;

  // Pre-compute Stepien-restricted picks across all candidate teams so the
  // scorer can hard-filter without re-running the rule per asset.
  const unTradablePickKeys = computeUnTradablePickKeys(otherTeams);

  // 1. Score every asset across every other team.
  const scored: ScoredAsset[] = [];
  for (const team of otherTeams) {
    if (team.id === sellerTeam.id) continue;
    for (const p of team.players ?? []) {
      const score = scoreTargetAsset(
        offered,
        p,
        team,
        sellerTeam,
        unTradablePickKeys
      );
      if (score > 0) {
        scored.push({ asset: p, assetType: "player", team, score });
      }
    }
    for (const pick of team.draftPicks ?? []) {
      const score = scoreTargetAsset(
        offered,
        pick,
        team,
        sellerTeam,
        unTradablePickKeys
      );
      if (score > 0) {
        scored.push({ asset: pick, assetType: "pick", team, score });
      }
    }
  }

  // 2. Aggregate per team — sum top 3 asset scores. Encodes "this team has
  // multiple plausible pieces" without letting one elite player dominate.
  const teamScores = new Map<number, { team: Team; score: number }>();
  const byTeam = new Map<number, ScoredAsset[]>();
  for (const s of scored) {
    const arr = byTeam.get(s.team.id) ?? [];
    arr.push(s);
    byTeam.set(s.team.id, arr);
  }
  for (const [teamId, assets] of byTeam) {
    assets.sort((a, b) => b.score - a.score);
    const top3 = assets.slice(0, 3).reduce((sum, a) => sum + a.score, 0);
    teamScores.set(teamId, { team: assets[0]!.team, score: top3 });
  }

  // 3. Take top-N teams, weighted-sample sampleCount.
  const ranked = [...teamScores.values()].sort((a, b) => b.score - a.score);
  const candidates = ranked.slice(0, topN);
  const sampled = weightedSampleWithoutReplacement(
    candidates,
    Math.min(sampleCount, candidates.length),
    rng
  );

  // 4. Build packages for each selected partner.
  const sellerCapTier = getCapTier(sellerTeam);
  const offeredSalary = offered.contract?.salary ?? 0;
  const bounds = computeMatchingBounds(offeredSalary, sellerCapTier);

  return sampled.map((entry) => {
    const teamAssets = byTeam.get(entry.team.id) ?? [];
    const packages = buildPackages(
      teamAssets,
      bounds,
      sellerTeam,
      packagesPerTeam
    );
    return { team: entry.team, packages, fitScore: entry.score };
  });
}

// ---------- package construction ----------

function buildPackages(
  scoredAssets: ScoredAsset[],
  bounds: { min: number; max: number } | null,
  sellerTeam: Team,
  count: number
): SuggestedPackage[] {
  if (scoredAssets.length === 0) return [];

  const packages: SuggestedPackage[] = [];

  // Package A: greedy from highest-scored, salary-bound-aware
  const a = greedyPackage(scoredAssets, bounds, /* prefer */ "balanced");
  if (a.assets.length > 0) packages.push(a);

  if (count < 2) return packages;

  // Package B: vary the primary asset to give the LLM a real alternative
  const preferPicks = isRebuilding(sellerTeam);
  const b = greedyPackage(
    scoredAssets,
    bounds,
    preferPicks ? "picks-first" : "alternate-primary",
    a
  );
  if (b.assets.length > 0 && !packagesEqual(a, b)) packages.push(b);

  return packages;
}

type PackagePreference = "balanced" | "picks-first" | "alternate-primary";

function greedyPackage(
  scored: ScoredAsset[],
  bounds: { min: number; max: number } | null,
  preference: PackagePreference,
  exclude?: SuggestedPackage
): SuggestedPackage {
  const max = bounds?.max ?? Number.POSITIVE_INFINITY;
  const min = bounds?.min ?? 0;
  const usedIds = new Set<string>();
  if (exclude) {
    for (const a of exclude.assets) usedIds.add(`${a.type}:${a.id}`);
  }

  let pool: ScoredAsset[];
  if (preference === "picks-first") {
    const picks = scored.filter((s) => s.assetType === "pick");
    const players = scored.filter((s) => s.assetType === "player");
    pool = [...picks, ...players];
  } else if (preference === "alternate-primary") {
    // Skip the top-scored asset so we start from a different anchor
    pool = scored.slice(1);
  } else {
    pool = scored;
  }

  const picked: ScoredAsset[] = [];
  let totalSalary = 0;
  const MAX_ASSETS = 3;

  for (const s of pool) {
    if (picked.length >= MAX_ASSETS) break;
    const key = `${s.assetType}:${s.asset.id}`;
    if (usedIds.has(key)) continue;
    const salary =
      s.assetType === "player"
        ? (s.asset as Player).contract?.salary ?? 0
        : 0;
    // Allow exceeding max only if package is still empty (use whole-asset
    // baseline rather than starting empty for unmatchable salaries).
    if (picked.length > 0 && totalSalary + salary > max) continue;
    picked.push(s);
    usedIds.add(key);
    totalSalary += salary;
    // Once we're inside the band, prefer stopping rather than overshooting.
    if (totalSalary >= min && totalSalary <= max) {
      // Keep adding only if a single high-value pick can sweeten without
      // breaking the bound.
      const nextHighPick = pool.find(
        (n) =>
          n.assetType === "pick" &&
          !usedIds.has(`${n.assetType}:${n.asset.id}`)
      );
      if (!nextHighPick || picked.length >= MAX_ASSETS - 1) break;
    }
  }

  return {
    assets: picked.map(scoredAssetToPackageAsset),
    totalSalary,
  };
}

function packagesEqual(a: SuggestedPackage, b: SuggestedPackage): boolean {
  if (a.assets.length !== b.assets.length) return false;
  const keyA = a.assets
    .map((x) => `${x.type}:${x.id}`)
    .sort()
    .join(",");
  const keyB = b.assets
    .map((x) => `${x.type}:${x.id}`)
    .sort()
    .join(",");
  return keyA === keyB;
}

function scoredAssetToPackageAsset(s: ScoredAsset): SuggestedPackageAsset {
  if (s.assetType === "player") {
    const p = s.asset as Player;
    return {
      type: "player",
      id: p.id,
      name: p.fullName,
      salary: p.contract?.salary ?? 0,
      position: p.position?.abbreviation ?? "?",
      age: p.age,
      rating: computePlayerRating(p).rating,
    };
  }
  const pk = s.asset as DraftPick;
  return {
    type: "pick",
    id: pk.id,
    name: `${pk.year} R${pk.round}`,
    pickYear: pk.year,
    pickRound: pk.round,
    pickValue: pk.estimatedValue,
  };
}

// ---------- utilities ----------

function weightedSampleWithoutReplacement<T extends { score: number }>(
  items: T[],
  k: number,
  rng: () => number
): T[] {
  if (k >= items.length) return [...items];
  const pool = [...items];
  const out: T[] = [];
  for (let i = 0; i < k; i++) {
    // Softmax-ish weighting via score^2 for sharper preference toward top fits
    const weights = pool.map((p) => Math.max(0.0001, p.score) ** 2);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    let chosenIdx = pool.length - 1;
    for (let j = 0; j < pool.length; j++) {
      r -= weights[j]!;
      if (r <= 0) {
        chosenIdx = j;
        break;
      }
    }
    out.push(pool[chosenIdx]!);
    pool.splice(chosenIdx, 1);
  }
  return out;
}

function computeUnTradablePickKeys(teams: Team[]): Set<string> {
  // Direct Stepien lookup per team (no string parsing). A pick is un-tradable
  // when it's the team's OWN R1 in a Stepien-blocked year.
  const keys = new Set<string>();
  for (const team of teams) {
    const blocked = getOwnStepienBlockedYears(team);
    if (blocked.size === 0) continue;
    for (const pick of team.draftPicks ?? []) {
      if (pick.round !== 1) continue;
      if (!blocked.has(pick.year)) continue;
      if (!isOwnPick(pick)) continue;
      keys.add(`${team.id}:${pick.year}:1`);
    }
  }
  return keys;
}

// ---------- prompt formatting ----------

/**
 * Render the SUGGESTED TARGET PACKAGES section for the trade prompt.
 * Returns "" if no partners — caller handles the empty case.
 */
export function formatSuggestedPackagesContext(
  partners: FitPartner[]
): string {
  if (partners.length === 0) return "";

  const lines: string[] = [];
  lines.push(
    "SUGGESTED TARGET PACKAGES (starting points identified by salary + role fit analysis — use as a baseline, but feel free to substitute or augment from the rosters shown if you can construct a better deal):"
  );

  for (const p of partners) {
    const teamName = (p.team as any).displayName ?? p.team.name;
    lines.push(`\nFrom ${teamName}:`);
    p.packages.forEach((pkg, idx) => {
      const label = String.fromCharCode(65 + idx); // A, B, ...
      const formatted = pkg.assets
        .map(formatPackageAssetLine)
        .join(" + ");
      lines.push(`  Package ${label}: ${formatted}`);
    });
  }

  return lines.join("\n") + "\n";
}

function formatPackageAssetLine(a: SuggestedPackageAsset): string {
  if (a.type === "player") {
    const salaryM = ((a.salary ?? 0) / 1_000_000).toFixed(1);
    return `${a.name} (${a.position ?? "?"}, $${salaryM}M, age ${a.age ?? "?"}, rating ${a.rating ?? "?"})`;
  }
  const val = a.pickValue ? ` [val:${a.pickValue}]` : "";
  return `${a.name}${val}`;
}
