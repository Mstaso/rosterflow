"use client";

import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { TradeWarning } from "~/lib/trade-warnings";

interface TradeMastheadProps {
  /** Small uppercase label (e.g. "SCENARIO 02 / 05", "YOUR PROPOSAL"). */
  eyebrow: string;
  /** Editorial one-liner derived from cap math via `computeSubdeck`. */
  subdeck: string;
  /** All warnings to surface — empty means valid, non-empty means at least
   *  one issue, possibly multiple. Blockers and soft warnings render together. */
  warnings: TradeWarning[];
}

/**
 * The editorial header that sits at the top of every trade result view —
 * inside the capture area so it ends up in shared screenshots. Three layers:
 *
 *   1. Eyebrow (font-supermolot wordmark-style tag)
 *   2. Subdeck (deterministic one-liner from cap math)
 *   3. Verdict banner (single tinted block; teal for clean, copper for issues,
 *      with bulleted reasons when warnings are present)
 *
 * The verdict is intentionally a single block — stacking multiple side-by-side
 * banners reads like a SaaS error console. Stacking issues as bullets inside
 * one banner keeps the page coherent regardless of how many things are wrong.
 */
export function TradeMasthead({
  eyebrow,
  subdeck,
  warnings,
}: TradeMastheadProps) {
  const hasBlockers = warnings.some((w) => w.severity === "blocker");
  const issueCount = warnings.length;

  return (
    <div className="flex flex-col gap-5 mb-6">
      <div className="flex flex-col gap-2">
        <p className="font-supermolot text-[11px] tracking-[0.22em] text-primary">
          {eyebrow}
        </p>
        <p className="text-lg md:text-xl font-semibold text-foreground tracking-tight max-w-2xl">
          {subdeck}
        </p>
      </div>

      {issueCount === 0 ? (
        <ValidVerdict />
      ) : (
        <InvalidVerdict warnings={warnings} blockers={hasBlockers} />
      )}
    </div>
  );
}

function ValidVerdict() {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-primary/10 px-4 py-3 text-primary">
      <CheckCircle2 className="h-5 w-5 shrink-0" strokeWidth={1.75} />
      <p className="text-sm font-medium">
        Cap-legal &mdash; salary, apron, and roster rules satisfied.
      </p>
    </div>
  );
}

function InvalidVerdict({
  warnings,
  blockers,
}: {
  warnings: TradeWarning[];
  blockers: boolean;
}) {
  // Header copy adapts to whether anything is actually blocking — pure soft
  // warnings shouldn't read as "trade has X issues" in alarming language.
  const headerCopy = blockers
    ? warnings.length === 1
      ? "Trade has 1 issue"
      : `Trade has ${warnings.length} issues`
    : warnings.length === 1
      ? "1 thing to note"
      : `${warnings.length} things to note`;

  return (
    <div className="rounded-lg bg-warning/10 px-4 py-3 text-warning">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0" strokeWidth={1.75} />
        <p className="text-sm font-semibold uppercase tracking-wide">
          {headerCopy}
        </p>
      </div>
      <ul className="mt-2 pl-8 space-y-1 text-sm text-warning/90">
        {warnings.map((w, i) => (
          <li key={i} className="list-disc list-outside">
            {w.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
