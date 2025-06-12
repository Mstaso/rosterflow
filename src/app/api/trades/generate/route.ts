import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getApiUrl } from "~/lib/api-utils";
import { env } from "~/env";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    if (!env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "OpenAI API key not configured" },
        { status: 500 },
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
        { status: 400 },
      );
    }

    // Get unique team IDs from selected assets (both from and to teams)
    const fromTeamIds = [
      ...new Set(selectedAssets.map((asset: any) => asset.fromTeam)),
    ];
    const toTeamIds = [
      ...new Set(
        selectedAssets.map((asset: any) => asset.toTeam).filter(Boolean),
      ),
    ];
    const involvedTeamIds = [...new Set([...fromTeamIds, ...toTeamIds])];

    // Fetch current rosters for multiple teams to provide comprehensive up-to-date context
    let rosterContext = "";
    try {
      // Get all NBA teams first
      const teamsResponse = await fetch(getApiUrl(`/api/espn/nba/teams`));
      if (teamsResponse.ok) {
        const teamsData = await teamsResponse.json();
        if (teamsData.success && teamsData.data) {
          const allTeams = teamsData.data;

          // Fetch rosters for involved teams plus 4 other teams (potential trade partners)
          const teamsToFetch = [
            ...involvedTeamIds, // Teams with selected assets
            ...allTeams
              .filter((t: any) => !involvedTeamIds.includes(t.id))
              .sort(() => 0.5 - Math.random()) // Randomize other teams
              .slice(0, 4) // Get only 4 other teams to reduce costs
              .map((t: any) => t.id),
          ];

          const rosterPromises = teamsToFetch.map(async (teamId: string) => {
            try {
              const rosterResponse = await fetch(
                getApiUrl(`/api/espn/nba/team/${teamId}/roster`),
              );
              if (rosterResponse.ok) {
                const rosterData = await rosterResponse.json();
                if (rosterData.success && rosterData.data?.roster) {
                  const teamInfo = allTeams.find((t: any) => t.id === teamId);
                  const teamName =
                    teamInfo?.displayName || teamInfo?.name || teamId;

                  const keyPlayers = rosterData.data.roster
                    .filter((p: any) => p.contract?.salary > 5000000) // Players making over $5M (higher threshold)
                    .sort(
                      (a: any, b: any) =>
                        (b.contract?.salary || 0) - (a.contract?.salary || 0),
                    )
                    .slice(0, 4) // Top 4 players by salary (reduced from 6)
                    .map(
                      (p: any) =>
                        `${p.fullName} ($${(p.contract?.salary / 1000000).toFixed(1)}M)`,
                    );

                  return `**${teamName}:** ${keyPlayers.join(", ")}`;
                }
              }
              return null;
            } catch (error) {
              return null;
            }
          });

          const rosterResults = await Promise.all(rosterPromises);
          const validRosters = rosterResults.filter(Boolean);

          if (validRosters.length > 0) {
            rosterContext = `\n\n**CURRENT 2024-25 NBA ROSTERS (Key Players by Salary):**
${validRosters.join("\n")}

**IMPORTANT: Use ONLY the players listed above. Do not suggest trades involving players not listed in these current rosters.**`;
          }
        }
      }
    } catch (error) {
      console.log("Could not fetch current rosters for context:", error);
    }

    // Build assets summary for the prompt
    const assetsByTeam = selectedAssets.reduce((acc: any, asset: any) => {
      if (!acc[asset.fromTeam]) {
        acc[asset.fromTeam] = { players: [], picks: [] };
      }
      if (asset.type === "player") {
        acc[asset.fromTeam].players.push(asset.data);
      } else {
        acc[asset.fromTeam].picks.push(asset.data);
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
          .map(
            (p: any) =>
              `${p.name || p.fullName} ($${p.salary ? (p.salary / 1000000).toFixed(1) : "0"}M)`,
          )
          .join(", ")}\n`;
      }

      if (assets.picks.length > 0) {
        assetsDescription += `Draft Picks: ${assets.picks
          .map((p: any) => `${p.year} ${p.round} Round Pick`)
          .join(", ")}\n`;
      }
    });

    // Add destination information if specified
    const hasDestinations = selectedAssets.some((asset: any) => asset.toTeam);
    let destinationInfo = "";

    if (hasDestinations) {
      destinationInfo = "\n**Destination Preferences:**\n";
      selectedAssets.forEach((asset: any) => {
        if (asset.toTeam) {
          const fromTeam = teams.find((t: any) => t.id === asset.fromTeam);
          const toTeam = teams.find((t: any) => t.id === asset.toTeam);
          const fromTeamName =
            fromTeam?.displayName || fromTeam?.name || asset.fromTeam;
          const toTeamName =
            toTeam?.displayName || toTeam?.name || asset.toTeam;
          const assetName =
            asset.type === "player"
              ? asset.data.name || asset.data.fullName
              : `${asset.data.year} ${asset.data.round} Round Pick`;

          destinationInfo += `- ${assetName} from ${fromTeamName} → ${toTeamName}\n`;
        }
      });
    }

    // Build the prompt with selected assets information
    const prompt = `NBA Trade Expert - Generate 3-4 realistic 2024-25 season trade scenarios for the following assets:
${assetsDescription}${destinationInfo}${rosterContext}

**Rules:**
- Use ONLY players from the rosters above
- Follow NBA salary matching (125% rule - teams can trade for up to 125% of outgoing salary)
- Consider team salary caps and other constraints
- Create realistic trades teams would actually consider
- Each trade can involve 2-5 teams
- Consider the full package being traded together${hasDestinations ? "\n- Try to respect the destination preferences when possible" : ""}

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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert NBA analyst who specializes in realistic trade scenarios. Always respond with valid JSON array only. Each trade scenario should involve 2-5 teams and show exactly what each team gives and receives.",
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
        selectedAssets: selectedAssets.map((asset: any) => ({
          type: asset.type,
          name:
            asset.type === "player"
              ? asset.data.name || asset.data.fullName
              : `${asset.data.year} ${asset.data.round} Round Pick`,
          team:
            teams.find((t: any) => t.id === asset.fromTeam)?.displayName ||
            asset.fromTeam,
          salary: asset.type === "player" ? asset.data.salary : 0,
        })),
      },
      source: "OpenAI GPT-4o-mini",
    });
  } catch (error) {
    console.error("Error generating trades with OpenAI:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to generate trades",
      },
      { status: 500 },
    );
  }
}
