import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env } from "~/env";
import {
  buildTradePrompt,
  streamTradesFromAnthropic,
  TRADE_MODEL,
  TRADE_TEMPERATURE,
  TRADE_MAX_TOKENS,
} from "~/lib/trade-generator";
import { tradeGenerateLimiter, getClientIp } from "~/lib/rate-limit";
import { pickFitPartners, type FitPartner } from "~/lib/target-asset-scorer";
import { db } from "~/lib/db";
import type { Player, Team } from "~/types";

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
    const { success } = tradeGenerateLimiter.check(ip);
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

    if (teams.length > 5) {
      return NextResponse.json(
        { success: false, error: "Maximum of 5 teams allowed" },
        { status: 400 }
      );
    }

    // Fit-based partner selection: when the user offered exactly one player
    // from one team and didn't pick partners themselves, score the league for
    // plausible target assets and use the owning teams as partners. This
    // replaces the prior client-side Math.random() shuffle.
    let resolvedAdditionalTeams: Team[] | null = additionalTeams ?? null;
    let suggestedPackages: FitPartner[] | null = null;
    const onlySingleAsset = selectedAssets.length === 1;
    const onlySingleTeam = teams.length === 1;
    const noClientPartners = !additionalTeams || additionalTeams.length === 0;
    const offeredAsset = selectedAssets[0];

    if (
      onlySingleAsset &&
      onlySingleTeam &&
      noClientPartners &&
      offeredAsset?.type === "player"
    ) {
      const sellerTeam = teams[0] as Team;
      const offered = (sellerTeam.players ?? []).find(
        (p: Player) => p.id === offeredAsset.id
      );
      if (offered) {
        const allTeams = (await db.teams.getAllWithRosters()) as unknown as Team[];
        const otherTeams = allTeams.filter((t) => t.id !== sellerTeam.id);
        const partners = pickFitPartners(offered, sellerTeam, otherTeams);
        if (partners.length > 0) {
          resolvedAdditionalTeams = partners.map((p) => p.team);
          suggestedPackages = partners;
        }
      }
    }

    const { prompt, system, manualTrade, teamsAddedToTrade, involvedTeams } =
      await buildTradePrompt({
        selectedAssets,
        teams,
        additionalTeams: resolvedAdditionalTeams,
        suggestedPackages,
      });

      console.log("[generate] prompt:", prompt);
    // Stream the response using SSE
    const stream = anthropic.messages.stream({
      model: TRADE_MODEL,
      system,
      messages: [{ role: "user", content: prompt }],
      temperature: TRADE_TEMPERATURE,
      max_tokens: TRADE_MAX_TOKENS,
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

        try {
          await streamTradesFromAnthropic(
            stream,
            (trade) => {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "trade", trade, index: tradeIndex })}\n\n`
                )
              );
              tradeIndex++;
            },
            involvedTeams
          );

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
