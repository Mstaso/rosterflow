/**
 * Run the ESPN refresh by hand against whatever DATABASE_URL points at:
 * `pnpm db:refresh`. Same code path as the cron route.
 */
import { PrismaClient } from "@prisma/client";
import { getDataFreshness, refreshLeagueData } from "../src/lib/data-refresh";

const prisma = new PrismaClient();

refreshLeagueData(prisma)
  .then(async (result) => {
    console.log(JSON.stringify({ ...result, freshness: await getDataFreshness(prisma) }, null, 2));
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
