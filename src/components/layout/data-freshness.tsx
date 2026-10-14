"use client";

import { useEffect, useState } from "react";

/**
 * "Data as of" line: when rosters, records and stats were last pulled from
 * ESPN (the oldest per-team refresh, so one failed team can't hide). Fetched
 * client-side because the pages around the footer are statically rendered.
 */
export function DataFreshness() {
  const [asOf, setAsOf] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/data-status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { oldestTeamRefresh?: string | null } | null) => {
        if (data?.oldestTeamRefresh) setAsOf(data.oldestTeamRefresh);
      })
      .catch(() => {});
  }, []);

  if (!asOf) return null;
  return (
    <p className="font-supermolot text-[10px] tracking-[0.22em] text-on-surface-variant">
      Rosters &amp; stats as of{" "}
      <time dateTime={asOf} className="tabular-nums">
        {new Date(asOf).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </time>
    </p>
  );
}
