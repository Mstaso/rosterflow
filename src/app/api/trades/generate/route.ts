import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getApiUrl } from "~/lib/api-utils";
import { env } from "~/env";
import type { SelectedAsset } from "~/types";

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
    const { selectedAssets, teams } = body;

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

    // Build roster and cap context from the teams data passed in the request
    let rosterContext = "";

    teams.forEach((team: any) => {
      const teamName = team.displayName || team.name;

      // Format players with salaries
      const playersWithSalaries =
        team.players
          ?.map(
            (player: any) =>
              `${
                player.name || player.fullName
              } (${player.contract.salary.toString()}M)`
          )
          .join(", ") || "No players";

      // Format draft picks
      const picksFormatted =
        team.draftPicks
          ?.map((pick: any) => {
            let pickText = `${pick.year} ${pick.round} Round Pick`;

            // Add protection status
            if (pick.isProtected) {
              pickText += " (Protected)";
            }

            // Add swap status
            if (pick.isSwap) {
              pickText += " (Swap)";
            }

            // Add description if available
            if (pick.description) {
              pickText += ` - ${pick.description}`;
            }

            return pickText;
          })
          .join(", ") || "No picks";

      rosterContext += `**${teamName}:** Players: ${playersWithSalaries} | Picks: ${picksFormatted}\n`;
    });

    let capContext = "";

    // Build cap context from teams data
    const capEntries = involvedTeams.map((team: any) => {
      const totalCap = ((team.totalCapAllocation || 0) / 1000000).toFixed(1);
      const capSpace = ((team.capSpace || 0) / 1000000).toFixed(1);
      const firstApronSpace = ((team.firstApronSpace || 0) / 1000000).toFixed(
        1
      );
      const secondApronSpace = ((team.secondApronSpace || 0) / 1000000).toFixed(
        1
      );

      let capStatus = "";
      if ((team.secondApronSpace || 0) < 0) {
        capStatus = "SECOND APRON (Severe restrictions)";
      } else if ((team.firstApronSpace || 0) < 0) {
        capStatus = "FIRST APRON (Limited flexibility)";
      } else if ((team.capSpace || 0) < 0) {
        capStatus = "OVER CAP (Standard restrictions)";
      } else {
        capStatus = "UNDER CAP (Full flexibility)";
      }

      return `**${
        team.displayName || team.name
      }:** Total Cap: $${totalCap}M, Cap Space: $${capSpace}M, First Apron Space: $${firstApronSpace}M, Second Apron Space: $${secondApronSpace}M - ${capStatus}`;
    });

    if (capEntries.length > 0) {
      capContext = `\n\n**TEAM SALARY CAP POSITIONS:**
${capEntries.join("\n")}

**IMPORTANT: Consider each team's cap position when designing trades. Teams under different cap restrictions have different trade limitations.**`;
    }

    const getPlayerorPickById = (
      teamId: string,
      id: string,
      type: "player" | "pick"
    ) => {
      if (type === "player") {
        return teams
          .find((t: any) => t.id === teamId)
          ?.players.find((p: any) => p.id === id);
      } else {
        return teams
          .find((t: any) => t.id === teamId)
          ?.draftPicks.find((p: any) => p.id === id);
      }
    };

    // Build assets summary for the prompt
    const assetsByTeam = selectedAssets.reduce((acc: any, asset: any) => {
      if (!acc[asset.teamId]) {
        acc[asset.teamId] = { players: [], picks: [] };
      }
      if (asset.type === "player") {
        acc[asset.teamId].players.push(
          getPlayerorPickById(asset.teamId, asset.id, asset.type)
        );
      } else {
        acc[asset.teamId].picks.push(
          getPlayerorPickById(asset.teamId, asset.id, asset.type)
        );
      }
      return acc;
    }, {});

    let assetsDescription = "";
    Object.entries(assetsByTeam).forEach(([teamId, assets]: [string, any]) => {
      const team = teams.find((t: any) => t.id === teamId);
      const teamName = team?.displayName || team?.name || teamId;

      assetsDescription += `\n**${teamName} Trading Away:**\n`;

      if (assets.players.length > 0) {
        assetsDescription += `Players: ${assets.players
          .filter((p: any) => p && (p.name || p.fullName))
          .map(
            (p: any) =>
              `${p.name || p.fullName} ($${
                p.salary ? (p.salary / 1000000).toFixed(1) : "0"
              }M)`
          )
          .join(", ")}\n`;
      }

      if (assets.picks.length > 0) {
        assetsDescription += `Draft Picks: ${assets.picks
          .filter((p: any) => p && p.year && p.round)
          .map((p: any) => {
            let pickText = `${p.year} ${p.round} Round Pick`;

            // Add protection status
            if (p.isProtected) {
              pickText += " (Protected)";
            }

            // Add swap status
            if (p.isSwap) {
              pickText += " (Swap)";
            }

            // Add description if available
            if (p.description) {
              pickText += ` - ${p.description}`;
            }

            return pickText;
          })
          .join(", ")}\n`;
      }
    });

    // Add destination information if specified
    const hasDestinations = selectedAssets.some(
      (asset: any) => asset.targetTeamId
    );
    let destinationInfo = "";

    if (hasDestinations) {
      destinationInfo = "\n**Destination Preferences:**\n";
      selectedAssets.forEach((asset: SelectedAsset) => {
        if (asset.targetTeamId) {
          // Find the source and destination teams by id (number)
          const fromTeam = teams.find((t: any) => t.id === asset.teamId);
          const toTeam = teams.find((t: any) => t.id === asset.targetTeamId);
          const fromTeamName =
            fromTeam?.displayName || fromTeam?.name || String(asset.teamId);
          const toTeamName =
            toTeam?.displayName || toTeam?.name || String(asset.targetTeamId);

          // Find the asset details from the team roster or draft picks
          let assetName = "";
          if (asset.type === "player") {
            const player = fromTeam?.players?.find(
              (p: any) => String(p.id) === asset.id
            );
            assetName = player
              ? player.name || player.fullName || `Player ${asset.id}`
              : `Player ${asset.id}`;
          } else if (asset.type === "pick") {
            const pick = fromTeam?.draftPicks?.find(
              (p: any) => String(p.id) === asset.id
            );
            if (pick) {
              let pickText = `${pick.year} ${pick.round} Round Pick`;

              // Add protection status
              if (pick.isProtected) {
                pickText += " (Protected)";
              }

              // Add swap status
              if (pick.isSwap) {
                pickText += " (Swap)";
              }

              // Add description if available
              if (pick.description) {
                pickText += ` - ${pick.description}`;
              }

              assetName = pickText;
            } else {
              assetName = `Pick ${asset.id}`;
            }
          }

          destinationInfo += `- ${assetName} from ${fromTeamName} → ${toTeamName}\n`;
        }
      });
    }

    // Build the prompt with selected assets information
    const prompt = `You are an expert NBA trade analyst. Generate 3-4 realistic 2024-25 season trade scenarios.

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
- Can use trade exceptions
- Can sign players to minimum contracts

**First Apron - CRITICAL RESTRICTIONS:**
- CANNOT aggregate salaries in trades (cannot combine multiple players to match a higher-paid player)
- CANNOT use trade exceptions over $5M
- CANNOT receive more salary than sent out in trades
- Can still make trades but with much less flexibility

**Second Apron - SEVERE RESTRICTIONS:**
- CANNOT trade players together (no salary aggregation)
- CANNOT use any trade exceptions
- CANNOT receive more money than sent out
- CANNOT sign bought-out players over minimum
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
        "gives": ["Player 1 ($XX.XM)", "2025 1st Round Pick"],
        "receives": ["Player 2 ($XX.XM)"]
      },
      {
        "teamName": "Team B", 
        "gives": ["Player 2 ($XX.XM)"],
        "receives": ["Player 1 ($XX.XM)", "2025 1st Round Pick"]
      }
    ],
    "explanation": "Brief explanation of trade rationale and why it makes sense for all teams",
    "salaryMatch": "Salary matching details for NBA rules compliance"
  }
]

Generate 3-4 different trade scenarios in this format.`;

    // Consider using "gpt-4-turbo" for better quality and similar speed/cost to "gpt-4o-mini"
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are an expert NBA analyst who specializes in realistic trade scenarios. You MUST follow the salary cap rules exactly as specified and ONLY use players listed in the provided rosters. Always respond with valid JSON array only. Each trade scenario should involve 2-5 teams and show exactly what each team gives and receives. Pay special attention to First and Second Apron restrictions - these are critical and must be followed precisely.",
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

    // Try to parse the JSON response
    let trades;
    try {
      // Handle markdown-wrapped JSON responses
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

      trades = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", responseContent);
      console.error("Parse error:", parseError);
      throw new Error("Invalid JSON response from OpenAI");
    }

    return NextResponse.json({
      success: true,
      data: {
        trades,
        selectedAssets: selectedAssets,
      },
      source: "OpenAI GPT-4o-turbo",
    });
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
