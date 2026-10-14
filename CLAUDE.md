# RosterFlow

NBA trade-machine web app. Users select teams and assets (players + draft picks); the app either **generates** realistic multi-team trades via Claude, or lets the user **try** their own trade and validates it against the salary cap.

## Stack

- Next.js 16 (App Router), React 19, TypeScript
- Prisma + PostgreSQL — README mentions Drizzle, **ignore it, not used**
- Clerk for auth — README mentions NextAuth, **also not used**
- Tailwind 3 + shadcn/ui (Radix)
- Anthropic SDK (`claude-sonnet-4-6`) for trade generation; OpenAI SDK only in the seed pipeline
- PostHog + Vercel Analytics
- `pnpm@10.11.1` pinned

## Commands

- `pnpm dev` — Next dev on :3000
- `pnpm build` — `prisma generate && next build`
- `pnpm lint` — ESLint (flat config)
- `pnpm db:push` — sync schema
- `pnpm db:seed` — `tsx prisma/seed.ts` — **wipes everything including saved trades**, then live ESPN rosters/contracts + static cap/pick JSON
- `pnpm db:refresh` — `tsx scripts/refresh-data.ts` — non-destructive ESPN refresh (same code as the cron)
- `pnpm check:refresh` — self-check for the refresh logic (no network, no DB)
- `pnpm db:studio` — Prisma Studio on :5555
- `./start-database.sh` — local Postgres container (Docker/Podman) from `.env`

## The two trade flows

Both share context-building helpers in `src/lib/server-utils.ts` and the cap rules below.

### Flow A — AI-generate trades

1. **UI trigger.** `src/components/trade-machine/trade-machine-client.tsx` → `handleGenerateTrade()` → POSTs to `/api/trades/generate` (SSE). Client always sends `additionalTeams: null` — the server decides who the trade partners are.
2. **Resolve the request.** `resolveTradeRequest()` in `src/lib/trade-generator.ts` re-reads every team from the DB by id (rosters, salaries and cap numbers in the request body are ignored) and, when exactly one player from one team is offered with no partners, calls `pickFitPartners()` from `src/lib/target-asset-scorer.ts`. That scorer:
   - Hydrates all 30 teams via `db.teams.getAllWithRosters()` (single Prisma query)
   - Scores every other-team asset on salary fit (`computeMatchingBounds`), rating parity (±8), seller orientation (rebuilders favor age ≤25 + picks; contenders favor 75+ veterans + expiring), position adjacency, target cap-tier penalty
   - Only considers picks that pass `tradablePicks()` (see "Pick tradability" below)
   - Picks top 8 teams by aggregate score, weighted-samples 2 by score² (variety on regenerate)
   - For each selected team, returns up to 2 candidate **packages** (1–3 assets that meet matching bounds)
   Multi-asset, multi-team, or user-picked-partner requests skip the scorer.
