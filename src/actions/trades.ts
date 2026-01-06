"use server";

import { z } from "zod";
import { db } from "~/server/db";

const tradeAssetSchema = z.object({
  type: z.enum(["player", "pick"]),
  teamId: z.number().int().positive(),
  targetTeamId: z.number().int().positive(),
  playerId: z.number().int().positive().optional(),
  draftPickId: z.number().int().positive().optional(),
});

const saveTradeSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  rating: z.number().min(0).max(10),
  salaryValid: z.boolean(),
  assets: z.array(tradeAssetSchema),
});

export type SaveTradeInput = z.infer<typeof saveTradeSchema>;

export async function saveTradeAction(input: SaveTradeInput) {
  const parseResult = saveTradeSchema.safeParse(input);

  if (!parseResult.success) {
    console.error("Validation errors:", parseResult.error.errors);
    throw new Error(
      `Invalid trade data: ${JSON.stringify(parseResult.error.errors)}`
    );
  }

  const { title, description, rating, salaryValid, assets } = parseResult.data;

  // Create the trade with its assets in a transaction
  const trade = await db.trade.create({
    data: {
      title,
      description,
      rating,
      salaryValid,
      assets: {
        create: assets.map((asset) => ({
          type: asset.type,
          teamId: asset.teamId,
          targetTeamId: asset.targetTeamId,
          playerId: asset.playerId ?? null,
          draftPickId: asset.draftPickId ?? null,
        })),
      },
    },
    include: {
      assets: true,
    },
  });

  return trade;
}

export async function getSavedTrades() {
  const trades = await db.trade.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      assets: {
        include: {
          player: true,
          draftPick: true,
          team: true,
          targetTeam: true,
        },
      },
    },
  });

  return trades;
}

export async function deleteTrade(tradeId: number) {
  // Delete associated assets first, then the trade
  await db.tradeAsset.deleteMany({
    where: { tradeId },
  });

  await db.trade.delete({
    where: { id: tradeId },
  });

  return { success: true };
}
