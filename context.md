# RosterFlow context notes

Long-lived notes about issues / followups discovered during development that
don't belong in a single PR. Append to this file as things come up.

---

## Player & team data freshness — cron in place, static data still manual

**Discovered:** 2026-04-23 · **Cron added:** 2026-10-13

### What the cron covers

`/api/cron/refresh-players` (daily in season, Mondays July–September) refreshes
from ESPN: team records, roster membership (trades, signings, waivers),
contracts, injuries, age/status, and season stats. Logic and safety rules live
in `src/lib/data-refresh.ts`; `pnpm check:refresh` guards them. Requires
`CRON_SECRET` in Vercel. `/api/data-status` shows how old the data is.

### What it cannot cover

Both come from hand-maintained JSON in `prisma/seeddata/`, last updated
2026-03-16, and only `pnpm db:seed` (which wipes saved trades) loads them:

1. **Team cap figures** — `totalCapAllocation`, `capSpace`, `firstApronSpace`,
   `secondApronSpace`. These decide each team's cap tier, so every
   salary-matching rule depends on them. They are 2025-26 numbers.
2. **Draft picks** — ownership, protections, `estimatedValue`. Already wrong in
   known ways: many R1 rows describe picks the team *owes* to someone else
   ("To PHL (...)"), and picks for drafts that have already happened stay listed.

### Proposal for the static data

- **Cap figures:** derive instead of hand-entering. Sum `Player.contract.salary`
  per team after each refresh and subtract from a three-number per-season table
  (cap, first apron, second apron). Roster sums run below the JSON totals (dead
  money, cap holds and two-ways are missing), so derived values will under-state
  apron teams unless a per-team "other charges" number is kept alongside.
- **Draft picks:** needs a `db:refresh-picks` script that upserts from the JSON
  by `(teamId, year, round, sequence)` instead of wipe-and-reseed, so updating
  picks stops costing the trade history. The JSON itself still has to be
  re-pulled by hand a few times a year (draft, deadline, July).

### Known ESPN gaps

- In the off-season ESPN lacks a current-season contract for a large share of
  rostered players (new signings, rookies); they keep last season's salary until
  ESPN catches up. The cron response reports the count as `contractsKept`.
- Roster entries with no contract that we have never stored (camp invites,
  two-ways, some rookies) are skipped (`playersSkippedNoContract`), so preseason
  rosters run thin.
- Records are 0-0 until the season starts; the refresh holds last season's
  records until a team has played 10 games (`recordsKept`).

### Known data bug, not fixed here

`Statistics.fieldGoalAttempts` / `freeThrowAttempts` are 0 for every player:
ESPN's labels are `FG` ("8.7-18.6"), not `FGA`/`FGM`. So the true-shooting
multiplier in `computePlayerRating` has never applied. Fixing the parse would
shift every rating (league-average efficiency maps to ×0.85) and the thresholds
tuned against today's ratings, so it needs a deliberate recalibration.

---

## Trade accuracy — open items after the legality checker

**Discovered:** 2026-10-13

- **Draft-pick table is unreliable.** Rows the team owes away ("To PHL (...)")
  sit next to rows it holds; some incoming picks were lost when the seed's LLM
  step merged entries by year+round; protections ("1-5 Own pick") aren't parsed.
  `pickUntradableReason` filters the obvious cases by description text. The real
  fix is a pick table with explicit `ownerTeamId` / `originalTeamId` /
  protection columns, loaded without an LLM in the path.
- **Realism judge is saturated.** `fitScore` is ~2/10 for almost everything,
  partly because it penalises the premise the scenario imposed. Needs a rubric
  that judges construction given the premise, or pairwise comparison.
- **ESPN `contract.tradeRestriction`** is true for ~40% of players. Meaning
  unverified (recently signed? no-trade clause? post-deadline?), so it is not
  enforced. Same for `poisonPillProvision` / `baseYearCompensation` flags.
- **One player has `yearsRemaining` = 3658800** (ESPN data error); nothing
  sanity-checks contract fields.
- **Season label is hard-coded** ("2025-26") in the generation prompt.

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
