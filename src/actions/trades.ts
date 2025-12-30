"use server";

import { z } from "zod";
import { db } from "~/server/db";

const schema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  rating: z.coerce.number().min(0).max(10),
  fromTeamId: z.coerce.number().int().positive().optional(),
  toTeamId: z.coerce.number().int().positive().optional(),
});

export async function saveTradeAction(formData: FormData) {
  const rawData = {
    title: formData.get("title"),
    description: formData.get("description"),
    rating: formData.get("rating"),
    fromTeamId: formData.get("fromTeamId"),
    toTeamId: formData.get("toTeamId"),
  };

  console.log("Raw form data:", rawData);

  const parseResult = schema.safeParse(rawData);

  if (!parseResult.success) {
    console.error("Validation errors:", parseResult.error.errors);
    throw new Error(
      `Invalid form data: ${JSON.stringify(parseResult.error.errors)}`
    );
  }

  const { title, description, rating, fromTeamId, toTeamId } = parseResult.data;

  // Build data object conforming to current Prisma schema
  const data: any = {
    title,
    description,
    rating,
    salaryValid: true,
  };
  if (typeof fromTeamId === "number") {
    data.fromTeam = { connect: { id: fromTeamId } };
  }
  if (typeof toTeamId === "number") {
    data.toTeam = { connect: { id: toTeamId } };
  }

  await db.trade.create({ data });
}
