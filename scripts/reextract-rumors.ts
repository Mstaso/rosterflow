/**
 * One-shot backfill: re-run the LLM classifier on every existing RumorItem,
 * deleting old entities and writing fresh entities + rumorType + isTradeRelevant.
 *
 * Usage:  pnpm tsx scripts/reextract-rumors.ts
 */
import "./_load-env";
import { db } from "~/server/db";
import {
  extractEntities,
  type PlayerRef,
  type TeamRef,
} from "~/lib/rumor-sources/extract-entities";

async function main() {
  const rumors = await db.rumorItem.findMany({
    orderBy: { publishedAt: "desc" },
  });
  console.log(`Re-classifying ${rumors.length} rumors...`);

  const players: PlayerRef[] = await db.player.findMany({
    select: { id: true, displayName: true, lastName: true, teamId: true },
  });
  const teams: TeamRef[] = await db.team.findMany({
    select: { id: true, displayName: true, abbreviation: true, nickname: true },
  });

  let relevant = 0;
  let irrelevant = 0;

  for (const rumor of rumors) {
    // No persisted fullText for past items — use summary as the body fallback.
    const { entities, rumorType, isTradeRelevant } = await extractEntities(
      rumor.title,
      rumor.summary,
      players,
      teams
    );

    await db.rumorEntity.deleteMany({ where: { rumorId: rumor.id } });
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
      data: { extractedAt: new Date(), rumorType, isTradeRelevant },
    });

    if (isTradeRelevant) relevant++;
    else irrelevant++;

    console.log(
      `[${rumor.id}] ${isTradeRelevant ? "Y" : "N"} ${rumorType.padEnd(11)} ` +
        `players=${entities.filter((e) => e.entityType === "player").length} ` +
        `teams=${entities.filter((e) => e.entityType === "team").length}  ` +
        rumor.title.slice(0, 80)
    );
  }

  console.log(
    `\nDone. ${relevant} trade-relevant, ${irrelevant} hidden as off-topic.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
