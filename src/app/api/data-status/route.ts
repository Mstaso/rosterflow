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
  return NextResponse.json({ success: true, ...(await getDataFreshness(prisma)) });
}
