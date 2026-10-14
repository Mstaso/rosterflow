/**
 * Self-check for the scheduled data refresh. No network, no database:
 * ESPN and Prisma are both faked. Run with `pnpm check:refresh`.
 */
import assert from "node:assert/strict";
import { refreshLeagueData, shouldRefreshOn } from "../src/lib/data-refresh";

const athlete = (id: number, salary: number | null) => ({
  id,
  fullName: `Player ${id}`,
  displayName: `Player ${id}`,
  contract: salary === null ? undefined : { salary, yearsRemaining: 1 },
});
const rosterOf = (ids: number[], unsigned: number[] = []) => ({
  athletes: ids.map((id) => athlete(id, unsigned.includes(id) ? null : 5e6)),
});
const record = (wins: number, losses: number) => ({
  team: {
    record: {
      items: [{ stats: [{ name: "wins", value: wins }, { name: "losses", value: losses }] }],
    },
  },
});
const stats = (gamesBySeason: number[]) => ({
  categories: [
    {
      name: "averages",
      labels: ["GP", "PTS"],
      statistics: gamesBySeason.map((gp, i) => ({ stats: [String(gp), String(10 + i)] })),
    },
  ],
});

type Espn = {
  teams?: boolean;
  rosters: Record<string, object | null>;
  records: Record<string, object | null>;
};

function fakeFetch(espn: Espn): typeof fetch {
  return (async (url: string) => {
    const reply = (body: object | null | undefined) =>
      body ? { ok: true, json: async () => body } : { ok: false, json: async () => ({}) };
    if (url.endsWith("/teams")) {
      return reply(
        espn.teams === false
          ? null
          : { sports: [{ leagues: [{ teams: [{ team: { id: "1", slug: "a" } }, { team: { id: "2", slug: "b" } }] }] }] }
      );
    }
    const roster = /teams\/(\d+)\/roster$/.exec(url);
    if (roster) return reply(espn.rosters[roster[1]!]);
    const team = /teams\/(\d+)$/.exec(url);
    if (team) return reply(espn.records[team[1]!]);
    return reply(stats([60, 2])); // last season 60 GP, this season 2 GP
  }) as unknown as typeof fetch;
}

function fakePrisma(playerEspnIds: string[]) {
  const committed: any[] = [];
  const op = (model: string, action: string) => (args: any) => ({ model, action, args });
  return {
    committed,
    team: {
      findMany: async () => [
        { id: 1, slug: "a", abbreviation: "AAA" },
        { id: 2, slug: "b", abbreviation: "BBB" },
      ],
      update: op("team", "update"),
    },
    player: {
      findMany: async () => playerEspnIds.map((espnId, i) => ({ id: i + 1, espnId })),
      upsert: op("player", "upsert"),
      update: op("player", "update"),
      deleteMany: op("player", "deleteMany"),
    },
    tradeAsset: { updateMany: op("tradeAsset", "updateMany") },
    $transaction: async (ops: any[]) => {
      committed.push(...ops);
    },
  };
}

const ids = (from: number) => Array.from({ length: 12 }, (_, i) => from + i);
const run = async (espn: Espn, known: string[]) => {
  const prisma = fakePrisma(known);
  const result = await refreshLeagueData(prisma as any, fakeFetch(espn));
  return { result, committed: prisma.committed };
};

