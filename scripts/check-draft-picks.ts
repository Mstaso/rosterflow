/** Self-check for the draft-pick loader. No network, no database. Part of `pnpm check:picks`. */
import assert from "node:assert/strict";
import { loadDraftPicks, pickValue, type DraftPickFile, type ScrapedPick } from "../src/lib/draft-picks";
import { pickUntradableReason } from "../src/lib/trade-legality";

const NOW = new Date("2026-10-14T00:00:00Z"); // next draft 2027
const base = { year: 2027, round: 1, isProtected: false, conditional: false };

// Value ordering: bad team > good team, R1 > R2, near > far for a bad team,
// protected and conditional cost value, everything in 1-100.
const v = (p: Partial<typeof base>, win: number[]) => pickValue({ ...base, ...p }, win, 2027);
assert.ok(v({}, [0.25]) > v({}, [0.7]));
assert.ok(v({}, [0.5]) > v({ round: 2 }, [0.25]));
assert.ok(v({}, [0.25]) > v({ year: 2031 }, [0.25]));
assert.ok(v({ isProtected: true }, [0.3]) < v({}, [0.3]));
assert.ok(v({ conditional: true }, [0.3]) < v({}, [0.3]));
for (const w of [0, 0.5, 1]) for (const r of [1, 2]) {
  const x = v({ round: r }, [w]);
  assert.ok(x >= 1 && x <= 100);
}

// Scraper labels for conditional picks keep them away from the model.
assert.ok(pickUntradableReason({ year: 2028, round: 1, description: "Own · only if 1-5 (else to CHA)" } as any, { draftPicks: [] } as any, NOW));
assert.ok(pickUntradableReason({ year: 2028, round: 1, description: "From DEN · protected 1-5 · conditional" } as any, { draftPicks: [] } as any, NOW));
assert.equal(pickUntradableReason({ year: 2028, round: 1, description: "From SAS · protected 17-30" } as any, { draftPicks: [] } as any, NOW), null);

// Loader: sequence per slot, stale rows unlinked from trades then deleted,
// ESPN abbreviations resolved, incomplete files refused.
const teams = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  displayName: i === 0 ? "Golden State Warriors" : `Team ${i}`,
  abbreviation: i === 0 ? "GS" : `T${i}`,
  record: { winPercentage: 0.25 },
}));
const pick = (p: Partial<ScrapedPick>): ScrapedPick => ({
  year: 2027, round: 1, originalTeams: ["GSW"], description: "Own",
  isProtected: false, isSwap: false, conditional: false, reconciled: true, ...p,
});
const file = (perTeam: number): DraftPickFile => ({
  source: "test", scrapedAt: "2026-10-14", mismatches: [],
  teams: Object.fromEntries(teams.map((t) => [t.displayName, Array.from({ length: perTeam }, (_, k) => pick({ year: 2027 + k }))])),
});

const committed: any[] = [];
const op = (model: string, action: string) => (args: any) => ({ model, action, args });
const prisma: any = {
  team: { findMany: async () => teams },
  draftPick: {
    findMany: async ({ where }: any) =>
      where.teamId === 1 ? [{ id: 900, year: 2026, round: 1, sequence: 0 }, { id: 901, year: 2027, round: 1, sequence: 0 }] : [],
    upsert: op("draftPick", "upsert"),
    deleteMany: op("draftPick", "deleteMany"),
  },
  tradeAsset: { updateMany: op("tradeAsset", "updateMany") },
  $transaction: async (ops: any[]) => { committed.push(...ops); },
};

(async () => {
  const data = file(8);
  data.teams["Golden State Warriors"] = [pick({}), pick({ originalTeams: ["SAS"] }), pick({ round: 2 }), ...data.teams["Golden State Warriors"]!.slice(3)];
  const result = await loadDraftPicks(prisma, data, NOW);
  assert.equal(result.removed, 1); // 2026 R1 (id 900) is gone, 2027 R1 seq 0 is kept
  const gsw = committed.filter((o) => o.args.where?.teamId_year_round_sequence?.teamId === 1 || o.args.where?.id || o.args.where?.draftPickId);
  assert.deepEqual(gsw[0].args, { where: { draftPickId: { in: [900] } }, data: { draftPickId: null } });
  assert.deepEqual(gsw[1].args.where, { id: { in: [900] } });
  const seqs = gsw.filter((o) => o.action === "upsert").slice(0, 3).map((o) => o.args.where.teamId_year_round_sequence);
  assert.deepEqual(seqs.map((s: any) => [s.year, s.round, s.sequence]), [[2027, 1, 0], [2027, 1, 1], [2027, 2, 0]]);
  // GSW's own pick valued from GS's record (0.25), so well above an average team's.
  assert.ok(gsw.find((o) => o.action === "upsert").args.update.estimatedValue > pickValue(base, [0.5], 2027));

  await assert.rejects(loadDraftPicks(prisma, file(2), NOW)); // 60 picks: broken scrape
  console.log("check-draft-picks: all checks passed");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
