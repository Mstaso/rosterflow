import type { Player } from "~/types";

export const MIN_SALARY_THRESHOLD = 2_000_000; // Filter out players under $2M

// --- Player Rating System (1-99 scale) ---

export type PlayerTier = "Superstar" | "All-Star" | "Starter" | "Rotation" | "Bench" | "Deep Bench";

export function getTier(rating: number): PlayerTier {
  if (rating >= 85) return "Superstar";
  if (rating >= 72) return "All-Star";
  if (rating >= 58) return "Starter";
  if (rating >= 42) return "Rotation";
  if (rating >= 25) return "Bench";
  return "Deep Bench";
}

export function computePlayerRating(player: Player): { rating: number; tier: PlayerTier } {
  const s = player.statistics;
  if (!s) return { rating: 25, tier: "Bench" };

  // Base production score
  const pointsValue = s.points * 1.0;
  const assistsValue = s.assists * 1.5;
  const reboundsValue = s.rebounds * 1.2;
  const stocksValue = (s.steals + s.blocks) * 2.0;
  const turnoverPenalty = (s.turnovers ?? 0) * -0.8;

  let baseProduction = pointsValue + assistsValue + reboundsValue + stocksValue + turnoverPenalty;

  // Efficiency multiplier using true shooting %
  let efficiencyMultiplier = 1.0;
  const fga = s.fieldGoalAttempts ?? 0;
  const fta = s.freeThrowAttempts ?? 0;
  if (fga + fta > 0) {
    const tsa = fga + 0.44 * fta; // true shooting attempts
    const ts = tsa > 0 ? s.points / (2 * tsa) : 0;
    const leagueAvgTS = 0.575;
    efficiencyMultiplier = Math.max(0.7, Math.min(1.15, 0.85 + (ts - leagueAvgTS) * 2.0));
  }

  // Minutes scaling — low-minute players get docked
  const min = s.minutesPerGame ?? 0;
  if (min > 0 && min < 32) {
    const minutesScale = min < 15 ? 0.8 : 0.8 + ((min - 15) / 17) * 0.2;
    baseProduction *= minutesScale;
  }

  // Games played filter — small sample discount
  const gp = s.gamesPlayed ?? 0;
  if (gp > 0 && gp < 20) {
    baseProduction *= 0.85;
  }

  // Age adjustment — mild tiebreaker, not a cliff
  // Production stats already capture decline naturally
  let ageAdj = 0;
  const age = player.age;
  if (age <= 22) ageAdj = 5;
  else if (age <= 27) ageAdj = 3;
  else if (age <= 30) ageAdj = 0;
  else if (age <= 32) ageAdj = -2;
  else if (age <= 34) ageAdj = -3;
  else ageAdj = -4;

  const raw = baseProduction * efficiencyMultiplier + ageAdj;
  const rating = Math.max(1, Math.min(99, Math.round(raw * 1.8)));
  return { rating, tier: getTier(rating) };
}

// --- Contract Value Tags ---

export type ContractValueTag = "elite value" | "good value" | "fair" | "overpaid" | "negative" | "expiring";

export function computeContractValue(player: Player, rating: number): ContractValueTag {
  const salary = player.contract?.salary ?? 0;
  const yearsRemaining = player.contract?.yearsRemaining ?? 0;

  if (salary <= 0) return "fair";

  // Estimated market value based on rating: rating^2 * 7000 + 2M
  const estimatedMarket = rating * rating * 7000 + 2_000_000;
  const ratio = estimatedMarket / salary;

  // Expiring contracts are valuable regardless of overpay
  if (yearsRemaining <= 1 && ratio < 0.8) return "expiring";

  if (ratio > 2.0) return "elite value";
  if (ratio > 1.3) return "good value";
  if (ratio > 0.8) return "fair";
  if (ratio > 0.5) return "overpaid";
  return "negative";
}
