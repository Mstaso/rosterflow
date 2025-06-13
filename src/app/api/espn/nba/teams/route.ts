import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const season = searchParams.get("season") || "2024";

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

    return NextResponse.json({
      success: true,
      data: teams,
      total: teams.length,
      season,
      source: "ESPN API",
    });
  } catch (error) {
    console.error("Error fetching NBA teams:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch NBA teams" },
      { status: 500 },
    );
  }
}
