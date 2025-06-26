import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { env } from "~/env";
import type { Player, SelectedAsset, Team } from "~/types";
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
3. **ONLY USE PLAYERS FROM PROVIDED ROSTERS** - You can ONLY use players that are explicitly listed in the "AVAILABLE PLAYERS FOR TRADES" section above. DO NOT make up players or use players that are not in the provided rosters.
4. **VERIFY PLAYER TEAMS** - Before including any player in a trade, verify they are actually on the team you're listing them as being from. Each player must appear in the roster of the team you claim they're from.
5. Use the specific cap information provided in "TEAM SALARY CAP POSITIONS" to determine each team's cap status:
   - If "UNDER CAP" - Full flexibility
   - If "OVER CAP" - Standard 125% + $100K salary matching rules
   - If "FIRST APRON" - NO salary aggregation, NO receiving more salary than sent out
   - If "SECOND APRON" - NO salary aggregation, NO trade exceptions, NO receiving more money than sent out
6. Apply the appropriate salary cap rules based on each team's actual cap position shown above
7. Each trade can involve 2-5 teams
8. Create realistic trades teams would actually consider given their cap constraints${
      hasDestinations
        ? "\n9. Try to respect the destination preferences when possible"
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
            "You are an expert NBA analyst who specializes in realistic trade scenarios. You MUST follow the salary cap rules exactly as specified and ONLY use players listed in the provided rosters. CRITICAL: You can ONLY use players that are explicitly provided in the roster data. DO NOT make up players or use players that are not in the provided rosters. Always respond with valid JSON array only. Each trade scenario should involve 2-5 teams and show exactly what each team gives and receives. Pay special attention to First and Second Apron restrictions - these are critical and must be followed precisely. IMPORTANT: Generate only valid JSON - do not include dollar signs ($) in player names, use (XX.XM) format instead. Ensure all quotes are properly escaped. RESPOND WITH ONLY THE JSON ARRAY - NO EXPLANATIONS, NO MARKDOWN, NO CODE BLOCKS.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
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

      // Validate that all players in trades actually exist on their claimed teams
      // const validationErrors = validateTradePlayers(
      //   parsedResponse,
      //   involvedTeams
      // );
      // if (validationErrors.length > 0) {
      //   console.warn("Trade validation errors found:", validationErrors);
      //   // You could choose to filter out invalid trades or return them with warnings
      // }

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
      console.error(
        "Initial JSON parse failed, attempting to extract complete trades..."
      );
      console.error("Parse error:", parseError);

      // Try to extract complete trade scenarios from the incomplete JSON
      try {
        // Find all complete trade objects by looking for the pattern: {"teams": [...]}
        const tradeMatches = cleanedContent.match(
          /\{[^}]*"teams"\s*:\s*\[[^\]]*\][^}]*\}/g
        );

        if (tradeMatches && tradeMatches.length > 0) {
          console.log(`Found ${tradeMatches.length} potential complete trades`);

          const completeTrades = [];

          for (const tradeMatch of tradeMatches) {
            try {
              // Try to fix common JSON issues in individual trades
              let fixedTrade = tradeMatch;

              // Fix missing commas in arrays
              fixedTrade = fixedTrade.replace(
                /"([^"]*)"\s*"([^"]*)"\s*:/g,
                '"$1", "$2":'
              );
              fixedTrade = fixedTrade.replace(
                /(\d+)\s*"([^"]*)"\s*:/g,
                '$1, "$2":'
              );
              fixedTrade = fixedTrade.replace(
                /(true|false|null)\s*"([^"]*)"\s*:/g,
                '$1, "$2":'
              );

              // Fix trailing commas
              fixedTrade = fixedTrade.replace(/,(\s*[}\]])/g, "$1");

              // Fix missing quotes around property names
              fixedTrade = fixedTrade.replace(
                /([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,
                '$1"$2":'
              );

              // Remove control characters
              fixedTrade = fixedTrade.replace(/[\x00-\x1F\x7F]/g, "");

              const parsedTrade = JSON.parse(fixedTrade);
              if (
                parsedTrade &&
                parsedTrade.teams &&
                Array.isArray(parsedTrade.teams)
              ) {
                completeTrades.push(parsedTrade);
                console.log(
                  "Successfully parsed trade:",
                  parsedTrade.teams.length,
                  "teams"
                );
              }
            } catch (tradeParseError) {
              console.log(
                "Failed to parse individual trade:",
                tradeParseError instanceof Error
                  ? tradeParseError.message
                  : "Unknown error"
              );

              // Try a more aggressive fix for this specific trade
              try {
                let aggressiveFix = tradeMatch;

                // Remove any incomplete objects at the end
                const lastCompleteObject = aggressiveFix.match(/.*\}(?=\s*$)/s);
                if (lastCompleteObject) {
                  aggressiveFix = lastCompleteObject[0] + "}";
                }

                // Balance braces
                const openBraces = (aggressiveFix.match(/\{/g) || []).length;
                const closeBraces = (aggressiveFix.match(/\}/g) || []).length;
                for (let i = 0; i < openBraces - closeBraces; i++) {
                  aggressiveFix += "}";
                }

                // Remove trailing commas
                aggressiveFix = aggressiveFix.replace(/,(\s*[}\]])/g, "$1");

                const parsedTrade = JSON.parse(aggressiveFix);
                if (
                  parsedTrade &&
                  parsedTrade.teams &&
                  Array.isArray(parsedTrade.teams)
                ) {
                  completeTrades.push(parsedTrade);
                  console.log(
                    "Successfully parsed trade with aggressive fix:",
                    parsedTrade.teams.length,
                    "teams"
                  );
                }
              } catch (aggressiveError) {
                console.log("Aggressive fix also failed for trade");
              }
            }
          }

          if (completeTrades.length > 0) {
            console.log(`Returning ${completeTrades.length} complete trades`);
            return NextResponse.json({
              success: true,
              data: {
                trades: completeTrades,
                selectedAssets: selectedAssets,
                teamsAddedToTrade: teamsAddedToTrade,
                prompt: prompt,
              },
              source: "OpenAI GPT-4o-turbo (partial)",
            });
          }
        }

        console.log("No complete trades found in extraction attempt");
      } catch (extractError) {
        console.error("Failed to extract complete trades:", extractError);
      }

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