async function main() {
  // 1. Happy path: both teams written, departed player pruned, trades unlinked first.
  {
    const { result, committed } = await run(
      { rosters: { 1: rosterOf(ids(100)), 2: rosterOf(ids(200)) }, records: { 1: record(30, 15), 2: record(10, 35) } },
      [...ids(100).map(String), "999"]
    );
    assert.equal(result.teamsRefreshed, 2);
    assert.equal(result.playersUpserted, 24);
    assert.equal(result.playersPruned, 1);
    const deletes = committed.filter((o) => o.action === "deleteMany");
    assert.deepEqual(deletes[0].args.where.id.in, [13]);
    assert.equal(committed.at(-2).model, "tradeAsset");
    const teamA = committed.find((o) => o.model === "team" && o.args.where.id === 1);
    assert.equal(teamA.args.data.record.wins, 30);
    // Two-game current season is ignored in favour of last season's 60 games.
    const upsert = committed.find((o) => o.action === "upsert");
    assert.equal(upsert.args.update.statistics.gamesPlayed, 60);
  }

  // 2. A failed roster fetch writes nothing for that team and blocks pruning.
  {
    const { result, committed } = await run(
      { rosters: { 1: rosterOf(ids(100)), 2: null }, records: { 1: record(30, 15), 2: record(10, 35) } },
      // "200" is on the team whose fetch failed: one missing player, well under
      // the mass-disappearance guard, so only the all-teams rule protects them.
      [...ids(100).map(String), "200"]
    );
    assert.deepEqual(result.teamsFailed, ["BBB"]);
    assert.equal(result.playersPruned, 0);
    assert.ok(result.pruneSkippedReason);
    assert.ok(!committed.some((o) => o.action === "deleteMany"));
    assert.ok(!committed.some((o) => o.args.where?.id === 2 && o.model === "team"));
    assert.ok(!committed.some((o) => o.action === "upsert" && o.args.update.teamId === 2));
  }

  // 3. A gutted roster (ESPN hiccup) counts as a failure, not as 9 players waived.
  {
    const { result } = await run(
      { rosters: { 1: rosterOf(ids(100)), 2: rosterOf([200, 201]) }, records: { 1: record(30, 15), 2: record(10, 35) } },
      ["100"]
    );
    assert.deepEqual(result.teamsFailed, ["BBB"]);
  }

  // 4. 0-0 / early-season and failed records never overwrite the stored record.
  {
    const { result, committed } = await run(
      { rosters: { 1: rosterOf(ids(100)), 2: rosterOf(ids(200)) }, records: { 1: record(2, 1), 2: null } },
      []
    );
    assert.deepEqual(result.recordsKept.sort(), ["AAA", "BBB"]);
    for (const o of committed.filter((o) => o.model === "team")) {
      assert.equal(o.args.data.record, undefined);
      assert.ok(o.args.data.updatedAt instanceof Date);
    }
  }

  // 5. No current contract: known players keep theirs, unknown players are not created.
  {
    const { result, committed } = await run(
      { rosters: { 1: rosterOf(ids(100), [100, 101]), 2: rosterOf(ids(200)) }, records: { 1: record(30, 15), 2: record(10, 35) } },
      ["100"]
    );
    assert.equal(result.contractsKept, 1);
    assert.equal(result.playersSkippedNoContract, 1);
    const kept = committed.find((o) => o.model === "player" && o.args.where.espnId === "100");
    assert.equal(kept.action, "update"); // upsert would demand a contract to create with
    assert.ok(!("contract" in kept.args.data));
    assert.ok(!committed.some((o) => o.args.where?.espnId === "101"));
  }

  // 6. A mass disappearance is treated as an ESPN problem, not a mass waiver.
  {
    const known = [...ids(100), ...ids(200), ...ids(900)].map(String);
    const { result, committed } = await run(
      { rosters: { 1: rosterOf(ids(100)), 2: rosterOf(ids(200)) }, records: { 1: record(30, 15), 2: record(10, 35) } },
      known
    );
    assert.equal(result.playersPruned, 0);
    assert.ok(!committed.some((o) => o.action === "deleteMany"));
  }

  // 7. ESPN team list down: throws before touching the database.
  {
    const prisma = fakePrisma(["100"]);
    await assert.rejects(refreshLeagueData(prisma as any, fakeFetch({ teams: false, rosters: {}, records: {} })));
    assert.equal(prisma.committed.length, 0);
  }

  // 8. Cadence: daily in season, Mondays only July-September.
  assert.equal(shouldRefreshOn(new Date("2026-01-14T10:00:00Z")), true); // Wed, in season
  assert.equal(shouldRefreshOn(new Date("2026-08-12T10:00:00Z")), false); // Wed, off-season
  assert.equal(shouldRefreshOn(new Date("2026-08-10T10:00:00Z")), true); // Mon, off-season

  console.log("check-data-refresh: all checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
