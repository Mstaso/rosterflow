import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const league = searchParams.get("league") || "nfl";
    const week = searchParams.get("week");
    const season = searchParams.get("season") || "2024";
    const seasontype = searchParams.get("seasontype") || "2"; // 1=preseason, 2=regular, 3=postseason

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
    return NextResponse.json({
      success: true,
      data: {
        events: data.events || [],
        week: data.week,
        season: data.season,
        seasonType: data.seasonType,
      },
      source: "ESPN API",
    });
  } catch (error) {
    console.error("Error fetching scoreboard:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch scoreboard data" },
      { status: 500 },
    );
  }
}
