"use client";

import { useMemo, useState } from "react";
import type { Team, TradeInfo } from "~/types";
import {
  computeTradeImpact,
  computeCapProjection,
  computeTradeGrade,
} from "~/lib/trade-analysis";
import type {
  TradeImpactResult,
  CapProjectionResult,
  TradeGradeResult,
  PositionalGroup,
  GradeBreakdownEntry,
} from "~/lib/trade-analysis";
import {
  TrendingUpIcon,
  TrendingDownIcon,
  CalendarIcon,
  AwardIcon,
  ChevronDownIcon,
  StarIcon,
} from "lucide-react";

// ────────────────────────────────────────────────────────────
// Panel Props
// ────────────────────────────────────────────────────────────

interface TradeAnalysisPanelProps {
  tradeInfo: TradeInfo;
  allTradeInfos: TradeInfo[];
  team: Team;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function formatM(value: number): string {
  const m = value / 1_000_000;
  const prefix = m < 0 ? "-" : "";
  return `${prefix}$${Math.abs(m).toFixed(1)}M`;
}

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "text-emerald-400";
  if (grade.startsWith("B")) return "text-sky-400";
  if (grade.startsWith("C")) return "text-amber-400";
  if (grade.startsWith("D")) return "text-orange-400";
  return "text-red-400";
}

function gradeBg(grade: string): string {
  if (grade.startsWith("A")) return "bg-emerald-400/10";
  if (grade.startsWith("B")) return "bg-sky-400/10";
  if (grade.startsWith("C")) return "bg-amber-400/10";
  if (grade.startsWith("D")) return "bg-orange-400/10";
  return "bg-red-400/10";
}

function barColor(grade: string): string {
  if (grade.startsWith("A")) return "bg-emerald-400";
  if (grade.startsWith("B")) return "bg-sky-400";
  if (grade.startsWith("C")) return "bg-amber-400";
  if (grade.startsWith("D")) return "bg-orange-400";
  return "bg-red-400";
}

function capZoneColor(salary: number, cap: number): string {
  const ratio = salary / cap;
  if (ratio <= 1.0) return "bg-emerald-500/80";
  if (ratio <= 1.27) return "bg-amber-500/80"; // over cap
  if (ratio <= 1.35) return "bg-orange-500/80"; // first apron
  return "bg-red-500/80"; // second apron
}

const posGroupLabels: Record<PositionalGroup, string> = {
  guards: "Guards",
  wings: "Wings",
  bigs: "Bigs",
};

const phaseLabels: Record<string, string> = {
  contender: "Contender",
  playoff: "Playoff Team",
  fringe: "Fringe Playoff",
  rebuilding: "Rebuilding",
};

// ────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────

