import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const league = searchParams.get("league") || "nfl";
    const season = searchParams.get("season") || "2024";

    // ESPN's team endpoint
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/${league}/teams`;

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
    return NextResponse.json({
      success: true,
      data: data.sports[0]?.leagues[0]?.teams || [],
      source: "ESPN API",
    });
  } catch (error) {
    console.error("Error fetching teams:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch team data" },
      { status: 500 }
    );
  }
}
