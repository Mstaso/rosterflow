import { NextRequest, NextResponse } from "next/server";
import { getCached, setCache } from "~/lib/cache";
import { espnLimiter, getClientIp } from "~/lib/rate-limit";

export const dynamic = "force-dynamic";

const CACHE_TTL = 86400000; // 24 hours

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
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
    const { teamId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const league = searchParams.get("league") || "nfl";
    const includeRoster = searchParams.get("includeRoster") === "true";

    const cacheKey = `espn:team:${league}:${teamId}:${includeRoster}`;
    const cached = getCached<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // ESPN's team details endpoint
    let url = `https://site.api.espn.com/apis/site/v2/sports/football/${league}/teams/${teamId}`;

    if (includeRoster) {
      url += "?enable=roster";
    }

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; RosterFlow/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(`ESPN API responded with status: ${response.status}`);
    }

    const data = await response.json();

    // Return formatted team data
    const result = {
      success: true,
      data: data.team || data,
      source: "ESPN API",
    };

    setCache(cacheKey, result, CACHE_TTL);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching team details:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch team details" },
      { status: 500 }
    );
  }
}
