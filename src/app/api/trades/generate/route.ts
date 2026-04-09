import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env } from "~/env";
import type { SelectedAsset, Team } from "~/types";
import {
  getAssetsByTeam,
  getDestinationInfo,
  getRosterContext,
  getSalaryMatchingContext,
  getStepienContext,
  getTeamOutlookContext,
  setupAdditionalTeamsForTrade,
} from "~/lib/server-utils";
import {
  generateManualTrade,
  describeManualTrade,
} from "~/lib/manual-trade-generator";
import { tradeGenerateLimiter, getClientIp } from "~/lib/rate-limit";

export const dynamic = "force-dynamic";

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

const generateTradeSchema = z.object({
  selectedAssets: z.array(z.object({
    id: z.number(),
    type: z.enum(["player", "pick"]),
    teamId: z.number(),
    targetTeamId: z.number().optional(),
  })).min(1),
  teams: z.array(z.any()).min(1),
  additionalTeams: z.array(z.any()).nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { success, remaining } = tradeGenerateLimiter.check(ip);
    if (!success) {
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded. Please try again later." },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }

    if (!env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Anthropic API key not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const parsed = generateTradeSchema.safeParse(body);
    if (!parsed.success) {
      console.log("[generate] Zod validation errors:", JSON.stringify(parsed.error.flatten()));
      return NextResponse.json(
        { success: false, error: "Selected assets and team information required" },
        { status: 400 }
      );
    }
    const { selectedAssets, teams, additionalTeams } = parsed.data;

    const involvedTeams = [...teams];

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

    const rosterContext = getRosterContext(involvedTeams, selectedAssets);
    const teamOutlookContext = getTeamOutlookContext(involvedTeams);
    const assetsDescription = getAssetsByTeam(selectedAssets, involvedTeams);
    const salaryMatchingContext = getSalaryMatchingContext(
      selectedAssets,
      involvedTeams
    );
    const stepienContext = getStepienContext(involvedTeams);

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
    manualTrade = generateManualTrade(selectedAssets, involvedTeams);
    if (manualTrade) {
      console.log("[manual-trade] SUCCESS - generated trade with", manualTrade.teams.length, "teams");
      manualTradeExclusion = `\n\nALREADY GENERATED TRADE (do NOT duplicate):\n${describeManualTrade(manualTrade)}\nGenerate 3-4 DIFFERENT scenarios.`;
    } else {
      console.log("[manual-trade] FAILED - returned null (salary matching likely failed)");
    }

    // Determine which teams are required (have selected assets or destinations) vs optional
    const requiredTeamIds = new Set<number>();
    for (const asset of selectedAssets) {
      requiredTeamIds.add(asset.teamId);
      if (asset.targetTeamId) requiredTeamIds.add(asset.targetTeamId);
    }
    const requiredTeamNames = involvedTeams
      .filter((t: Team) => requiredTeamIds.has(t.id))
      .map((t: Team) => t.displayName);
    const optionalTeamNames = involvedTeams
      .filter((t: Team) => !requiredTeamIds.has(t.id))
      .map((t: Team) => t.displayName);

    let teamParticipationRule: string;
    if (optionalTeamNames.length === 0) {
      // All teams have selected assets — all must appear
      teamParticipationRule = `- ALL teams listed above MUST appear in every scenario — do not drop any team`;
    } else {
      teamParticipationRule = `- REQUIRED teams (must appear in every scenario): ${requiredTeamNames.join(", ")}
- OPTIONAL trade partners (available to use but not required in every scenario): ${optionalTeamNames.join(", ")}
- Use at least one optional team when it makes the trade more realistic, but not every scenario needs all of them
- Vary which optional teams you include across scenarios for diversity`;
    }

    const prompt = `Generate 3-4 realistic 2025-26 NBA trade scenarios using the data below. Think like a real GM — contenders trade picks for win-now talent, rebuilding teams trade veterans for young players and draft capital.

TEAM OUTLOOK:
${teamOutlookContext}

SELECTED ASSETS (must appear in every scenario):
${assetsDescription}${destinationInfo}

${salaryMatchingContext}

ROSTERS & PICKS (top players by rating, pick value 1-100):
${rosterContext}

SALARY MATCHING INSTRUCTIONS:
- Each team's section above shows their cap tier, the formula for matching, and pre-computed bounds for the selected assets
- If you add more outgoing players from a team, recalculate the matching window using the formula provided
- Add up total outgoing salary, then apply the formula to get the valid incoming range
- Make sure each team's total incoming salary falls within their valid range
- SECOND APRON teams: one-for-one only (cannot combine multiple players' salaries)
${stepienContext}
TRADE REALISM RULES:
- Every asset received must be given by another team (balanced trades)
- A player can only be traded to ONE team — never send the same player to multiple teams
- A draft pick can only be traded to ONE team — never send the same pick to multiple teams
- Only use players listed above
- Use player names EXACTLY as they appear in the roster data — do not abbreviate, add suffixes, or change spelling
- Use exact team names as shown in the data (e.g. "Brooklyn Nets", not "Nets" or "BKN")
- Format picks exactly as "2026 R1" or "2027 R2" (year + space + R + round number)
- You SHOULD add additional players or picks beyond the selected assets when it makes the trade more realistic, improves salary matching, or balances value. Don't just swap the selected assets 1-for-1 if a real GM would include sweeteners or salary filler.
- Use [rating:X] to judge player value — total ratings traded should be roughly balanced for each side. A team giving up a [rating:80 All-Star] should get back comparable combined value.
- Use [contract: tag] to assess trade incentives:
  • "elite value" / "good value" = team-friendly deal, premium trade asset
  • "fair" = market rate, neutral
  • "overpaid" / "negative" = team may need to attach picks or young assets to move this player
  • "expiring" = valuable for cap relief even if overpaid
- Contenders should not give up key contributors (high rating) without getting equivalent win-now help back.
- Rebuilding teams should prioritize getting picks, young players, and "elite value" / "good value" contracts.
${teamParticipationRule}
- Pick [val:X] indicates estimated value (1-100). Use this to assess trade fairness — higher value picks are worth more.${hasDestinations ? "\n- You MUST follow the destination preferences listed above. These are required, not suggestions." : ""}

VARIETY: Make each scenario meaningfully different — vary which additional players/picks are included and mix approaches (e.g. one pick-heavy deal, one player-for-player swap).${manualTradeExclusion}

Respond with ONLY a JSON array. Each scenario lists only what each team GIVES and where it goes (the "to" field). Do NOT include a "receives" section — it will be derived automatically.
[
  {
    "teams": [
      {
        "teamName": "Team Name",
        "gives": {
          "players": [{"name": "Player Name", "type": "player", "to": "Other Team"}],
          "picks": [{"name": "2026 R1", "type": "pick", "to": "Other Team"}]
        }
      }
    ]
  }
]`;

    // Build receives from gives — eliminates mismatch bugs
    function reconstructReceives(trade: any): any {
      if (!trade?.teams || !Array.isArray(trade.teams)) return trade;

      // Save any AI-provided receives as fallback before overwriting
      const originalReceives = new Map<string, any>();
      for (const team of trade.teams) {
        if (team.receives && (team.receives.players?.length > 0 || team.receives.picks?.length > 0)) {
          originalReceives.set(team.teamName, structuredClone(team.receives));
        }
      }

      // Initialize empty receives for all teams
      for (const team of trade.teams) {
        team.receives = { players: [], picks: [] };
      }

      // Normalize: move any picks mistakenly placed in gives.players to gives.picks
      for (const team of trade.teams) {
        if (team.gives?.players) {
          const actualPlayers: any[] = [];
          for (const item of team.gives.players) {
            if (item.type === "pick") {
              if (!team.gives.picks) team.gives.picks = [];
              team.gives.picks.push(item);
            } else {
              actualPlayers.push(item);
            }
          }
          team.gives.players = actualPlayers;
        }
      }

      // Helper: find destination team for an asset, inferring if "to" is missing
      function findDestination(asset: any, sourceTeam: any): any {
        // If "to" is provided, use it
        if (asset.to) {
          return trade.teams.find((t: any) => t.teamName === asset.to);
        }
        // For 2-team trades, the destination is the other team
        if (trade.teams.length === 2) {
          return trade.teams.find((t: any) => t.teamName !== sourceTeam.teamName);
        }
        // Multi-team trade with no "to" — can't infer
        return null;
      }

      // For each team's gives, add to the destination team's receives
      for (const team of trade.teams) {
        for (const player of team.gives?.players || []) {
          const destTeam = findDestination(player, team);
          if (destTeam) {
            destTeam.receives.players.push({
              name: player.name,
              type: "player",
              from: team.teamName,
            });
          } else {
            console.log(`[reconstruct] WARNING: could not determine destination for player "${player.name}" from ${team.teamName}`);
          }
        }
        for (const pick of team.gives?.picks || []) {
          const destTeam = findDestination(pick, team);
          if (destTeam) {
            destTeam.receives.picks.push({
              name: pick.name,
              type: "pick",
              from: team.teamName,
            });
          } else {
            console.log(`[reconstruct] WARNING: could not determine destination for pick "${pick.name}" from ${team.teamName}`);
          }
        }
      }

      // Fallback: for multi-team trades, if reconstruction left a team with empty
      // receives but the AI had provided receives, use the AI's version
      if (trade.teams.length > 2) {
        for (const team of trade.teams) {
          const hasReconstructed = team.receives.players.length > 0 || team.receives.picks.length > 0;
          if (!hasReconstructed && originalReceives.has(team.teamName)) {
            console.log(`[reconstruct] Using AI-provided receives for ${team.teamName} (reconstruction failed)`);
            team.receives = originalReceives.get(team.teamName);
          }
        }
      }

      // Clean up: remove "to" from gives (client doesn't expect it)
      for (const team of trade.teams) {
        if (team.gives?.players) {
          team.gives.players = team.gives.players.map((p: any) => ({
            name: p.name,
            type: p.type,
          }));
        }
        if (team.gives?.picks) {
          team.gives.picks = team.gives.picks.map((p: any) => ({
            name: p.name,
            type: p.type,
          }));
        }
      }

      return trade;
    }

    // Validate trade: no duplicate gives, and every team gives/receives something
    function isValidTrade(trade: any): boolean {
      if (!trade?.teams || !Array.isArray(trade.teams)) return false;

      const givenPlayers = new Set<string>();
      const givenPicks = new Set<string>();

      for (const team of trade.teams) {
        for (const player of team.gives?.players || []) {
          const name = player.name?.toLowerCase().trim();
          if (!name) continue;
          if (givenPlayers.has(name)) {
            console.log(`[trade-validation] REJECTED: player "${player.name}" given by multiple teams`);
            return false;
          }
          givenPlayers.add(name);
        }

        for (const pick of team.gives?.picks || []) {
          const name = pick.name?.toLowerCase().trim();
          if (!name) continue;
          if (givenPicks.has(name)) {
            console.log(`[trade-validation] REJECTED: pick "${pick.name}" given by multiple teams`);
            return false;
          }
          givenPicks.add(name);
        }

        // Every team must give something
        const givesCount = (team.gives?.players?.length || 0) + (team.gives?.picks?.length || 0);
        if (givesCount === 0) {
          console.log(`[trade-validation] REJECTED: ${team.teamName} gives nothing`);
          return false;
        }
      }

      return true;
    }

    // Stream the response using SSE
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      system: "You are an expert NBA trade analyst and salary cap specialist. Generate realistic trade scenarios that a real front office would consider — weigh team windows (contending vs rebuilding), player production (stats), age curves, and contract value. Use only the provided roster data. Respond with valid JSON only — no markdown, no explanations.",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 5500,
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
          for await (const event of stream) {
            if (event.type !== "content_block_delta" || event.delta.type !== "text_delta") continue;
            const content = event.delta.text;
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
                    let trade = JSON.parse(tradeJson);
                    if (!isValidTrade(trade)) {
                      console.log(`[trade-validation] Skipping invalid trade scenario ${tradeIndex}`);
                    } else {
                      trade = reconstructReceives(trade);
                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({ type: "trade", trade, index: tradeIndex })}\n\n`
                        )
                      );
                      tradeIndex++;
                    }
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
              for (let trade of trades) {
                if (!isValidTrade(trade)) {
                  console.log(`[trade-validation] Skipping invalid trade scenario ${tradeIndex} (full parse)`);
                  continue;
                }
                trade = reconstructReceives(trade);
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
    console.error("Error generating trades with Anthropic:", error);
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
