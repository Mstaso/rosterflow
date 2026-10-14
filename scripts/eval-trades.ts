/**
 * Fixed trade-accuracy eval: 22 trade requests, each run through the real
 * generator, each resulting trade checked for legality by
 * src/lib/trade-legality.ts and scored for fit by the realism judge.
 *
 *   pnpm eval:trades <label>            # writes eval-results/<date>-<label>.json
 *
 * Needs DATABASE_URL and ANTHROPIC_API_KEY. Run it twice per code state:
 * generation is sampled at temperature 0.7, so one run is not a measurement.
 */
import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import type { SelectedAsset, Team } from "~/types";
import { buildAllScenarios } from "~/lib/eval/scenarios";
import { judgeTrades } from "~/lib/eval/realism-judge";
import { generateTradesCore } from "~/lib/trade-generator";
import { checkTradeLegality } from "~/lib/trade-legality";
import { db } from "~/lib/db";

/** Multi-asset / multi-team requests, built by the existing archetype builders. */
const ARCHETYPE_IDS = [
  "star-rebuilder-to-contender", "star-rebuilder-to-contender-r1",
  "two-star-swap", "contender-shops-veteran", "role-swap-midtier", "young-swap",
  "pick-driven", "rebuilder-buys-young", "salary-dump", "second-apron-dump",
  "expiring-for-future", "deadline-rental", "3team-star-facilitator",
  "3team-pick-driven-r1", "4team-star-two-facilitators", "5team-mega",
];
/**
 * The most common real request: one player, no partner chosen. The route
 * picks partners with the fit scorer. Highest-paid player on each team.
 */
const SINGLE_PLAYER_TEAMS = ["ATL", "CHI", "SAC", "UTAH", "PHX", "MIL"];

const CONCURRENCY = 4;

interface Request {
  id: string;
  selectedAssets: SelectedAsset[];
  teams: Team[];
  additionalTeams: Team[] | null;
}

async function buildRequests(): Promise<{ requests: Request[]; skipped: string[] }> {
  const requests: Request[] = [];
  const skipped: string[] = [];
  for (const s of await buildAllScenarios(ARCHETYPE_IDS)) {
    if (!ARCHETYPE_IDS.includes(s.scenarioId)) continue; // bare ids match every rank
    if ("skipped" in s) skipped.push(`${s.scenarioId}: ${s.reason}`);
    else requests.push({ id: s.scenarioId, selectedAssets: s.selectedAssets, teams: s.teams, additionalTeams: s.additionalTeams });
  }
  const all = (await db.teams.getAllWithRosters()) as unknown as Team[];
  for (const abbr of SINGLE_PLAYER_TEAMS) {
    const team = all.find((t) => t.abbreviation === abbr);
    const star = [...(team?.players ?? [])].sort(
      (a, b) => (b.contract?.salary ?? 0) - (a.contract?.salary ?? 0)
    )[0];
    if (!team || !star) {
      skipped.push(`single-${abbr}: team or player missing`);
      continue;
    }
    requests.push({
      id: `single-${abbr}`,
      selectedAssets: [{ id: star.id, type: "player", teamId: team.id }],
      teams: [team],
      additionalTeams: null,
    });
  }
  return { requests, skipped };
}

async function runRequest(req: Request, anthropic: Anthropic) {
  // Same entry point as /api/trades/generate (partner selection included).
  const out = await generateTradesCore(
    { selectedAssets: req.selectedAssets, teams: req.teams, additionalTeams: req.additionalTeams },
    anthropic
  );
  const trades = [
    ...(out.manualTrade ? [{ source: "manual" as const, trade: out.manualTrade }] : []),
    ...out.aiTrades.map((trade: any) => ({ source: "ai" as const, trade })),
  ].map((t) => ({
    ...t,
    violations: checkTradeLegality(t.trade, out.involvedTeams, req.selectedAssets).violations,
  }));
  return { id: req.id, involvedTeams: out.involvedTeams, trades, rejected: out.rejected, retried: out.retried };
}

