import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { env } from "~/env";
import type { SelectedAsset, Team } from "~/types";
import {
  getAssetsByTeam,
  getCapContext,
  getDestinationInfo,
  getRosterContext,
  getSalaryMatchingContext,
  setupAdditionalTeamsForTrade,
} from "~/lib/server-utils";

export const dynamic = "force-dynamic";

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    if (!env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { selectedAssets, teams, additionalTeams } = body;

    if (
      !selectedAssets ||
      !Array.isArray(selectedAssets) ||
      selectedAssets.length === 0 ||
      !teams
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Selected assets and team information required",
        },
        { status: 400 }
      );
    }

    const involvedTeams = teams;

    if (involvedTeams.length > 5) {
      return NextResponse.json(
        {
          success: false,
          error: "Maximum of 5 teams allowed",
        },
        { status: 400 }
      );
    }

    let teamsAddedToTrade: any[] = [];

    if (additionalTeams) {
      const teamWithRosterAndPicks = await setupAdditionalTeamsForTrade(
        additionalTeams
      );
      involvedTeams.push(...teamWithRosterAndPicks);
      teamsAddedToTrade = teamWithRosterAndPicks;
    }

    const rosterContext = getRosterContext(involvedTeams);
    const assetsDescription = getAssetsByTeam(selectedAssets, involvedTeams);
    const salaryMatchingContext = getSalaryMatchingContext(
      selectedAssets,
      involvedTeams
    );

    const hasDestinations = selectedAssets.some(
      (asset: any) => asset.targetTeamId
    );
    let destinationInfo = "";
    if (hasDestinations) {
      destinationInfo = getDestinationInfo(selectedAssets, involvedTeams);
    }

    const prompt = `Generate 3-4 realistic 2025-26 NBA trade scenarios using the data below.

SELECTED ASSETS (must appear in every scenario):
${assetsDescription}${destinationInfo}

${salaryMatchingContext}

ROSTERS & PICKS (players with salary ≥$2M, pick value 1-100 scale):
${rosterContext}

SALARY MATCHING INSTRUCTIONS:
- Each team's section above shows their cap tier, the formula for matching, and pre-computed bounds for the selected assets
- If you add more outgoing players from a team, recalculate the matching window using the formula provided
- Add up total outgoing salary, then apply the formula to get the valid incoming range
- Make sure each team's total incoming salary falls within their valid range
- SECOND APRON teams: one-for-one only (cannot combine multiple players' salaries)

OTHER RULES:
- Every asset received must be given by another team (balanced trades)
- Only use players listed above
- 2-5 teams per trade${hasDestinations ? "\n- Respect destination preferences when possible" : ""}
- Pick [val:X] indicates estimated value (1-100). Use this to assess trade fairness — higher value picks are worth more.

Respond with ONLY a JSON array. Each scenario:
[
  {
    "teams": [
      {
        "teamName": "Team Name",
        "gives": {
          "players": [{"name": "Player Name", "type": "player"}],
          "picks": [{"name": "2026 R1", "type": "pick"}]
        },
        "receives": {
          "players": [{"name": "Player Name", "type": "player", "from": "Other Team"}],
          "picks": [{"name": "2026 R1", "type": "pick", "from": "Other Team"}]
        }
      }
    ]
  }
]`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert NBA trade analyst. Generate realistic trade scenarios using only the provided roster data. Respond with valid JSON only — no markdown, no explanations.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
      max_tokens: 4000,
    });

    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      throw new Error("No response from OpenAI");
    }

    let cleanedContent = responseContent.trim();

    // Remove markdown code blocks if present
    if (cleanedContent.startsWith("```json")) {
      cleanedContent = cleanedContent
        .replace(/^```json\s*/, "")
        .replace(/\s*```$/, "");
    } else if (cleanedContent.startsWith("```")) {
      cleanedContent = cleanedContent
        .replace(/^```\s*/, "")
        .replace(/\s*```$/, "");
    }

    try {
      const parsedResponse = JSON.parse(cleanedContent);

      // Handle both array format and {trades: [...]} format from json_object mode
      const trades = Array.isArray(parsedResponse)
        ? parsedResponse
        : parsedResponse.trades || parsedResponse.scenarios || [];

      return NextResponse.json({
        success: true,
        data: {
          trades,
          selectedAssets: selectedAssets,
          teamsAddedToTrade: teamsAddedToTrade,
          prompt: prompt,
        },
        source: "OpenAI GPT-4o-mini",
      });
    } catch (parseError) {
      console.error("JSON parse failed:", parseError);
      console.error("Raw response:", cleanedContent.substring(0, 500));

      throw new Error(
        `Invalid JSON response from OpenAI: ${
          parseError instanceof Error ? parseError.message : "Unknown error"
        }`
      );
    }
  } catch (error) {
    console.error("Error generating trades with OpenAI:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to generate trades",
      },
      { status: 500 }
    );
  }
}
