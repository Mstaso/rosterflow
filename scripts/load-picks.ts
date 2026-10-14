/**
 * Load prisma/seeddata/draft_picks.json into DraftPick without wiping saved
 * trades: `pnpm db:load-picks`. Run scrapers/realgm_draft_picks.py first.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { loadDraftPicks, type DraftPickFile } from "../src/lib/draft-picks";

const prisma = new PrismaClient();
const data = JSON.parse(readFileSync("prisma/seeddata/draft_picks.json", "utf8")) as DraftPickFile;

loadDraftPicks(prisma, data)
  .then((r) => {
    console.log(`Loaded ${r.picks} picks for ${r.teams} teams (scraped ${data.scrapedAt}); removed ${r.removed} stale rows.`);
    if (r.mismatches) {
      console.log(`${r.mismatches} slots disagreed with RealGM's counts when scraped — see "mismatches" in the JSON.`);
    }
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
