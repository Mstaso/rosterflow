/**
 * Self-check for the trade legality checker. No network, no database.
 * Run with `pnpm check:legality`.
 */
import assert from "node:assert/strict";
import { checkTradeLegality, pickLabel, tradablePicks } from "../src/lib/trade-legality";
import { repairTrade } from "../src/lib/trade-repair";

const NOW = new Date("2026-10-13T00:00:00Z"); // next draft: 2027

let nextId = 1;
const player = (fullName: string, salaryM: number) =>
  ({ id: nextId++, fullName, contract: { salary: salaryM * 1e6 } }) as any;
const pick = (year: number, round: number, description = "Own") =>
  ({ id: nextId++, year, round, description }) as any;
const team = (id: number, displayName: string, capSpace: number, players: any[], draftPicks: any[]) =>
  ({
    id, displayName, name: displayName, players, draftPicks,
    capSpace, firstApronSpace: 20e6, secondApronSpace: 30e6,
  }) as any;

// Both over the cap, under the aprons: 125% + $100K matching.
const hawks = team(1, "Atlanta Hawks", -10e6,
  [player("Alpha One", 20), player("Alpha Two", 10), player("José Alvarado", 4), player("Alpha Filler", 8)],
  [
    pick(2026, 1),                                  // draft already happened
    pick(2027, 1, "To PHL (most favorable)"),       // owed away
    pick(2027, 1, "Via SAC - top 4 protected"),     // tradable, first 2027 R1
    pick(2027, 1, "Via UTH"),                       // tradable, second 2027 R1
    pick(2028, 1), pick(2029, 1), pick(2030, 1), pick(2031, 1), pick(2032, 1),
    pick(2029, 2, "Frozen (through 2027-28)"),
  ]);
const bulls = team(2, "Chicago Bulls", -10e6,
  [player("Beta One", 21), player("Beta Two", 2)],
  // Own R1s in 2028 and 2030 only: 2029 is gone, so both are Stepien-blocked.
  [pick(2028, 1), pick(2030, 1), pick(2028, 2)]);
const teams = [hawks, bulls];

const side = (teamName: string, players: string[], picks: string[], from: string, rp: string[], rk: string[]) => ({
  teamName,
  gives: { players: players.map((name) => ({ name, type: "player" })), picks: picks.map((name) => ({ name, type: "pick" })) },
  receives: {
    players: rp.map((name) => ({ name, type: "player", from })),
    picks: rk.map((name) => ({ name, type: "pick", from })),
  },
});
/** Two-team trade: each side receives exactly what the other gives. */
const swap = (aPlayers: string[], aPicks: string[], bPlayers: string[], bPicks: string[]) => ({
  teams: [
    side("Atlanta Hawks", aPlayers, aPicks, "Chicago Bulls", bPlayers, bPicks),
    side("Chicago Bulls", bPlayers, bPicks, "Atlanta Hawks", aPlayers, aPicks),
  ],
});
const codes = (trade: any, selected: any[] = []) =>
  checkTradeLegality(trade, teams, selected, NOW).violations.map((v) => v.code);

// Legal: $20M for $21M, plus a tradable pick. Accents and case don't matter.
assert.deepEqual(codes(swap(["Alpha One"], ["2030 R1"], ["Beta One"], [])), []);
assert.deepEqual(codes(swap(["Alpha One", "jose alvarado"], [], ["Beta One"], [])), []);

// Hallucinated player, and a real player on the wrong team.
// (reported once, not again as a routing error on the receiving side)
assert.deepEqual(codes(swap(["Alpha One", "Made Up Guy"], [], ["Beta One"], [])), ["UNKNOWN_PLAYER"]);
assert.ok(codes(swap(["Beta Two"], [], ["Beta One"], [])).includes("WRONG_TEAM"));

// Picks: nonexistent, draft already held, owed away, frozen, Stepien.
assert.ok(codes(swap(["Alpha One"], ["2033 R1"], ["Beta One"], [])).includes("UNKNOWN_PICK"));
assert.ok(codes(swap(["Alpha One"], ["2026 R1"], ["Beta One"], [])).includes("UNTRADABLE_PICK"));
assert.ok(codes(swap(["Alpha One"], ["2029 R2"], ["Beta One"], [])).includes("UNTRADABLE_PICK"));
assert.ok(codes(swap(["Alpha One"], [], ["Beta One"], ["2028 R1"])).includes("STEPIEN"));
// ...unless the user picked that pick themselves.
const bullsR1 = bulls.draftPicks[0];
assert.ok(!codes(swap(["Alpha One"], [], ["Beta One"], ["2028 R1"]), [{ id: bullsR1.id, type: "pick", teamId: 2 }]).includes("STEPIEN"));

