/**
 * Core trade generation helpers extracted from the /api/trades/generate route.
 *
 * These are pure functions so they can be reused by the eval harness
 * (src/app/api/trades/eval) without going through the HTTP/SSE shell.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { SelectedAsset, Team } from "~/types";
import {
  getAssetsByTeam,
  getDestinationInfo,
  getRosterContext,
  getStepienContext,
  getTeamOutlookContext,
  setupAdditionalTeamsForTrade,
  getCapTier,
} from "~/lib/server-utils";
import {
  generateManualTrade,
  describeManualTrade,
} from "~/lib/manual-trade-generator";
import {
  classifyTeamRoles,
  formatRolesContext,
  FACILITATOR_MAX_INCOMING_RATING,
} from "~/lib/team-role-classifier";
import { refineTradeSalary } from "~/lib/trade-refinement";

export const TRADE_SYSTEM_PROMPT =
  "You are an expert NBA trade analyst and salary cap specialist. Generate realistic trade scenarios that a real front office would consider — weigh team windows (contending vs rebuilding), player production (stats), age curves, and contract value. Use only the provided roster data. Respond with valid JSON only — no markdown, no explanations.";

export const TRADE_MODEL = "claude-sonnet-4-6";
export const TRADE_TEMPERATURE = 0.7;
export const TRADE_MAX_TOKENS = 5500;

export interface BuildPromptInput {
  selectedAssets: SelectedAsset[];
  teams: Team[];
  additionalTeams?: Team[] | null;
}

export interface BuildPromptResult {
  prompt: string;
  system: string;
  manualTrade: ReturnType<typeof generateManualTrade>;
  teamsAddedToTrade: Team[];
  involvedTeams: Team[];
}

/**
 * Build the full Claude prompt + run the manual (algorithmic) generator.
 * Returns everything the caller needs to invoke the Anthropic SDK and stream
 * results.
 */
