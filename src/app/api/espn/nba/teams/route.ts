import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
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
    const season = searchParams.get("season") || "2024";

    const cacheKey = `espn:nba:teams`;
    const cached = getCached<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // ESPN's NBA teams endpoint
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams`;

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

    // Transform the data to include only essential team info
    const teams =
      data.sports[0]?.leagues[0]?.teams?.map((teamData: any) => ({
        id: teamData.team.id,
        uid: teamData.team.uid,
        slug: teamData.team.slug,
        abbreviation: teamData.team.abbreviation,
        displayName: teamData.team.displayName,
        shortDisplayName: teamData.team.shortDisplayName,
        name: teamData.team.name,
        city: teamData.team.location,
        color: teamData.team.color,
        alternateColor: teamData.team.alternateColor,
        isActive: teamData.team.isActive,
        logos: teamData.team.logos,
        record: teamData.team.record,
        venue: teamData.team.venue,
      })) || [];

    const result = {
      success: true,
      data: teams,
      total: teams.length,
      season,
      source: "ESPN API",
    };

    setCache(cacheKey, result, CACHE_TTL);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching NBA teams:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch NBA teams" },
      { status: 500 }
    );
  }
}
