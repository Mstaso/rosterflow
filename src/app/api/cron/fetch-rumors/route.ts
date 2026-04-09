import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { fetchAllRSSRumors } from "~/lib/rumor-sources/rss";
import { fetchRedditRumors } from "~/lib/rumor-sources/reddit";
import {
  extractEntities,
  type PlayerRef,
  type TeamRef,
} from "~/lib/rumor-sources/extract-entities";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    // Fetch from all sources in parallel
    const [rssRumors, redditRumors] = await Promise.all([
      fetchAllRSSRumors(),
      fetchRedditRumors(),
    ]);

    let totalFetched = rssRumors.length + redditRumors.length;
    let totalNew = 0;

    // Upsert RSS rumors
    for (const rumor of rssRumors) {
      const existing = await db.rumorItem.findUnique({
        where: { externalId: rumor.externalId },
      });
      if (!existing) {
        await db.rumorItem.create({
          data: {
            externalId: rumor.externalId,
            source: rumor.source,
            sourceType: rumor.sourceType,
            title: rumor.title,
            summary: rumor.summary,
            url: rumor.url,
            author: rumor.author,
            publishedAt: rumor.publishedAt,
          },
        });
        totalNew++;
      }
    }

    // Upsert Reddit rumors (update score for existing)
    for (const rumor of redditRumors) {
      const existing = await db.rumorItem.findUnique({
        where: { externalId: rumor.externalId },
      });
      if (existing) {
        await db.rumorItem.update({
          where: { id: existing.id },
          data: { redditScore: rumor.redditScore },
        });
      } else {
        await db.rumorItem.create({
          data: {
            externalId: rumor.externalId,
            source: rumor.source,
            sourceType: rumor.sourceType,
            title: rumor.title,
            summary: rumor.summary,
            url: rumor.url,
            author: rumor.author,
            publishedAt: rumor.publishedAt,
            redditScore: rumor.redditScore,
          },
        });
        totalNew++;
      }
    }

    // Run entity extraction on unprocessed items (max 30 per run)
    const unextracted = await db.rumorItem.findMany({
      where: { extractedAt: null },
      orderBy: { publishedAt: "desc" },
      take: 30,
    });

    if (unextracted.length > 0) {
      // Load player and team reference data once
      const players: PlayerRef[] = await db.player.findMany({
        select: { id: true, displayName: true, lastName: true, teamId: true },
      });
      const teams: TeamRef[] = await db.team.findMany({
        select: {
          id: true,
          displayName: true,
          abbreviation: true,
          nickname: true,
        },
      });

      for (const rumor of unextracted) {
        const entities = await extractEntities(
          rumor.title,
          rumor.summary,
          players,
          teams
        );

        if (entities.length > 0) {
          await db.rumorEntity.createMany({
            data: entities.map((e) => ({
              rumorId: rumor.id,
              entityType: e.entityType,
              entityName: e.entityName,
              playerId: e.playerId,
              teamId: e.teamId,
            })),
            skipDuplicates: true,
          });
        }

        await db.rumorItem.update({
          where: { id: rumor.id },
          data: { extractedAt: new Date() },
        });
      }
    }

    // Cleanup: delete rumors older than 30 days
    await db.rumorItem.deleteMany({
      where: {
        publishedAt: {
          lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    });

    const durationMs = Date.now() - startTime;

    // Log the fetch
    await db.rumorFetchLog.create({
      data: {
        source: "all",
        status: "success",
        itemsFetched: totalFetched,
        itemsNew: totalNew,
        durationMs,
      },
    });

    return NextResponse.json({
      success: true,
      fetched: totalFetched,
      new: totalNew,
      extracted: unextracted.length,
      durationMs,
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const message =
      error instanceof Error ? error.message : "Unknown error";

    await db.rumorFetchLog.create({
      data: {
        source: "all",
        status: "error",
        errorMessage: message,
        durationMs,
      },
    });

    console.error("Cron fetch-rumors failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