export async function buildTradePrompt(
  input: BuildPromptInput
): Promise<BuildPromptResult> {
  const { selectedAssets, teams, additionalTeams } = input;

  const involvedTeams: Team[] = [...teams];
  let teamsAddedToTrade: Team[] = [];

  if (additionalTeams && additionalTeams.length > 0) {
    const teamWithRosterAndPicks = (await setupAdditionalTeamsForTrade(
      additionalTeams
    )) as unknown as Team[];
    const hydrated = teamWithRosterAndPicks.filter((t): t is Team => !!t);
    involvedTeams.push(...hydrated);
    teamsAddedToTrade = hydrated;
  }

  const rosterContext = getRosterContext(involvedTeams, selectedAssets);
  const teamOutlookContext = getTeamOutlookContext(involvedTeams);
  const assetsDescription = getAssetsByTeam(selectedAssets, involvedTeams);
  const stepienContext = getStepienContext(involvedTeams);

  // Minimal cap-tier tags — exact matching math is handled post-generation by
  // the refiner. We only surface SECOND_APRON because it's a structural (not
  // arithmetic) constraint: those teams cannot aggregate salaries.
  const capTierTags = involvedTeams
    .map((t) => {
      const tier = getCapTier(t);
      const name = (t as any).displayName ?? t.name;
      return `- ${name}: ${tier}`;
    })
    .join("\n");
  const hasSecondApron = involvedTeams.some(
    (t) => getCapTier(t) === "SECOND_APRON"
  );

  const hasDestinations = selectedAssets.some((asset) => asset.targetTeamId);
  let destinationInfo = "";
  if (hasDestinations) {
    destinationInfo = getDestinationInfo(selectedAssets, involvedTeams);
  }

  // Generate manual first trade (algorithmic, instant result)
  const manualTrade = generateManualTrade(selectedAssets, involvedTeams);
  let manualTradeExclusion = "";
  if (manualTrade) {
    console.log(
      "[manual-trade] SUCCESS - generated trade with",
      manualTrade.teams.length,
      "teams"
    );
    manualTradeExclusion = `\n\nALREADY GENERATED TRADE (do NOT duplicate):\n${describeManualTrade(
      manualTrade
    )}\nGenerate 3-4 DIFFERENT scenarios.`;
  } else {
    console.log(
      "[manual-trade] FAILED - returned null (salary matching likely failed)"
    );
  }

  // Required teams = teams with a selected asset OR an explicit targetTeamId.
  // Everything else (client-added partners, eval-provided additionalTeams
  // without explicit intent) is OPTIONAL — the model uses them only if they
  // make the trade better. Forcing unrequested partners into every scenario
  // was producing unrealistic 4-team mega trades in the single-selection flow.
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

  // Role classifier: keep as informational labels (STAR_HOLDER / FACILITATOR /
  // SWAP_PARTNER) when optional partners exist, so the model understands how
  // each partner could fit. We no longer force participation from it.
  let rolesContext = "";
  let hasFacilitator = false;
  if (teamsAddedToTrade.length > 0) {
    const additionalTeamIds = new Set(teamsAddedToTrade.map((t) => t.id));
    const teamRoles = classifyTeamRoles(
      selectedAssets,
      involvedTeams,
      additionalTeamIds
    );
    rolesContext = formatRolesContext(teamRoles);
    hasFacilitator = teamRoles.some((r) => r.role === "FACILITATOR");
  }

  let teamParticipationRule: string;
  if (optionalTeamNames.length === 0) {
    teamParticipationRule = `- ALL teams listed above MUST appear in every scenario — do not drop any team`;
  } else {
    teamParticipationRule = `- REQUIRED teams (must appear in every scenario): ${requiredTeamNames.join(", ")}
- OPTIONAL trade partners (available if — and ONLY if — they make the trade better): ${optionalTeamNames.join(", ")}
- Prefer simpler trades. Only involve an optional team when it unlocks salary matching, provides a needed role player, or creates a clearly better deal than a 2-team version
- Do NOT add optional teams just for variety; a clean 2-team trade beats a forced 3-team trade
- It is fine for multiple scenarios to involve the same subset of teams if that's what makes the trades best`;
  }

  const prompt = `Generate 3-4 realistic 2025-26 NBA trade scenarios using the data below. Think like a real GM — contenders trade picks for win-now talent, rebuilding teams trade veterans for young players and draft capital.

TEAM OUTLOOK:
${teamOutlookContext}
${rolesContext ? `\n${rolesContext}\n` : ""}
SELECTED ASSETS (must appear in every scenario):
${assetsDescription}${destinationInfo}

TEAM CAP TIERS:
${capTierTags}

ROSTERS & PICKS (top players by rating, pick value 1-100):
${rosterContext}

SALARY MATCHING:
- Rough salary balance is handled automatically after generation — small mismatches will be fixed by adding a filler player. Do not obsess over exact cap math.
- Focus your attention on FIT and VALUE: who should acquire this player, what they realistically pay, which contracts make sense together.
- Keep each team's outgoing salary roughly in the same order of magnitude as their incoming salary — don't pair a $40M star with a $2M minimum-contract return.${hasSecondApron ? "\n- SECOND_APRON teams (see TEAM CAP TIERS above) cannot aggregate salaries — they must do a one-for-one swap where incoming ≤ outgoing." : ""}
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
- Rebuilding teams should prioritize getting picks, young players, and "elite value" / "good value" contracts.${hasFacilitator ? `\n- FACILITATOR teams (see TEAM ROLES above) MUST NOT receive any player rated ${FACILITATOR_MAX_INCOMING_RATING}+ — they accept only picks, expiring contracts, or role players. Their payment is typically a 2nd-round pick or minor asset in exchange for taking on salary.` : ""}
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

  return {
    prompt,
    system: TRADE_SYSTEM_PROMPT,
    manualTrade,
    teamsAddedToTrade,
    involvedTeams,
  };
}

/**
 * Parse Anthropic streaming output into complete trade objects.
 *
 * Scans the SSE text deltas for top-level `{...}` objects inside the outer
 * JSON array and invokes `onTrade` for each one that passes validation and
 * receives-reconstruction.
 */
export async function streamTradesFromAnthropic(
  stream: ReturnType<typeof Anthropic.prototype.messages.stream>,
  onTrade: (trade: any) => void,
  /**
   * Optional: hydrated teams used for post-generation salary refinement.
   * If omitted, the refiner is skipped (back-compat).
   */
  involvedTeams?: Team[]
): Promise<{ accumulated: string; parsedCount: number }> {
  let accumulated = "";
  let parsedCount = 0;

  // State machine for tracking position in JSON
  let inString = false;
  let escapeNext = false;
  let arrayFound = false;
  let braceDepth = 0;
  let currentTradeStart = -1;
  let scanPos = 0;

  for await (const event of stream) {
    if (
      event.type !== "content_block_delta" ||
      event.delta.type !== "text_delta"
    )
      continue;
    const content = event.delta.text;
    if (!content) continue;

    accumulated += content;

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
              console.log(
                `[trade-validation] Skipping invalid trade scenario ${parsedCount}`
              );
            } else {
              trade = reconstructReceives(trade);
              if (involvedTeams) {
                const result = refineTradeSalary(trade, involvedTeams);
                trade = result.trade;
                if (result.refined) {
                  console.log(
                    `[trade-refine] scenario ${parsedCount}: ${result.notes.join("; ")}`
                  );
                }
              }
              onTrade(trade);
              parsedCount++;
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
  if (parsedCount === 0 && accumulated.length > 0) {
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
          console.log(
            `[trade-validation] Skipping invalid trade scenario ${parsedCount} (full parse)`
          );
          continue;
        }
        trade = reconstructReceives(trade);
        if (involvedTeams) {
          const result = refineTradeSalary(trade, involvedTeams);
          trade = result.trade;
          if (result.refined) {
            console.log(
              `[trade-refine] scenario ${parsedCount} (full parse): ${result.notes.join("; ")}`
            );
          }
        }
        onTrade(trade);
        parsedCount++;
      }
    } catch (e) {
      console.error("Full parse also failed:", (e as Error).message);
      console.error("Accumulated:", accumulated.substring(0, 500));
    }
  }

  return { accumulated, parsedCount };
}

/**
 * Full non-streaming generator: builds the prompt, runs Anthropic, collects
 * all valid trades into an array. Used by the eval harness.
 *
 * The caller provides its own Anthropic instance so env/key config stays in
 * one place.
 */
export async function generateTradesCore(
  input: BuildPromptInput,
  anthropic: Anthropic
): Promise<{
  manualTrade: ReturnType<typeof generateManualTrade>;
  aiTrades: any[];
  teamsAddedToTrade: Team[];
  involvedTeams: Team[];
}> {
  const built = await buildTradePrompt(input);

  const stream = anthropic.messages.stream({
    model: TRADE_MODEL,
    system: built.system,
    messages: [{ role: "user", content: built.prompt }],
    temperature: TRADE_TEMPERATURE,
    max_tokens: TRADE_MAX_TOKENS,
  });

  const aiTrades: any[] = [];
  await streamTradesFromAnthropic(
    stream,
    (trade) => {
      aiTrades.push(trade);
    },
    built.involvedTeams
  );

  return {
    manualTrade: built.manualTrade,
    aiTrades,
    teamsAddedToTrade: built.teamsAddedToTrade,
    involvedTeams: built.involvedTeams,
  };
}

/**
 * Rebuild each team's `receives` from all teams' `gives`.
 *
 * Eliminates mismatch bugs where the AI returns inconsistent gives/receives.
 * Also normalizes picks that the AI mistakenly placed in gives.players, and
 * falls back to AI-provided receives for multi-team trades when destinations
 * can't be inferred.
 */
export function reconstructReceives(trade: any): any {
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

/**
 * Validate a trade's structural integrity:
 * - no player given by multiple teams
 * - no pick given by multiple teams
 * - every team gives at least one asset
 */
export function isValidTrade(trade: any): boolean {
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
