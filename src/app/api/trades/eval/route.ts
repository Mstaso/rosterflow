/**
 * Dev-only trade quality eval endpoint.
 *
 * POST /api/trades/eval
 *   body: { scenarioIds?: string[], label?: string }
 *
 * Dynamically builds realistic scenarios from the live DB (see
 * src/lib/eval/scenarios.ts), runs each through the real trade generator,
 * grades each output with src/lib/eval/grader.ts, and writes a JSON file
 * to ./eval-results/.
 *
 * Response body: small summary + file path (not the full payload).
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { promises as fs } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { env } from "~/env";
import { generateTradesCore } from "~/lib/trade-generator";
import { buildAllScenarios } from "~/lib/eval/scenarios";
import {
  gradeTrade,
  summarizeScenario,
  summarizeRun,
  type TradeGrade,
  type ScenarioSummary,
} from "~/lib/eval/grader";
import { judgeTrades, type RealismScore } from "~/lib/eval/realism-judge";

export const dynamic = "force-dynamic";
export const maxDuration = 600; // 10 min — eval can take a while with many variants

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "run"
  );
}

function getGitSha(): string | null {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function timestampSlug(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}`
  );
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  if (!env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { success: false, error: "Anthropic API key not configured" },
      { status: 500 }
    );
  }

  let body: { scenarioIds?: string[]; label?: string } = {};
  try {
    body = await request.json();
  } catch {
    // empty body ok
  }

  const label = body.label ?? "baseline";

  console.log(`[eval] building scenarios from DB...`);
  const scenarios = await buildAllScenarios(body.scenarioIds);

  const runStart = Date.now();
  const skipped: { scenarioId: string; reason: string }[] = [];
  const scenarioBuckets: {
    scenarioId: string;
    label: string;
    category: string;
    grades: TradeGrade[];
    trades: Array<{ source: "manual" | "ai"; trade: any }>;
    involvedTeams: any[];
    realismScores?: RealismScore[];
    summary?: ScenarioSummary;
  }[] = [];

  // Sequential to avoid Anthropic rate limits and keep logs readable
  for (const scenario of scenarios) {
    if ("skipped" in scenario) {
      console.log(`[eval] SKIP ${scenario.scenarioId}: ${scenario.reason}`);
      skipped.push({
        scenarioId: scenario.scenarioId,
        reason: scenario.reason,
      });
      continue;
    }

    console.log(`[eval] running ${scenario.scenarioId}: ${scenario.label}`);

    let generated;
    try {
      generated = await generateTradesCore(
        {
          selectedAssets: scenario.selectedAssets,
          teams: scenario.teams,
          additionalTeams: scenario.additionalTeams,
        },
        anthropic
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[eval] FAIL ${scenario.scenarioId}: ${msg}`);
      skipped.push({
        scenarioId: scenario.scenarioId,
        reason: `generation error: ${msg}`,
      });
      continue;
    }

    const { manualTrade, aiTrades, involvedTeams } = generated;

    const grades: TradeGrade[] = [];
    const trades: Array<{ source: "manual" | "ai"; trade: any }> = [];

    if (manualTrade) {
      grades.push(gradeTrade(manualTrade, involvedTeams, "manual"));
      trades.push({ source: "manual", trade: manualTrade });
    }
    for (const t of aiTrades) {
      grades.push(gradeTrade(t, involvedTeams, "ai"));
      trades.push({ source: "ai", trade: t });
    }

    const summary = summarizeScenario(
      scenario.scenarioId,
      scenario.category,
      grades
    );
    scenarioBuckets.push({
      scenarioId: scenario.scenarioId,
      label: scenario.label,
      category: scenario.category,
      grades,
      trades,
      involvedTeams,
      summary,
    });

    console.log(
      `[eval] ${scenario.scenarioId}: ${grades.length} trades, ` +
        `${summary.salaryValidCount}/${grades.length} salary-valid, ` +
        `avg |valueΔ|=${summary.avgAbsValueDelta.toFixed(1)}`
    );
  }

  // Realism judge pass — LLM scores each trade on fit/narrative. Runs after
  // all generation completes so we can parallelize across scenarios.
  console.log(`[eval] running realism judge...`);
  const judgeStart = Date.now();
  const judgeQueue: { bucketIdx: number; tradeIdx: number; trade: any; involvedTeams: any[] }[] = [];
  for (let bi = 0; bi < scenarioBuckets.length; bi++) {
    const b = scenarioBuckets[bi]!;
    b.realismScores = new Array(b.trades.length);
    for (let ti = 0; ti < b.trades.length; ti++) {
      judgeQueue.push({
        bucketIdx: bi,
        tradeIdx: ti,
        trade: b.trades[ti]!.trade,
        involvedTeams: b.involvedTeams,
      });
    }
  }

  const scores = await judgeTrades(
    judgeQueue.map((q) => ({ trade: q.trade, involvedTeams: q.involvedTeams })),
    anthropic,
    4
  );
  for (let i = 0; i < judgeQueue.length; i++) {
    const q = judgeQueue[i]!;
    scenarioBuckets[q.bucketIdx]!.realismScores![q.tradeIdx] = scores[i]!;
  }
  console.log(
    `[eval] judge done in ${((Date.now() - judgeStart) / 1000).toFixed(1)}s`
  );

  const runSummary = summarizeRun(
    scenarioBuckets.map((b) => ({
      summary: b.summary!,
      grades: b.grades,
    }))
  );

  // Aggregate realism scores by source
  const allScored: { source: "manual" | "ai"; score: RealismScore }[] = [];
  for (const b of scenarioBuckets) {
    b.trades.forEach((t, i) => {
      const s = b.realismScores?.[i];
      if (s) allScored.push({ source: t.source, score: s });
    });
  }
  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const pctAbove = (arr: number[], thresh: number) =>
    arr.length ? arr.filter((v) => v >= thresh).length / arr.length : 0;

  const realismSummary = {
    overall: {
      avg: avg(allScored.map((s) => s.score.fitScore)),
      pctHighFit: pctAbove(allScored.map((s) => s.score.fitScore), 7),
      pctLowFit: allScored.length
        ? allScored.filter((s) => s.score.fitScore <= 4).length /
          allScored.length
        : 0,
    },
    manual: {
      avg: avg(
        allScored.filter((s) => s.source === "manual").map((s) => s.score.fitScore)
      ),
    },
    ai: {
      avg: avg(
        allScored.filter((s) => s.source === "ai").map((s) => s.score.fitScore)
      ),
      pctHighFit: pctAbove(
        allScored.filter((s) => s.source === "ai").map((s) => s.score.fitScore),
        7
      ),
      pctLowFit: (() => {
        const ai = allScored.filter((s) => s.source === "ai");
        return ai.length
          ? ai.filter((s) => s.score.fitScore <= 4).length / ai.length
          : 0;
      })(),
    },
  };

  const now = new Date();
  const gitSha = getGitSha();
  const fileName = `${timestampSlug(now)}-${slug(label)}.json`;
  const dir = path.resolve(process.cwd(), "eval-results");
  const filePath = path.join(dir, fileName);

  const payload = {
    timestamp: now.toISOString(),
    durationMs: Date.now() - runStart,
    gitSha,
    label,
    scenarioCount: scenarioBuckets.length,
    skipped,
    scenarios: scenarioBuckets.map((b) => ({
      scenarioId: b.scenarioId,
      label: b.label,
      category: b.category,
      summary: b.summary,
      trades: b.trades.map((t, i) => ({
        source: t.source,
        trade: t.trade,
        grade: b.grades[i],
        realism: b.realismScores?.[i],
      })),
    })),
    runSummary,
    realismSummary,
  };

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`[eval] wrote ${filePath}`);

  return NextResponse.json({
    success: true,
    filePath,
    scenarioCount: scenarioBuckets.length,
    skipped,
    runSummary,
    realismSummary,
  });
}
