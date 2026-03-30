import { NextRequest, NextResponse } from "next/server";
import { getCached, setCache } from "~/lib/cache";
import { espnLimiter, getClientIp } from "~/lib/rate-limit";

export const dynamic = "force-dynamic";

const CACHE_TTL = 86400000; // 24 hours

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(request);
    const { success, remaining } = espnLimiter.check(ip);
    if (!success) {
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded. Please try again later." },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Athlete ID is required" },
        { status: 400 }
      );
    }

    const cacheKey = `espn:athlete:${id}`;
    const cached = getCached<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Fetch stats from ESPN API
    const response = await fetch(
      `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${id}/stats`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; RosterFlow/1.0)",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`ESPN API responded with status: ${response.status}`);
    }

    const data = await response.json();

    const result = {
      success: true,
      data,
    };

    setCache(cacheKey, result, CACHE_TTL);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching athlete data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch athlete data" },
      { status: 500 }
    );
  }
}
