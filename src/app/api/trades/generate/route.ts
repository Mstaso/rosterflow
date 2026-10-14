import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env } from "~/env";
import {
  buildTradePrompt,
  generateVettedTrades,
  resolveTradeRequest,
} from "~/lib/trade-generator";
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

    // Re-reads the teams from the DB and, for a single offered player with
    // no partners chosen, lets the fit scorer pick them.
    const built = await buildTradePrompt(
      await resolveTradeRequest({ selectedAssets, teams, additionalTeams })
    );
    const { manualTrade, teamsAddedToTrade } = built;

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
          await generateVettedTrades(built, anthropic, (trade) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "trade", trade, index: tradeIndex })}\n\n`
              )
            );
            tradeIndex++;
          });

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
