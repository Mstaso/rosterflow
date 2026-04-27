# RosterFlow context notes

Long-lived notes about issues / followups discovered during development that
don't belong in a single PR. Append to this file as things come up.

---

## Player & team data freshness — needs a cron

**Discovered:** 2026-04-23

### Problem

The `Player.statistics`, `Player.contract`, `Player.injuries`, `Team.record`,
and team cap data in the database are populated by `prisma/seed.ts`, which
pulls from the ESPN API and the static JSON files in `prisma/seeddata/`. The
seed only runs when a developer manually invokes it. In production this means:

- Player season stats (ppg/rpg/apg, TS%, etc.) drift from reality the moment
  the season progresses past the last seed.
- Team records / win% don't update — directly affects the contender vs
  rebuilder logic in `team-role-classifier.ts` and
  `getTeamOutlookContext` (used in every trade prompt).
- Salary / contract years don't reflect mid-season trades, waivers, or
  buyouts.
- Injury status is stale.
- Draft pick ownership doesn't reflect real-life trades.

The trade generator + role classifier rely on this data being current. Stale
records mean the model gets told "the Lakers are rebuilding" when they're 30-15.

### What we need

A scheduled job that re-runs (or re-runs a subset of) the seed pipeline on a
recurring cadence. Cheapest version: nightly cron during the regular season,
weekly off-season.

### Implementation options (pick later)

1. **Vercel Cron + a route handler** — simplest. Add a `vercel.ts` cron
   entry pointing at a new `/api/cron/refresh-players` route that runs the
   ESPN-fetching portion of `seed.ts`. Protect with `CRON_SECRET`.
   - Pro: lives next to the app, no external infra.
   - Con: cron runs hit Vercel function execution; need to make sure the
     refresh fits inside `maxDuration` (default 300s, can extend per-route).
     Full league refresh is 30 teams × ~17 players, may need chunking.

2. **GitHub Actions scheduled workflow** — runs `npm run db:refresh` on a
   schedule against the production DB.
   - Pro: no Vercel function timeout limits.
   - Con: needs DB credentials in Actions secrets.

3. **External scheduler (e.g. Vercel Queues + worker)** — overkill for now.

### What needs splitting out of `seed.ts` before we can wire any cron

`prisma/seed.ts` currently does first-time setup AND data fetching as one
script. For a cron we want a refresh function that:

- Updates `Player.statistics`, `Player.contract`, `Player.injuries`,
  `Player.age`, `Player.status` for existing players.
- Adds new players (rookies, signings) and removes / archives waived ones.
- Updates `Team.record` and any cap-related team fields.
- Does NOT re-create teams from scratch or wipe trade history.

Probably extract into `src/lib/data-refresh.ts` (or similar) and have both
`seed.ts` and the cron route call into it.

### Why this matters for trade quality

The eval harness scenarios are built off live DB data. Bad records → bad
contender/rebuilder labels → bad role guidance → realism score regressions
that look like prompt bugs but are actually data bugs. Worth fixing before
spending more time tuning the prompt.