3. **Build prompt + context.** `buildTradePrompt()` assembles:
   - `getRosterContext` — top 10 players per team with rating + salary, and **only tradable picks**, each under a unique name (`pickLabel`: a team's second 2027 R1 is "2027 R1 #2").
   - `getTeamOutlookContext` — win %, rank, contender/rebuild label
   - `describeTeamConstraints` — one line per team of hard limits computed in code: matching rule for its cap tier, dollars of room below each apron, open roster spots. The model is told a scenario breaking a salary limit is rejected; roster room is a preference.
   - `classifyTeamRoles` (`src/lib/team-role-classifier.ts`) → PRINCIPAL_SELLER/BUYER/FACILITATOR for multi-team deals
   - `SUGGESTED TARGET PACKAGES` — when the scorer ran in step 2, the packages render here as starter suggestions.
   - Also runs `src/lib/manual-trade-generator.ts` first — if it returns a trade that passes the legality checker, that's prepended and the LLM is asked not to repeat it.
4. **Generate, vet, repair, retry.** `generateVettedTrades()` streams Sonnet 4.6 (temp 0.7, 5500 tokens). The model returns names only — who gives what to whom. Each scenario goes through `vetTrade()`:
   - `isValidTrade()` + `reconstructReceives()` (structure; rebuild `receives` from `gives`).
   - `checkTradeLegality()` in `src/lib/trade-legality.ts` resolves every team, player and pick to DB rows and returns violations: unknown/wrong-team player, unknown/untradable pick, Stepien, routing, salary, ignored user request. Roster size is deliberately *not* a rejection — the card shows it as a soft warning. Cap rules come from `collectTradeWarnings`, so the server and the result card cannot disagree. It also stamps the resolved pick `id` onto the trade for the client.
   - If the only violations are salary, `repairTrade()` in `src/lib/trade-repair.ts` searches for at most two role-player edits (rating ≤ 57) that make the checker pass.
   - Legal trades stream to the client. If fewer than 3 are legal, the model gets **one** retry with the checker's messages for each reject. If nothing is legal and there's no manual trade, the two least-broken rejects are shown (the card explains what's wrong).
5. **Display.** `src/components/trade-machine/generated-trades/trade-container.tsx` appends each trade as it arrives. Salaries and stats on the card are looked up from DB-sourced team data by name/id — nothing numeric comes from the model.

### Flow B — User "tries" their own trade

1. **UI trigger.** Same client component → "Try Trade" button → renders `src/components/trade-machine/try-trade-preview.tsx`.
2. **Client-side validation.** `try-trade-preview.tsx` → `buildTradeInfo()` + `validateTrade()` groups assets by sender/receiver, computes salary deltas, and checks the same cap-tier rules below. No LLM, no server round-trip.
3. **Optional save.** Same persistence path as Flow A.

### Persistence (both flows)

`src/actions/trades.ts` → `saveTradeAction()` writes one `Trade` + N `TradeTeam` + M `TradeAsset` rows in a transaction, snapshotting player/team data so historic trades survive roster changes. Models in `prisma/schema.prisma`.

### Shared trade-result-view layer

Three components render the same per-team "trade result" card layout and need to stay in visual sync:

- `src/components/trade-machine/generated-trades/trade-card.tsx` — AI-generated scenarios (Flow A)
- `src/components/trade-machine/try-trade-preview.tsx` — user-built trades (Flow B)
- `src/components/my-trades/saved-trade-detail.tsx` — historic saved trades at `/my-trades/[id]`

They consume a shared library at `src/lib/trade-warnings.ts`:

- `collectTradeWarnings(moves)` — returns every applicable warning (cap rules, Stepien, roster imbalance, roster overflow), blockers-first. Drives the masthead's verdict banner. **Roster overflow only fires when the trade *increases* body count** — `team.players` includes two-way contracts in the DB, so absolute size comparisons are noisy.
- `computeSubdeck(moves)` — editorial one-liner ("Warriors slide back under the second apron.") derived from cap math, used as the masthead subdeck.

And a shared `TradeMasthead` at `src/components/trade-machine/trade-masthead.tsx` — eyebrow + subdeck + tinted verdict banner (teal for valid, copper for issues with bulleted reasons). Currently used by `trade-card.tsx` and `try-trade-preview.tsx`; `saved-trade-detail.tsx` has its own bespoke verdict block (harmonization is a followup).

### Cap-tier matching rules (domain logic — get these right)

Defined in `src/lib/server-utils.ts` → `computeMatchingBounds()`. For incoming salary given outgoing salary `O`:

- `UNDER_CAP`: no bounds
- `OVER_CAP`: `O / 1.25 - 0.1M ≤ incoming ≤ O * 1.25 + 0.1M`
- `FIRST_APRON`: `O / 1.1 - 0.1M ≤ incoming ≤ O * 1.1 + 0.1M`
- `SECOND_APRON`: `incoming ≤ O` (no aggregation allowed)

The result card (`checkCapRules` in `trade-warnings.ts`) is the authority for legality and is stricter than the static tiers in one way: a team that would *cross* an apron because of the trade is held to that apron's rule. It has no minimum-incoming check. `computeMatchingBounds` (with its lower bound) is still used by the fit scorer and the manual generator.

### Pick tradability (domain logic)

`pickUntradableReason()` in `src/lib/trade-legality.ts`. A row in `DraftPick` is **not** proof the team can trade it — the seed data lists obligations next to holdings. Untradable: draft year already passed, description starting "To " (owed to another team), "Frozen", or own R1 in a Stepien-blocked year. The asset picker (`team-card.tsx`) shows these rows disabled with the reason, except Stepien-blocked picks, which stay selectable so Try Trade can explain the rule; a Stepien pick the user selected is not held against generated trades.

### Stepien rule (domain logic)

Teams can't trade their own R1 picks in consecutive future years. Source of truth: `src/lib/server-utils.ts` → `isOwnPick()` + `getOwnStepienBlockedYears()`. Applied through `pickUntradableReason()`, which the prompt context, the fit scorer and the legality checker all share.

Acquired R1s (e.g. "Lakers' 2027 R1 via NYK") aren't subject to the holder's Stepien restriction and move freely.

## Data refresh (cron)

`src/lib/data-refresh.ts` holds the ESPN fetchers (shared with `prisma/seed.ts`) and `refreshLeagueData()`. `vercel.json` fires `GET /api/cron/refresh-players` daily at 10:00 UTC (needs `CRON_SECRET`); the route skips non-Mondays in July–September. `GET /api/data-status` reports the oldest per-team refresh time (`Team.updatedAt`, bumped only when that team's refresh commits). The footer (`src/components/layout/data-freshness.tsx`) shows it as "Rosters & stats as of …"; it fetches client-side because the pages are statically rendered, and the endpoint is CDN-cached for 10 minutes.

Rules the refresh keeps — don't loosen without reading `scripts/check-data-refresh.ts`:

- One transaction per team; any ESPN failure for a team means zero writes for it.
- Records and stats with fewer than `MIN_GAMES` (10) games never overwrite stored values (ESPN reports 0-0 in preseason, which would label all 30 teams "rebuilding").
- A player on an ESPN roster with no current-season contract keeps the stored contract; one we've never seen is not created.
- Players are pruned only when all 30 rosters were fetched and fewer than 25% vanished.

**Not refreshed** (static JSON in `prisma/seeddata/`): team cap figures (`totalCapAllocation`, `capSpace`, apron spaces → cap tiers) and all draft picks. See `context.md`.

## Eval harness (offline, not user-facing)

`src/lib/eval/` + `src/app/api/trades/eval/route.ts` (dev-only). `buildAllScenarios()` generates scenarios from live DB, runs the same `generateTradesCore()`, then `grader.ts` (salary/value/integrity) and `realism-judge.ts` (LLM-judged realism) score the output. Results land in `./eval-results/*.json`. Useful when tuning the prompt or refinement logic.

**Fixed legality eval:** `pnpm eval:trades <label>` (`scripts/eval-trades.ts`) runs 22 fixed requests through `generateTradesCore()` and reports the share of displayed AI trades with violations, rejects before display, retries, and trades per request. Run it twice per code state — single runs differ by a few points. `pnpm check:legality` is the no-network self-check for the checker and repair. The realism judge's `fitScore` currently sits at ~2/10 for nearly every trade, so it cannot tell changes apart; don't read it as evidence until it's recalibrated.

Note: grader scales draft-pick value by 0.65 vs player ratings (top-10 pick ≈ 55–65 rated player). Match this if extending the grader.

## Conventions

- **UI work:** read `DESIGN.md` ("The Kinetic Ledger" — surface hierarchy, no-line rule, elevation, component patterns) before changing components. Use the `frontend-design` skill for substantive UI.
- **ESPN integration:** `API_DOCUMENTATION.md` documents the unofficial endpoints. Its "no salary data" note is out of date: the roster endpoint returns `contract` (salary, years remaining) for players signed for the current season, and that is where `Player.contract` comes from.
- **Type imports:** inline (`import { type X }`) — enforced by `@typescript-eslint/consistent-type-imports`.
- **Unused args:** prefix `_` to bypass lint.

## Followups / known issues

See `context.md` — long-lived backlog. Currently tracks: static cap + draft-pick data that the cron cannot refresh, two-way contracts, the `/my-trades` split.
