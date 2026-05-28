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

---

## `team.players` includes two-way contracts

**Discovered:** 2026-05-27

The seed pipeline writes every player ESPN returns into `Team.players`,
including the 3 two-way contracts most teams carry. Standard NBA roster
limit is 15 (excluding two-ways), so absolute-size comparisons like
`team.players.length > 15` will fire on almost every team even with no
trade involved.

### What broke

`checkRosterOverflow` in `src/lib/trade-warnings.ts` originally compared
post-trade size to the 15-man limit. On any team already over the limit
in the DB, even a clean 1-for-1 swap left them still over, so the warning
fired with a misleading "would hold N players" message — when the trade
itself didn't cause the overflow at all.

### Fix in place

The rule now only warns when the trade *increases* body count past the
limit (`postTradeSize > currentSize && postTradeSize > STANDARD_ROSTER_LIMIT`).
A 1-for-1 (or net-zero / net-negative) swap on an already-full team stays
quiet; net +1 onto a 15-man roster still surfaces.

### What we'd actually want

Long term: separate two-way contracts in the DB (a `Player.contractType`
field, or a `Team.standardPlayers` / `Team.twoWayPlayers` split), so
roster-size logic can be honest about which 15-vs-3 bucket each player
sits in. Until then, the delta-only check is the right defensive call.

---

## Split `/my-trades` into a public feed + private library

**Discovered:** 2026-05-28 (via `/impeccable critique` on the saved-trades index)

### Problem

`/my-trades` currently serves two distinct audiences from one URL via the
in-page tab strip:

- **Public discovery feed** ("All Trades" tab) — indexable, social, drives
  the "screenshot-worthy content → community gravity" loop PRODUCT.md is
  betting on.
- **Private saved library** ("Mine" + "Upvoted" tabs) — authenticated, no
  SEO value, a different job-to-be-done.

This hurts on three axes:

1. **SEO.** The canonical URL `/my-trades` reads (and is structured) like a
   private-dashboard route. Search intent for queries like "NBA trade ideas"
   or "best NBA trades" should land on a route whose slug, IA, and content
   are unambiguously public — not on a page where the default tab requires
   sign-in to populate.
2. **Information architecture.** The masthead today juggles "Community
   Trades" (page title), nav anchor text, plus three tabs that switch
   between public and private content under one heading. The clarify pass
   on 2026-05-28 unified vocabulary on "Community Trades" everywhere, but
   the underlying mixed-audience structure still leaks: "Mine" inside a
   surface named "Community Trades" is still weird.
3. **Internal-link signal.** Every nav, footer, homepage, FAQ link to
   `/my-trades` is currently pointing at a mixed-audience page, so anchor
   text and link equity are spread thin.

### What we'd actually want

Split into two routes:

- **`/trades`** (or `/nba-trades` if we want to be aggressive on exact-match
  keywords) — public discovery feed. Indexable. Default sort. No tabs, or
  filter chips ("Recent / Popular / Top Rated"). Sign-in optional, only
  needed to vote/comment.
- **`/my-trades`** — authenticated saved library. Holds the Mine + Upvoted
  tabs. `noindex`. Pure tool surface.

The shared `TradeCard` + `saved-trade-detail` viewer stays the same;
they're consumed by both routes.

### Order of operations when we do this

1. Decide canonical slug — `/trades` (clean) or `/nba-trades` (keyword).
   Probably `/trades` and let the title tag carry the keyword.
2. Create the new public route and move the "All Trades" rendering path
   into it. Keep the existing `getPaginatedTrades` action.
3. Strip the All Trades tab from `/my-trades`. The remaining surface
   becomes a two-tab (Mine / Upvoted) library.
4. Update internal links:
   - `navbar.tsx` nav link → `/trades`, label stays "Community Trades".
   - `footer.tsx` "Community Trades" link → `/trades`.
   - Homepage CTA (`app/page.tsx:76`), FAQ link (`app/faq/page.tsx:87`).
   - `save-trade-modal.tsx` post-save toast — points at `/my-trades` (the
     saved library, where the user's new trade lives).
   - `saved-trade-detail.tsx` back-button → context-aware: "Back to
     Community Trades" if referrer is `/trades`, "Back to your library"
     if referrer is `/my-trades`.
5. Set `robots: { index: false, follow: true }` on `/my-trades`, keep
   `index: true` on `/trades`.
6. Update `sitemap.ts` to emit `/trades` instead of `/my-trades` for the
   public route (saved-trade detail pages stay under `/my-trades/[id]`
   for now since their canonical URL is already published; OR migrate
   detail pages under `/trades/[id]` with a permanent redirect).

### Why this isn't urgent

The `clarify` pass on 2026-05-28 unified vocabulary to "Community Trades"
across the masthead, nav, footer, tabs, and back-button. That fixes the
*read* of the page even without splitting the URL. The split is a real
SEO + IA improvement, but it's a structural refactor — better done as its
own PR with its own redirect story.
