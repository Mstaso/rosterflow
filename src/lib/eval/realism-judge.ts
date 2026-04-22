/**
 * LLM-as-judge for trade realism.
 *
 * The quantitative grader (grader.ts) measures salary validity and raw
 * value balance but cannot tell whether a trade makes basketball sense:
 *   - Does a contender actually get win-now help?
 *   - Does a rebuilder actually get futures / young players?
 *   - Do the player roles fit (e.g. would a team trade their only center
 *     for another center)?
 *   - Do the contract incentives align (rebuild taking on bad money, etc.)?
 *
 * This module calls Anthropic with a compact trade summary and asks for a
 * 1-10 fit score + short reasoning. Used only by the eval harness.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { DraftPick, Player, Team } from "~/types";
import { computePlayerRating, getCapTier } from "~/lib/server-utils";

export const REALISM_JUDGE_MODEL = "claude-haiku-4-5";

export interface RealismScore {
  /** 1-10. 1 = nonsensical, 10 = plausibly real NBA deal. */
  fitScore: number;
  reasoning: string;
  concerns: string[];
  /** True if the judge call failed and the result is a placeholder. */
  errored?: boolean;
}

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .trim();
}

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

function outlookLabel(team: Team): string {
  const pct = teamWinPct(team);
  if (pct >= 0.6) return "contender";
  if (pct >= 0.45) return "play-in";
  if (pct >= 0.35) return "lottery";
  return "rebuilding";
}

function findPlayerOnTeam(team: Team, name: string): Player | null {
  const target = norm(name);
  return (
    ((team.players ?? []) as Player[]).find(
      (p) => norm(p.fullName) === target
    ) ?? null
  );
}

function findPickOnTeam(team: Team, name: string): DraftPick | null {
  const m = name.trim().match(/^(\d{4})\s+R([12])/i);
  if (!m) return null;
  const year = parseInt(m[1]!, 10);
  const round = parseInt(m[2]!, 10);
  return (
    ((team.draftPicks ?? []) as DraftPick[]).find(
      (p) => p.year === year && p.round === round
    ) ?? null
  );
}

function findTeamByName(teams: Team[], name: string): Team | null {
  const target = norm(name);
  return (
    teams.find((t) => {
      const disp = norm((t as any).displayName ?? "");
      const plain = norm(t.name ?? "");
      return disp === target || plain === target;
    }) ?? null
  );
}

function summarizePlayer(p: Player): string {
  const { rating } = computePlayerRating(p);
  const sal = ((p.contract?.salary ?? 0) / 1e6).toFixed(1);
  const yrs = p.contract?.yearsRemaining ?? 0;
  return `${p.fullName} (age ${p.age}, rating ${rating}, $${sal}M × ${yrs}yr)`;
}

function summarizePick(pick: DraftPick): string {
  const v = pick.estimatedValue ? ` val:${pick.estimatedValue}` : "";
  return `${pick.year} R${pick.round}${v}`;
}

function summarizeSide(
  items: { name: string; type: "player" | "pick" }[] | undefined,
  sourceTeams: Team[]
): string {
  if (!items || items.length === 0) return "(nothing)";
  const parts: string[] = [];
  for (const it of items) {
    if (it.type === "pick") {
      for (const t of sourceTeams) {
        const pk = findPickOnTeam(t, it.name);
        if (pk) {
          parts.push(summarizePick(pk));
          break;
        }
      }
    } else {
      for (const t of sourceTeams) {
        const p = findPlayerOnTeam(t, it.name);
        if (p) {
          parts.push(summarizePlayer(p));
          break;
        }
      }
    }
  }
  return parts.length > 0 ? parts.join(", ") : "(nothing resolved)";
}

function buildTradeSummary(trade: any, involvedTeams: Team[]): string {
  const lines: string[] = [];
  for (const tt of trade.teams ?? []) {
    const hydrated = findTeamByName(involvedTeams, tt.teamName);
    if (!hydrated) {
      lines.push(`${tt.teamName}: (team not found)`);
      continue;
    }
    const outlook = outlookLabel(hydrated);
    const tier = getCapTier(hydrated);
    const others = involvedTeams.filter((t) => t.id !== hydrated.id);

    lines.push(`${tt.teamName} [${outlook}, ${tier}]`);
    lines.push(`  GIVES: ${summarizeSide(tt.gives?.players?.map((p: any) => ({ name: p.name, type: "player" })).concat(tt.gives?.picks?.map((p: any) => ({ name: p.name, type: "pick" })) ?? []) ?? [], [hydrated])}`);
    lines.push(`  RECEIVES: ${summarizeSide(tt.receives?.players?.map((p: any) => ({ name: p.name, type: "player" })).concat(tt.receives?.picks?.map((p: any) => ({ name: p.name, type: "pick" })) ?? []) ?? [], others)}`);
  }
  return lines.join("\n");
}

const JUDGE_SYSTEM =
  "You are a veteran NBA front-office evaluator. You score trade realism on a 1-10 scale based on whether a real GM would consider the deal. You weigh team context (contender vs rebuilder), player fit and role, contract incentives, and asset balance. Respond with valid JSON only.";

const RUBRIC = `SCORING RUBRIC (1-10):
- 9-10: Plausibly real NBA trade — both sides clearly advance their goals, fits team windows, contract incentives align.
- 7-8: Reasonable but not obvious — maybe a slight value mismatch or odd role fit, still defensible.
- 5-6: Mixed — one side benefits clearly, the other's motivation is unclear or weak.
- 3-4: Poor fit — contender gets futures they don't need, rebuilder takes on bad money, role redundancy, etc.
- 1-2: Nonsensical — teams trade against their obvious interests; no real GM would consider this.

Common concerns to flag:
- Contender giving up key contributor for picks/young players (win-now violation)
- Rebuilder taking on aging veteran or overpaid contract without pick compensation
- Team trading for a positional duplicate of their star
- Value imbalance without a clear strategic reason
- A team shedding salary but receiving no cap relief or future asset`;

export async function judgeTrade(
  trade: any,
  involvedTeams: Team[],
  anthropic: Anthropic
): Promise<RealismScore> {
  const summary = buildTradeSummary(trade, involvedTeams);

  const prompt = `${RUBRIC}

TRADE TO EVALUATE:
${summary}

Respond with ONLY this JSON:
{"fitScore": <1-10 integer>, "reasoning": "<1-2 sentences>", "concerns": ["<short concern>", ...]}`;

  try {
    const res = await anthropic.messages.create({
      model: REALISM_JUDGE_MODEL,
      system: JUDGE_SYSTEM,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
      temperature: 0.2,
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    let cleaned = text.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(cleaned);
    const score = Number(parsed.fitScore);
    return {
      fitScore: Number.isFinite(score) ? Math.max(1, Math.min(10, score)) : 5,
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
      concerns: Array.isArray(parsed.concerns)
        ? parsed.concerns.filter((c: any) => typeof c === "string")
        : [],
    };
  } catch (err) {
    console.log(
      `[realism-judge] error: ${err instanceof Error ? err.message : String(err)}`
    );
    return {
      fitScore: 5,
      reasoning: "judge error",
      concerns: [],
      errored: true,
    };
  }
}

/**
 * Judge many trades concurrently with a bounded worker pool.
 */
export async function judgeTrades(
  items: { trade: any; involvedTeams: Team[] }[],
  anthropic: Anthropic,
  concurrency = 4
): Promise<RealismScore[]> {
  const results: RealismScore[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      const it = items[idx]!;
      results[idx] = await judgeTrade(it.trade, it.involvedTeams, anthropic);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}