// "2027 R1" skips the owed-away row; "#2" is the second tradable one; ids are stamped.
{
  const trade = swap(["Alpha One"], ["2027 R1", "2027 R1 #2"], ["Beta One"], []);
  assert.deepEqual(codes(trade), []);
  assert.deepEqual(trade.teams[0]!.gives.picks.map((p: any) => p.id), [hawks.draftPicks[2].id, hawks.draftPicks[3].id]);
  assert.deepEqual(trade.teams[1]!.receives.picks.map((p: any) => p.id), [hawks.draftPicks[2].id, hawks.draftPicks[3].id]);
  assert.equal(pickLabel(hawks.draftPicks[3], hawks, NOW), "2027 R1 #2");
  assert.equal(tradablePicks(hawks, NOW).length, 6); // 2 acquired 2027s + own 2029-2032
}

// Salary: $10M out, $21M in breaks 125% + $100K.
assert.deepEqual(codes(swap(["Alpha Two"], [], ["Beta One"], [])), ["SALARY"]);

// Repair: the only legal one-move fix is the $8M role player (the $20M star
// would break Chicago's side). Unfixable problems are left alone.
{
  const broken = swap(["Alpha Two"], [], ["Beta One"], []);
  const { violations } = checkTradeLegality(broken, teams, [], NOW);
  const repaired = repairTrade(broken, violations, teams, []);
  assert.deepEqual(repaired?.trade.teams[0].gives.players.map((p: any) => p.name), ["Alpha Two", "Alpha Filler"]);
  assert.deepEqual(codes(repaired!.trade), []);
  // A starter-level player is never used as filler, even if he is the only fix.
  const starLine = { points: 25, rebounds: 8, assists: 6, steals: 1, blocks: 1 };
  const [alphaOne, , , filler] = hawks.players;
  alphaOne.statistics = filler.statistics = starLine;
  assert.equal(repairTrade(broken, violations, teams, []), null);
  delete alphaOne.statistics;
  delete filler.statistics;
  const fake = swap(["Made Up Guy"], [], ["Beta One"], []);
  assert.equal(repairTrade(fake, checkTradeLegality(fake, teams, [], NOW).violations, teams, []), null);
}

// Routing: received without being given; given but received by nobody.
{
  const trade = swap(["Alpha One"], [], ["Beta One"], []);
  trade.teams[0]!.receives.players.push({ name: "Beta Two", type: "player", from: "Chicago Bulls" });
  assert.ok(codes(trade).includes("ROUTING"));
  const lost = swap(["Alpha One"], [], ["Beta One"], []);
  lost.teams[1]!.receives.players = [];
  assert.ok(codes(lost).includes("ROUTING"));
}

// Structure and request.
assert.ok(codes(swap([], [], ["Beta One"], [])).includes("STRUCTURE"));
assert.ok(codes({ teams: [side("Atlanta Hawks", ["Alpha One"], [], "Boston Celtics", [], []), side("Boston Celtics", [], [], "Atlanta Hawks", ["Alpha One"], [])] }).includes("UNKNOWN_TEAM"));
assert.ok(codes(swap(["Alpha One"], [], ["Beta One"], []), [{ id: hawks.players[1].id, type: "player", teamId: 1 }]).includes("REQUEST"));

// Roster size is a card warning, not a rejection: 15-man team, two back for one.
{
  const full = team(3, "Full Team", 50e6, Array.from({ length: 15 }, (_, i) => player(`Full ${i}`, 5)), []);
  const trade = {
    teams: [
      side("Full Team", ["Full 0"], [], "Atlanta Hawks", ["Alpha Two", "José Alvarado"], []),
      side("Atlanta Hawks", ["Alpha Two", "José Alvarado"], [], "Full Team", ["Full 0"], []),
    ],
  };
  assert.deepEqual(checkTradeLegality(trade, [full, hawks], [], NOW).violations, []);
}

console.log("check-trade-legality: all checks passed");
