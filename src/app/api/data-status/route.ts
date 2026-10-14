import { NextResponse } from "next/server";
import prisma from "~/lib/db";
import { getDataFreshness } from "~/lib/data-refresh";

export const dynamic = "force-dynamic";

/** Public: when league data was last refreshed, so staleness is visible. */
export async function GET() {
  if (!prisma) {
    return NextResponse.json(
      { success: false, error: "Database not available" },
      { status: 500 }
    );
  }
  // Called from the footer on every page view; let the CDN absorb it.
  return NextResponse.json(
    { success: true, ...(await getDataFreshness(prisma)) },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } }
  );
}
