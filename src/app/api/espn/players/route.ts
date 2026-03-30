import { NextRequest, NextResponse } from "next/server";
import { getCached, setCache } from "~/lib/cache";
import { espnLimiter, getClientIp } from "~/lib/rate-limit";

export const dynamic = "force-dynamic";

const CACHE_TTL = 86400000; // 24 hours

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
    const limit = searchParams.get("limit") || "50";
    const active = searchParams.get("active") || "true";

    const cacheKey = `espn:players:${league}:${limit}:${active}`;
    const cached = getCached<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // ESPN's athletes/players endpoint
    const url = `https://sports.core.api.espn.com/v3/sports/football/${league}/athletes?limit=${limit}&active=${active}`;

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

    // Return formatted player data
    const result = {
      success: true,
      data: data.items || [],
      pagination: {
        total: data.count || 0,
        limit: parseInt(limit),
      },
      source: "ESPN API",
    };

    setCache(cacheKey, result, CACHE_TTL);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching players:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch player data" },
      { status: 500 }
    );
  }
}