function ImpactTab({ impact }: { impact: TradeImpactResult }) {
  const isPositive = impact.winDelta >= 0;

  return (
    <div className="space-y-4">
      {/* Win Impact — headline number */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isPositive ? (
            <TrendingUpIcon className="w-4 h-4 text-emerald-400" />
          ) : (
            <TrendingDownIcon className="w-4 h-4 text-red-400" />
          )}
          <span className="text-xs text-on-surface-variant">Projected Win Impact</span>
        </div>
        <span
          className={`text-lg font-semibold tabular-nums ${
            isPositive ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {isPositive ? "+" : ""}
          {impact.winDelta.toFixed(1)} wins
        </span>
      </div>

      {/* Team Power bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-on-surface-variant">
          <span>Team Strength</span>
          <span className="tabular-nums">
            {Math.round(impact.teamPowerBefore)} → {Math.round(impact.teamPowerAfter)}
          </span>
        </div>
        <div className="relative h-2 rounded-full bg-surface-container-low overflow-hidden">
          {/* Before bar (dim) */}
          <div
            className="absolute inset-y-0 left-0 bg-on-surface-variant/20 rounded-full"
            style={{ width: `${Math.min(100, (impact.teamPowerBefore / 600) * 100)}%` }}
          />
          {/* After bar (colored) */}
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all ${
              isPositive ? "bg-emerald-500/60" : "bg-red-500/60"
            }`}
            style={{ width: `${Math.min(100, (impact.teamPowerAfter / 600) * 100)}%` }}
          />
        </div>
      </div>

      {/* Positional Impact */}
      <div className="space-y-2">
        <div className="text-xs text-on-surface-variant">Positional Breakdown</div>
        {(["guards", "wings", "bigs"] as PositionalGroup[]).map((group) => {
          const pi = impact.positionalImpact[group];
          const deltaPos = pi.delta >= 0;
          return (
            <div key={group} className="flex items-center gap-3">
              <span className="text-xs text-on-surface-variant w-12">
                {posGroupLabels[group]}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-surface-container-low overflow-hidden relative">
                <div
                  className="absolute inset-y-0 left-0 bg-on-surface-variant/15 rounded-full"
                  style={{ width: `${Math.min(100, (pi.before / 300) * 100)}%` }}
                />
                <div
                  className={`absolute inset-y-0 left-0 rounded-full ${
                    deltaPos ? "bg-emerald-500/50" : "bg-red-500/50"
                  }`}
                  style={{ width: `${Math.min(100, (pi.after / 300) * 100)}%` }}
                />
              </div>
              <span
                className={`text-xs tabular-nums w-10 text-right ${
                  deltaPos ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {deltaPos ? "+" : ""}
                {pi.delta}
              </span>
            </div>
          );
        })}
      </div>

      {/* Roster Flags */}
      {impact.rosterFlags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {impact.rosterFlags.map((flag, i) => (
            <span
              key={i}
              className="text-xs px-2 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant"
            >
              {flag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CapOutlookTab({ projection }: { projection: CapProjectionResult }) {
  return (
    <div className="space-y-3">
      {projection.years.map((yr, i) => {
        const salaryPct = Math.min(
          100,
          (yr.projectedTeamSalary / (yr.projectedCap * 1.4)) * 100
        );
        const capLinePct = (yr.projectedCap / (yr.projectedCap * 1.4)) * 100;

        return (
          <div key={yr.year} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-on-surface">
                  {i === 0 ? "Post-Trade" : `${yr.year}-${(yr.year + 1).toString().slice(-2)}`}
                </span>
                {yr.hasMaxSlot && (
                  <StarIcon className="w-3 h-3 text-amber-400 fill-amber-400" />
                )}
              </div>
              <span
                className={`text-xs tabular-nums ${
                  yr.projectedCapSpace >= 0 ? "text-emerald-400" : "text-on-surface-variant"
                }`}
              >
                {formatM(yr.projectedCapSpace)} space
              </span>
            </div>

            {/* Bar */}
            <div className="relative h-3 rounded-full bg-surface-container-low overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full ${capZoneColor(
                  yr.projectedTeamSalary,
                  yr.projectedCap
                )}`}
                style={{ width: `${salaryPct}%` }}
              />
              {/* Cap line marker */}
              <div
                className="absolute inset-y-0 w-px bg-on-surface/40"
                style={{ left: `${capLinePct}%` }}
              />
            </div>

            {/* Expiring contracts */}
            {yr.expiringPlayers.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 pl-1">
                {yr.expiringPlayers.map((p, j) => (
                  <span key={j} className="text-xs text-on-surface-variant">
                    {p.name}{" "}
                    <span className="text-emerald-400/70">{formatM(p.salary)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div className="text-xs text-on-surface-variant/60 pt-1">
        Projected with ~10% annual cap growth
      </div>
    </div>
  );
}

function GradeTab({ grade }: { grade: TradeGradeResult }) {
  const entries = Object.values(grade.breakdown) as GradeBreakdownEntry[];

  return (
    <div className="space-y-4">
      {/* Grade + Headline */}
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center justify-center w-12 h-12 rounded-xl ${gradeBg(
            grade.grade
          )} ${gradeColor(grade.grade)} text-xl font-bold`}
        >
          {grade.grade}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-on-surface truncate">
            {grade.headline}
          </div>
          <div className="text-xs text-on-surface-variant">
            {phaseLabels[grade.teamPhase]} perspective
          </div>
        </div>
      </div>

      {/* Breakdown bars */}
      <div className="space-y-2">
        {entries.map((entry) => (
          <div key={entry.label} className="flex items-center gap-2">
            <span className="text-xs text-on-surface-variant w-16 shrink-0">
              {entry.label}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-surface-container-low overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  entry.score >= 70
                    ? "bg-emerald-500/60"
                    : entry.score >= 45
                    ? "bg-amber-500/60"
                    : "bg-red-500/60"
                }`}
                style={{ width: `${entry.score}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-on-surface-variant w-6 text-right">
              {entry.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Main Panel
// ────────────────────────────────────────────────────────────

type AnalysisTab = "impact" | "cap" | "grade";

export default function TradeAnalysisPanel({
  tradeInfo,
  allTradeInfos,
  team,
}: TradeAnalysisPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AnalysisTab>("grade");

  const analysis = useMemo(() => {
    const impact = computeTradeImpact(tradeInfo, team);
    const cap = computeCapProjection(tradeInfo, team);
    const grade =
      impact != null
        ? computeTradeGrade(tradeInfo, allTradeInfos, team, impact)
        : null;
    return { impact, cap, grade };
  }, [tradeInfo, allTradeInfos, team]);

  // Don't render if we can't compute anything meaningful
  if (!analysis.impact && !analysis.cap && !analysis.grade) return null;

  const tabs: { id: AnalysisTab; label: string; icon: React.ReactNode; available: boolean }[] = [
    {
      id: "grade",
      label: "Grade",
      icon: <AwardIcon className="w-3.5 h-3.5" />,
      available: analysis.grade != null,
    },
    {
      id: "impact",
      label: "Impact",
      icon: <TrendingUpIcon className="w-3.5 h-3.5" />,
      available: analysis.impact != null,
    },
    {
      id: "cap",
      label: "Cap Outlook",
      icon: <CalendarIcon className="w-3.5 h-3.5" />,
      available: analysis.cap != null,
    },
  ];

  return (
    <div className="mt-4">
      {/* Collapsible trigger — tonal shift, no border per design system */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-surface-container-low hover:bg-surface-variant transition-colors"
      >
        <div className="flex items-center gap-2">
          {analysis.grade && (
            <span
              className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${gradeBg(
                analysis.grade.grade
              )} ${gradeColor(analysis.grade.grade)}`}
            >
              {analysis.grade.grade}
            </span>
          )}
          <span className="text-xs font-medium text-on-surface-variant">
            Trade Analysis
          </span>
          {analysis.impact && (
            <span
              className={`text-xs tabular-nums ${
                analysis.impact.winDelta >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {analysis.impact.winDelta >= 0 ? "+" : ""}
              {analysis.impact.winDelta.toFixed(1)}W
            </span>
          )}
        </div>
        <ChevronDownIcon
          className={`w-4 h-4 text-on-surface-variant transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="mt-2 rounded-xl bg-surface-container-low p-4 space-y-3">
          {/* Tab switcher */}
          <div className="flex gap-1 p-0.5 rounded-lg bg-surface-container">
            {tabs
              .filter((t) => t.available)
              .map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-surface-container-high text-on-surface"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
          </div>

          {/* Tab content */}
          <div className="pt-1">
            {activeTab === "impact" && analysis.impact && (
              <ImpactTab impact={analysis.impact} />
            )}
            {activeTab === "cap" && analysis.cap && (
              <CapOutlookTab projection={analysis.cap} />
            )}
            {activeTab === "grade" && analysis.grade && (
              <GradeTab grade={analysis.grade} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
