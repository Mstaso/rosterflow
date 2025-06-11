import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const league = searchParams.get("league") || "nfl";
    const includeRoster = searchParams.get("includeRoster") === "true";

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
    return NextResponse.json({
      success: true,
      data: data.team || data,
      source: "ESPN API",
    });
  } catch (error) {
    console.error("Error fetching team details:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch team details" },
      { status: 500 },
    );
  }
}
