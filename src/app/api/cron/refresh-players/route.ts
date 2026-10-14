import { type NextRequest, NextResponse } from "next/server";
import { env } from "~/env";
import prisma from "~/lib/db";
import {
  getDataFreshness,
  refreshLeagueData,
  shouldRefreshOn,
} from "~/lib/data-refresh";

export const dynamic = "force-dynamic";
// A full-league refresh measures ~30-40s; 60s is the ceiling every Vercel
// plan allows without extra configuration.
export const maxDuration = 60;

/**
 * Scheduled ESPN refresh (see vercel.json). Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET`. The cron fires daily; in the
 * off-season we only act on Mondays. `?force=1` runs regardless.
 */
export async function GET(request: NextRequest) {
  if (
    !env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`
  ) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!prisma) {
    return NextResponse.json(
      { success: false, error: "Database not available" },
      { status: 500 }
    );
  }

  const force = request.nextUrl.searchParams.get("force") === "1";
  if (!force && !shouldRefreshOn(new Date())) {
    return NextResponse.json({ success: true, skipped: "off-season, not Monday" });
  }

  try {
    const result = await refreshLeagueData(prisma);
    const freshness = await getDataFreshness(prisma);
    console.log("[refresh]", JSON.stringify({ ...result, freshness }));
    // Partial refreshes still report 200 so Vercel doesn't mark the cron
    // failed for one flaky ESPN call; teamsFailed + freshness carry the detail.
    return NextResponse.json({ success: true, ...result, freshness });
  } catch (error) {
    console.error("[refresh] failed before any write:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Refresh failed" },
      { status: 502 }
    );
  }
}
