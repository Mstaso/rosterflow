import { NextRequest, NextResponse } from "next/server";
import { getNBATeamWithRosterAndDraftPicks } from "../../../../../actions/nbaTeams";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { teamId: string } }
) {
  try {
    const { teamId } = await params;
    const parsedTeamId = parseInt(teamId, 10);
    if (isNaN(parsedTeamId)) {
      return NextResponse.json(
        { success: false, error: "Invalid teamId" },
        { status: 400 }
      );
    }
    const team = await getNBATeamWithRosterAndDraftPicks(parsedTeamId);
    console.log("TEAM", team);
    if (!team) {
      return NextResponse.json(
        { success: false, error: "Team not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: team });
  } catch (error) {
    console.error("Error fetching NBA team from DB:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch NBA team" },
      { status: 500 }
    );
  }
}