async function main() {
  const label = process.argv[2] ?? "run";
  const anthropic = new Anthropic();
  const { requests, skipped } = await buildRequests();
  console.log(`[eval] ${requests.length} requests (${skipped.length} skipped)`);

  const results: Awaited<ReturnType<typeof runRequest>>[] = [];
  const errors: string[] = [];
  for (let i = 0; i < requests.length; i += CONCURRENCY) {
    await Promise.all(
      requests.slice(i, i + CONCURRENCY).map(async (req) => {
        try {
          const r = await runRequest(req, anthropic);
          results.push(r);
          const ai = r.trades.filter((t) => t.source === "ai");
          console.log(`[eval] ${req.id}: ${ai.filter((t) => t.violations.length === 0).length}/${ai.length} AI trades legal`);
        } catch (e) {
          errors.push(`${req.id}: ${e instanceof Error ? e.message : String(e)}`);
          console.log(`[eval] ${req.id}: ERROR`);
        }
      })
    );
  }

  // Fit ("does each team's direction make sense") — LLM judge, AI trades only.
  const flat = results.flatMap((r) =>
    r.trades.filter((t) => t.source === "ai").map((t) => ({ r, t }))
  );
  const scores = await judgeTrades(
    flat.map(({ r, t }) => ({ trade: t.trade, involvedTeams: r.involvedTeams })),
    anthropic,
    4
  );

  const ai = flat.map(({ r, t }, i) => ({ request: r.id, ...t, fit: scores[i]?.fitScore ?? null }));
  const illegal = ai.filter((t) => t.violations.length > 0);
  const byCode: Record<string, number> = {};
  for (const t of illegal) {
    for (const code of new Set(t.violations.map((v) => v.code))) {
      byCode[code] = (byCode[code] ?? 0) + 1;
    }
  }
  const fits = ai.map((t) => t.fit).filter((f): f is number => f !== null);
  const legalFits = ai.filter((t) => t.violations.length === 0).map((t) => t.fit).filter((f): f is number => f !== null);
  const avg = (xs: number[]) => (xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : null);
  const manual = results.flatMap((r) => r.trades.filter((t) => t.source === "manual"));

  const summary = {
    requests: results.length,
    aiTrades: ai.length,
    aiTradesPerRequest: +(ai.length / Math.max(1, results.length)).toFixed(2),
    /** Shown to the user despite violations (only happens when nothing legal was found). */
    illegalAiTrades: illegal.length,
    illegalPct: +((100 * illegal.length) / Math.max(1, ai.length)).toFixed(1),
    /** Trades with at least one violation of each kind (a trade can appear in several). */
    illegalByCode: Object.fromEntries(Object.entries(byCode).sort((a, b) => b[1] - a[1])),
    requestsWithNoLegalAiTrade: results.filter(
      (r) => !r.trades.some((t) => t.source === "ai" && t.violations.length === 0)
    ).map((r) => r.id),
    requestsUnder3AiTrades: results.filter((r) => r.trades.filter((t) => t.source === "ai").length < 3).map((r) => r.id),
    /** Scenarios the checker refused before display, and how often the model was asked to retry. */
    rejectedBeforeDisplay: results.reduce((a, r) => a + r.rejected.length, 0),
    retriedRequests: results.filter((r) => r.retried).length,
    avgFit: avg(fits),
    avgFitLegalOnly: avg(legalFits),
    lowFitPct: +((100 * fits.filter((f) => f <= 4).length) / Math.max(1, fits.length)).toFixed(1),
    manualTrades: manual.length,
    illegalManualTrades: manual.filter((t) => t.violations.length > 0).length,
    errors,
    skipped,
  };

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  let gitSha = "unknown";
  try {
    gitSha = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {}
  mkdirSync("eval-results", { recursive: true });
  const file = `eval-results/${stamp}-${label}.json`;
  writeFileSync(file, JSON.stringify({ label, timestamp: new Date().toISOString(), gitSha, summary, trades: ai, manual, rejected: results.flatMap((r) => r.rejected.map((x) => ({ request: r.id, ...x }))) }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  console.log(`[eval] wrote ${file}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
