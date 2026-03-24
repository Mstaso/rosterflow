import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { env } from "~/env";
import type { SelectedAsset, Team } from "~/types";
import {
  getAssetsByTeam,
  getDestinationInfo,
  getRosterContext,
  getSalaryMatchingContext,
  getTeamOutlookContext,
  setupAdditionalTeamsForTrade,
} from "~/lib/server-utils";
import {
  generateManualTrade,
  describeManualTrade,
} from "~/lib/manual-trade-generator";

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
    const teamOutlookContext = getTeamOutlookContext(involvedTeams);
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

    // Generate manual first trade (algorithmic, instant result)
    let manualTrade: ReturnType<typeof generateManualTrade> = null;
    let manualTradeExclusion = "";
    console.log("[manual-trade] Attempting manual trade generation...");
    console.log("[manual-trade] Selected assets:", JSON.stringify(selectedAssets.map((a: SelectedAsset) => ({ id: a.id, type: a.type, teamId: a.teamId, targetTeamId: a.targetTeamId }))));
    console.log("[manual-trade] Involved teams:", involvedTeams.map((t: Team) => `${t.displayName} (id:${t.id})`).join(", "));
    manualTrade = generateManualTrade(selectedAssets, involvedTeams);
    if (manualTrade) {
      console.log("[manual-trade] SUCCESS - generated trade with", manualTrade.teams.length, "teams");
      manualTradeExclusion = `\n\nALREADY GENERATED TRADE (do NOT duplicate):\n${describeManualTrade(manualTrade)}\nGenerate 3-4 DIFFERENT scenarios.`;
    } else {
      console.log("[manual-trade] FAILED - returned null (salary matching likely failed)");
    }

    const prompt = `Generate 3-4 realistic 2025-26 NBA trade scenarios using the data below. Think like a real GM — contenders trade picks for win-now talent, rebuilding teams trade veterans for young players and draft capital.

TEAM OUTLOOK:
${teamOutlookContext}

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

TRADE REALISM RULES:
- Every asset received must be given by another team (balanced trades)
- Only use players listed above
- You SHOULD add additional players or picks beyond the selected assets when it makes the trade more realistic, improves salary matching, or balances value. Don't just swap the selected assets 1-for-1 if a real GM would include sweeteners or salary filler.
- Use player stats (ppg/rpg/apg) to judge value. A 15ppg starter is worth more than a 5ppg bench player at the same salary.
- Contenders should not give up key contributors (high ppg) without getting equivalent win-now help back.
- Rebuilding teams should prioritize getting picks and young players.
- 2-5 teams per trade${hasDestinations ? "\n- Respect destination preferences when possible" : ""}
- Pick [val:X] indicates estimated value (1-100). Use this to assess trade fairness — higher value picks are worth more.

VARIETY: Make each scenario meaningfully different — vary which additional players/picks are included, try different team pairings if 3+ teams are involved, and mix approaches (e.g. one pick-heavy deal, one player-for-player swap, one three-team trade).${manualTradeExclusion}

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

    // Stream the response using SSE
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert NBA trade analyst and salary cap specialist. Generate realistic trade scenarios that a real front office would consider — weigh team windows (contending vs rebuilding), player production (stats), age curves, and contract value. Use only the provided roster data. Respond with valid JSON only — no markdown, no explanations.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_completion_tokens: 4000,
      stream: true,
    });

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        // Send teamsAddedToTrade as the first event so the client has them
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "meta", teamsAddedToTrade })}\n\n`
          )
        );

        let accumulated = "";
        let tradeIndex = 0;

        // Emit manual trade as the first trade event (instant result)
        if (manualTrade) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "trade", trade: manualTrade, index: tradeIndex })}\n\n`
            )
          );
          tradeIndex++;
        }

        // State machine for tracking position in JSON
        let inString = false;
        let escapeNext = false;
        let arrayFound = false;
        let braceDepth = 0;
        let currentTradeStart = -1;
        let scanPos = 0; // Where we left off scanning

        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (!content) continue;

            accumulated += content;

            // Scan new characters from where we left off
            while (scanPos < accumulated.length) {
              const char = accumulated[scanPos];

              if (escapeNext) {
                escapeNext = false;
                scanPos++;
                continue;
              }

              if (inString) {
                if (char === "\\") {
                  escapeNext = true;
                } else if (char === '"') {
                  inString = false;
                }
                scanPos++;
                continue;
              }

              // Not in a string
              if (char === '"') {
                inString = true;
                scanPos++;
                continue;
              }

              if (char === "[" && !arrayFound) {
                arrayFound = true;
                scanPos++;
                continue;
              }

              if (!arrayFound) {
                scanPos++;
                continue;
              }

              if (char === "{") {
                if (braceDepth === 0) {
                  currentTradeStart = scanPos;
                }
                braceDepth++;
              } else if (char === "}") {
                braceDepth--;
                if (braceDepth === 0 && currentTradeStart >= 0) {
                  const tradeJson = accumulated.substring(
                    currentTradeStart,
                    scanPos + 1
                  );
                  currentTradeStart = -1;

                  try {
                    const trade = JSON.parse(tradeJson);
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ type: "trade", trade, index: tradeIndex })}\n\n`
                      )
                    );
                    tradeIndex++;
                  } catch (e) {
                    console.error(
                      "Failed to parse trade chunk:",
                      (e as Error).message
                    );
                  }
                }
              }

              scanPos++;
            }
          }

          // If no trades were parsed from streaming, try parsing the full response
          if (tradeIndex === 0 && accumulated.length > 0) {
            console.log("No trades parsed incrementally, trying full parse...");
            try {
              let cleaned = accumulated.trim();
              if (cleaned.startsWith("```json")) {
                cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
              } else if (cleaned.startsWith("```")) {
                cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
              }
              const parsed = JSON.parse(cleaned);
              const trades = Array.isArray(parsed)
                ? parsed
                : parsed.trades || parsed.scenarios || [];
              for (const trade of trades) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "trade", trade, index: tradeIndex })}\n\n`
                  )
                );
                tradeIndex++;
              }
            } catch (e) {
              console.error("Full parse also failed:", (e as Error).message);
              console.error("Accumulated:", accumulated.substring(0, 500));
            }
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "done", totalTrades: tradeIndex })}\n\n`
            )
          );
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", error: error instanceof Error ? error.message : "Stream failed" })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
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
