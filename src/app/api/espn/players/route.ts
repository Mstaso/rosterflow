import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const league = searchParams.get("league") || "nfl";
    const limit = searchParams.get("limit") || "50";
    const active = searchParams.get("active") || "true";

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
    return NextResponse.json({
      success: true,
      data: data.items || [],
      pagination: {
        total: data.count || 0,
        limit: parseInt(limit),
      },
      source: "ESPN API",
    });
  } catch (error) {
    console.error("Error fetching players:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch player data" },
      { status: 500 }
    );
  }
}
