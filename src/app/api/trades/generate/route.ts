import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { env } from "~/env";
import type { Player, Team } from "~/types";
import {
  getAssetsByTeam,
  getCapContext,
  getDestinationInfo,
  getRosterContext,
  setupAdditionalTeamsForTrade,
} from "~/lib/server-utils";

export const dynamic = "force-dynamic";

// Initialize OpenAI client
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

    // need to send this back to client side so they can have rosters and picks for the teams added to the trade
    let teamsAddedToTrade: any[] = [];

    if (additionalTeams) {
      const teamWithRosterAndPicks = await setupAdditionalTeamsForTrade(
        additionalTeams
      );
      involvedTeams.push(...teamWithRosterAndPicks);
      teamsAddedToTrade = teamWithRosterAndPicks;
    }

    // Build roster and cap context from the teams data passed in the request
    let rosterContext = getRosterContext(involvedTeams);

    // get Salary Cap Information
    let capContext = getCapContext(involvedTeams);

    // Build assets summary for the prompt
    let assetsDescription = getAssetsByTeam(selectedAssets, involvedTeams);

    // Add destination information if specified
    const hasDestinations = selectedAssets.some(
      (asset: any) => asset.targetTeamId
    );
    let destinationInfo = "";

    // TDOO: this can be improved by using the getAssetsByTeam function to get the destination info
    if (hasDestinations) {
      destinationInfo = getDestinationInfo(selectedAssets, involvedTeams);
    }

    // Build the prompt with selected assets information
    const prompt = `You are an expert NBA trade analyst. Generate 3-4 realistic 2025-26 season trade scenarios.

**SELECTED ASSETS TO TRADE (THESE MUST BE INCLUDED IN ALL TRADE SCENARIOS):**
${assetsDescription}${destinationInfo}

**AVAILABLE PLAYERS FOR TRADES (ONLY USE THESE PLAYERS):**
${rosterContext}

**TEAM SALARY CAP POSITIONS:**
${capContext}

**CRITICAL SALARY CAP RULES - MUST FOLLOW THESE EXACTLY:**

**Teams Over Salary Cap (but under aprons):**
- Must match salaries within 125% + $100K for incoming players
- Can aggregate multiple players in trades

**First Apron - CRITICAL RESTRICTIONS:**
- If team is currently under first apron but a potential trade would put them over, all of the first apron restrictions apply
- Must match salaries within 110% + $100K for incoming players

**Second Apron - SEVERE RESTRICTIONS:**
- If team is currently under second apron but a potential trade would put them over, all of the second apron restrictions apply
- CANNOT trade players together (no salary aggregation)
- CANNOT use any trade exceptions
- CANNOT receive more money than sent out
- Draft pick penalties: Future first-round picks frozen
- CANNOT use mid-level exception

**MANDATORY REQUIREMENTS:**
1. **MUST INCLUDE ALL SELECTED ASSETS** - Every trade scenario must include the assets listed in "SELECTED ASSETS TO TRADE" above
2. **TRADE BALANCE IS CRITICAL** - Every player/pick received by one team MUST be given by another team. No assets can appear in "receives" without appearing in "gives" from another team.
3. ONLY use players listed in the "AVAILABLE PLAYERS FOR TRADES" section above
4. Use the specific cap information provided in "TEAM SALARY CAP POSITIONS" to determine each team's cap status:
   - If "UNDER CAP" - Full flexibility
   - If "OVER CAP" - Standard 125% + $100K salary matching rules
   - If "FIRST APRON" - NO salary aggregation, NO receiving more salary than sent out
   - If "SECOND APRON" - NO salary aggregation, NO trade exceptions, NO receiving more money than sent out
5. Apply the appropriate salary cap rules based on each team's actual cap position shown above
6. Each trade can involve 2-5 teams
7. Create realistic trades teams would actually consider given their cap constraints${
      hasDestinations
        ? "\n8. Try to respect the destination preferences when possible"
        : ""
    }

**TRADE STRUCTURE RULES:**
- Every asset in a "receives" array must appear in exactly one "gives" array from another team
- Every asset in a "gives" array must appear in exactly one "receives" array from another team
- No assets can be created or destroyed in trades
- All trades must be balanced (what goes out must come in somewhere else)

**Required JSON format (Array of trade scenarios):**
[
  {
    "teams": [
      {
        "teamName": "Team A",
        "explanation": "Brief explanation of trade rationale and why it makes sense for all teams",
        "salaryMatch": "Salary matching details for NBA rules compliance",
        "gives": {
          "players": [
            {
              "name": "Player 1",
              "type": "player"
            }
          ],
          "picks": [
            {
              "name": "2025 1st Round Pick",
              "type": "pick"
            }
          ]
        },
        "receives": {
          "players": [
            {
              "name": "Player 2",
              "type": "player",
              "from": "Team B"
            }
          ],
          "picks": [
            {
              "name": "2025 1st Round Pick",
              "type": "pick",
              "from": "Team B"
            }
          ]
        }
      },
      {
        "teamName": "Team B",
        "explanation": "Brief explanation of trade rationale and why it makes sense for all teams",
        "salaryMatch": "Salary matching details for NBA rules compliance",
        "gives": {
          "players": [
            {
              "name": "Player 2",
              "type": "player"
            }
          ],
          "picks": [
            {
              "name": "2025 1st Round Pick",
              "type": "pick"
            }
          ]
        },
        "receives": {
          "players": [
            {
              "name": "Player 1",
              "type": "player",
              "from": "Team A"
            }
          ],
          "picks": [
            {
              "name": "2025 1st Round Pick",
              "type": "pick",
              "from": "Team A"
            }
          ]
        }
      }
    ],
  }
]

**CRITICAL: Generate valid JSON only. Do not include dollar signs in player names. Ensure all quotes are properly escaped and the JSON is syntactically correct.**

**JSON VALIDATION CHECKLIST:**
- Start with [ and end with ]
- All property names must be in double quotes
- All string values must be in double quotes
- Escape any quotes within strings with backslash
- No trailing commas before closing brackets/braces
- No dollar signs ($) in player names
- Each team object must have teamId, teamName, gives, and receives arrays
- Each asset must have id, name, and type properties

Generate 3-4 different trade scenarios in this format. RESPOND WITH ONLY THE JSON ARRAY - NO EXPLANATIONS OR MARKDOWN.`;

    // Consider using "gpt-4-turbo" for better quality and similar speed/cost to "gpt-4o-mini"
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are an expert NBA analyst who specializes in realistic trade scenarios. You MUST follow the salary cap rules exactly as specified and ONLY use players listed in the provided rosters. Always respond with valid JSON array only. Each trade scenario should involve 2-5 teams and show exactly what each team gives and receives. Pay special attention to First and Second Apron restrictions - these are critical and must be followed precisely. IMPORTANT: Generate only valid JSON - do not include dollar signs ($) in player names, use (XX.XM) format instead. Ensure all quotes are properly escaped. RESPOND WITH ONLY THE JSON ARRAY - NO EXPLANATIONS, NO MARKDOWN, NO CODE BLOCKS.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1200, // Reduced from 2000 to lower costs
    });

    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      throw new Error("No response from OpenAI");
    }

    // Clean the response content to extract just the JSON
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

    // Try to parse the cleaned JSON
    try {
      const parsedResponse = JSON.parse(cleanedContent);
      return NextResponse.json({
        success: true,
        data: {
          trades: parsedResponse,
          selectedAssets: selectedAssets,
          teamsAddedToTrade: teamsAddedToTrade,
          prompt: prompt,
        },
        source: "OpenAI GPT-4o-turbo",
      });
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", cleanedContent);
      console.error("Parse error:", parseError);
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
