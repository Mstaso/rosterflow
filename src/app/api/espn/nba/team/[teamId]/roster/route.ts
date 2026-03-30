import { NextRequest, NextResponse } from "next/server";
import { getCached, setCache } from "~/lib/cache";
import { espnLimiter, getClientIp } from "~/lib/rate-limit";

export const dynamic = "force-dynamic";

const CACHE_TTL = 43200000; // 12 hours

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
    const season = searchParams.get("season") || "2024";

    const cacheKey = `espn:nba:roster:${teamId}`;
    const cached = getCached<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // ESPN's NBA team roster endpoint
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/roster`;

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

    // Transform player data to include available information
    const roster =
      data.athletes
        ?.map((athlete: any) => ({
          id: athlete.id,
          uid: athlete.uid,
          guid: athlete.guid,
          firstName: athlete.firstName,
          lastName: athlete.lastName,
          fullName: athlete.fullName,
          displayName: athlete.displayName,
          shortName: athlete.shortName,
          weight: athlete.weight,
          displayWeight: athlete.displayWeight,
          height: athlete.height,
          displayHeight: athlete.displayHeight,
          age: athlete.age,
          dateOfBirth: athlete.dateOfBirth,
          birthPlace: athlete.birthPlace,
          jersey: athlete.jersey,
          position: athlete.position,
          experience: athlete.experience,
          college: athlete.college,
          headshot: athlete.headshot,
          status: athlete.status,
          injuries: athlete.injuries,
          // Contract information (if available)
          contract: athlete.contract || null,
          salary: athlete.salary || null,
          // Additional stats that might be available
          stats: athlete.statistics || null,
        }))
        // Filter out players with 0 years remaining on their contracts
        ?.filter((player: any) => {
          const yearsRemaining = player.contract?.yearsRemaining;
          return yearsRemaining && yearsRemaining > 0;
        }) || [];

    // Sort players by salary in descending order (highest paid first)
    roster.sort((a: any, b: any) => {
      const salaryA = a.contract?.salary || 0;
      const salaryB = b.contract?.salary || 0;
      return salaryB - salaryA;
    });

    // Also try to get team information
    const teamInfo = data.team || null;

    const result = {
      success: true,
      data: {
        team: teamInfo,
        roster,
        rosterCount: roster.length,
        season,
      },
      source: "ESPN API",
    };

    setCache(cacheKey, result, CACHE_TTL);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching NBA team roster:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch NBA team roster" },
      { status: 500 }
    );
  }
}
