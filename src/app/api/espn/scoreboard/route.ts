import { NextRequest, NextResponse } from "next/server";
import { getCached, setCache } from "~/lib/cache";
import { espnLimiter, getClientIp } from "~/lib/rate-limit";

export const dynamic = "force-dynamic";

const CACHE_TTL = 300000; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { success, remaining } = espnLimiter.check(ip);
    if (!success) {
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded. Please try again later." },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const league = searchParams.get("league") || "nfl";
    const week = searchParams.get("week");
    const season = searchParams.get("season") || "2024";
    const seasontype = searchParams.get("seasontype") || "2"; // 1=preseason, 2=regular, 3=postseason

    const cacheKey = `espn:scoreboard:${league}:${season}:${week}:${seasontype}`;
    const cached = getCached<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Build ESPN scoreboard URL
    let url = `https://site.api.espn.com/apis/site/v2/sports/football/${league}/scoreboard`;
    const params = new URLSearchParams();

    if (week) params.append("week", week);
    if (season) params.append("dates", season);
    if (seasontype) params.append("seasontype", seasontype);

    if (params.toString()) {
      url += `?${params.toString()}`;
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

    // Return formatted scoreboard data
    const result = {
      success: true,
      data: {
        events: data.events || [],
        week: data.week,
        season: data.season,
        seasonType: data.seasonType,
      },
      source: "ESPN API",
    };

    setCache(cacheKey, result, CACHE_TTL);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching scoreboard:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch scoreboard data" },
      { status: 500 }
    );
  }
}
