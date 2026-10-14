/**
 * Load prisma/seeddata/draft_picks.json (written by scrapers/realgm_draft_picks.py)
 * into DraftPick without touching saved trades.
 *
 * Shared by `pnpm db:load-picks` and `prisma/seed.ts`. Kept free of `~/`
 * imports so the seed can import it directly.
 */

import type { PrismaClient } from "@prisma/client";
import { nextDraftYear } from "./trade-legality";

export interface ScrapedPick {
  year: number;
  round: number;
  /** Standard abbreviations (GSW, NYK, …) of the team(s) whose pick this is. */
  originalTeams: string[];
  description: string;
  isProtected: boolean;
  isSwap: boolean;
  conditional: boolean;
  /** False when RealGM's own count for this slot disagreed with the parse. */
  reconciled: boolean;
}

export interface DraftPickFile {
  source: string;
  scrapedAt: string;
  /** Keyed by Team.displayName. */
  teams: Record<string, ScrapedPick[]>;
  mismatches: string[];
}

/** The scraper uses standard abbreviations; our Team rows use ESPN's. */
const ESPN_ABBR: Record<string, string> = {
  GSW: "GS",
  NYK: "NY",
  NOP: "NO",
  SAS: "SA",
  UTA: "UTAH",
  WAS: "WSH",
};

const MIN_PICKS = 200; // a full league is ~400; fewer means a broken scrape

/**
 * 1-100 estimate used by the fit scorer and shown to the model.
 * ponytail: hand-tuned heuristic, not a draft model. Swap for a lottery-odds
 * table if pick valuation starts to matter more.
 */
export function pickValue(
  pick: Pick<ScrapedPick, "year" | "round" | "isProtected" | "conditional">,
  originalWinPcts: number[],
  nextDraft: number
): number {
  const win = originalWinPcts.length
    ? originalWinPcts.reduce((a, b) => a + b, 0) / originalWinPcts.length
    : 0.5;
  const yearsOut = Math.max(0, pick.year - nextDraft);
  // A record says less about a draft years away: regress toward average.
  const weakness = 0.5 + (0.5 - win) * Math.max(0, 1 - 0.25 * yearsOut);
  let value = pick.round === 1 ? 30 + 60 * weakness : 8 + 17 * weakness;
  value *= 1 - 0.03 * yearsOut;
  if (pick.isProtected) value *= 0.85;
  if (pick.conditional) value *= 0.5;
  return Math.max(1, Math.min(100, Math.round(value)));
}

function winPct(record: unknown): number | null {
  const r = record as { winPercentage?: number; wins?: number; losses?: number } | null;
  if (typeof r?.winPercentage === "number") return r.winPercentage;
  if (r && typeof r.wins === "number" && typeof r.losses === "number" && r.wins + r.losses > 0) {
    return r.wins / (r.wins + r.losses);
  }
  return null;
}

export async function loadDraftPicks(
  prisma: PrismaClient,
  data: DraftPickFile,
  now: Date = new Date()
): Promise<{ teams: number; picks: number; removed: number; mismatches: number }> {
  const total = Object.values(data.teams).reduce((a, picks) => a + picks.length, 0);
  if (Object.keys(data.teams).length !== 30 || total < MIN_PICKS) {
    throw new Error(
      `draft_picks.json looks incomplete (${Object.keys(data.teams).length} teams, ${total} picks) — not loading`
    );
  }

  const teams = await prisma.team.findMany({
    select: { id: true, displayName: true, abbreviation: true, record: true },
  });
  const byName = new Map(teams.map((t) => [t.displayName, t]));
  const winByAbbr = new Map(teams.map((t) => [t.abbreviation, winPct(t.record)]));
  const missing = Object.keys(data.teams).filter((name) => !byName.has(name));
  if (missing.length) throw new Error(`Unknown teams in draft_picks.json: ${missing.join(", ")}`);

  const nextDraft = nextDraftYear(now);
  let removed = 0;
  for (const [name, picks] of Object.entries(data.teams)) {
    const team = byName.get(name)!;
    const sequence = new Map<string, number>();
    const rows = picks.map((p) => {
      const slot = `${p.year}-${p.round}`;
      const seq = sequence.get(slot) ?? 0;
      sequence.set(slot, seq + 1);
      const wins = p.originalTeams
        .map((abbr) => winByAbbr.get(ESPN_ABBR[abbr] ?? abbr))
        .filter((w): w is number => typeof w === "number");
      return {
        year: p.year,
        round: p.round,
        sequence: seq,
        description: p.description,
        isProtected: p.isProtected,
        isSwap: p.isSwap,
        estimatedValue: pickValue(p, wins, nextDraft),
      };
    });

    const keep = new Set(rows.map((r) => `${r.year}-${r.round}-${r.sequence}`));
    const stale = (
      await prisma.draftPick.findMany({
        where: { teamId: team.id },
        select: { id: true, year: true, round: true, sequence: true },
      })
    )
      .filter((p) => !keep.has(`${p.year}-${p.round}-${p.sequence}`))
      .map((p) => p.id);

    // One transaction per team. Saved trades keep their own snapshot of each
    // pick; only the live link to a removed row is cleared.
    await prisma.$transaction([
      prisma.tradeAsset.updateMany({
        where: { draftPickId: { in: stale } },
        data: { draftPickId: null },
      }),
      prisma.draftPick.deleteMany({ where: { id: { in: stale } } }),
      ...rows.map((row) =>
        prisma.draftPick.upsert({
          where: {
            teamId_year_round_sequence: {
              teamId: team.id,
              year: row.year,
              round: row.round,
              sequence: row.sequence,
            },
          },
          update: row,
          create: { ...row, teamId: team.id },
        })
      ),
    ]);
    removed += stale.length;
  }

  return { teams: Object.keys(data.teams).length, picks: total, removed, mismatches: data.mismatches.length };
}
