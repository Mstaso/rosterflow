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
- `pnpm db:seed` — `tsx prisma/seed.ts` — live ESPN rosters + synthetic contracts/picks
- `pnpm db:studio` — Prisma Studio on :5555
- `./start-database.sh` — local Postgres container (Docker/Podman) from `.env`

## The two trade flows

Both share context-building helpers in `src/lib/server-utils.ts` and the cap rules below.

### Flow A — AI-generate trades

1. **UI trigger.** `src/components/trade-machine/trade-machine-client.tsx` → `handleGenerateTrade()` → POSTs to `/api/trades/generate` (SSE). Client always sends `additionalTeams: null` — the server decides who the trade partners are.
2. **Fit-based partner selection (single-player case only).** When `selectedAssets.length === 1`, `teams.length === 1`, and the offered asset is a player, `src/app/api/trades/generate/route.ts` calls `pickFitPartners()` from `src/lib/target-asset-scorer.ts`. That scorer:
   - Hydrates all 30 teams via `db.teams.getAllWithRosters()` (single Prisma query)
   - Scores every other-team asset on salary fit (`computeMatchingBounds`), rating parity (±8), seller orientation (rebuilders favor age ≤25 + picks; contenders favor 75+ veterans + expiring), position adjacency, target cap-tier penalty
   - Hard-filters Stepien-blocked own R1s via `getOwnStepienBlockedYears`
   - Picks top 8 teams by aggregate score, weighted-samples 2 by score² (variety on regenerate)
   - For each selected team, returns up to 2 candidate **packages** (1–3 assets that meet matching bounds)
   Multi-asset, multi-team, or user-picked-partner requests skip this entirely.
3. **Build prompt + context.** `src/lib/trade-generator.ts` → `buildTradePrompt()` assembles:
   - `getRosterContext` — top 10 players per team with rating + salary. **Stepien-blocked own R1s are filtered out here**, so the LLM never sees them (no warning section needed).
   - `getTeamOutlookContext` — win %, rank, contender/rebuild label
   - `getCapTier` per team → `SECOND_APRON` tags surfaced; other cap matching done post-gen
   - `classifyTeamRoles` (`src/lib/team-role-classifier.ts`) → PRINCIPAL_SELLER/BUYER/FACILITATOR for multi-team deals
   - `SUGGESTED TARGET PACKAGES` — when the scorer ran in step 2, the packages render here as starter suggestions ("substitute or augment from rosters if you can do better"). Anchors the LLM on the specific assets the partner team was chosen for, including sub-top-10 role players/expiring deals that the roster context wouldn't show.
   - Also runs `src/lib/manual-trade-generator.ts` first — if it returns a valid algorithmic trade, that's prepended and the LLM is asked not to repeat it.
4. **Stream from Anthropic.** `src/app/api/trades/generate/route.ts` calls Sonnet 4.6 (temp 0.7, 5500 tokens). The model returns a JSON array of scenarios; each is streamed back as it parses.
5. **Validate + refine each scenario.** Back in `trade-generator.ts`:
   - `isValidTrade()` rejects scenarios where an asset is double-given or a team gives nothing.
   - `reconstructReceives()` rebuilds each team's `receives` from everyone else's `gives` (the LLM is unreliable here).
   - `refineTradeSalary()` in `src/lib/trade-refinement.ts` iteratively adds filler players until cap-matching bounds are met (max 3 iters for 2-team, 5 for multi-team).
6. **Display.** `src/components/trade-machine/generated-trades/trade-container.tsx` appends each trade as it arrives. User can edit or save.

### Flow B — User "tries" their own trade

1. **UI trigger.** Same client component → "Try Trade" button → renders `src/components/trade-machine/try-trade-preview.tsx`.
2. **Client-side validation.** `try-trade-preview.tsx` → `buildTradeInfo()` + `validateTrade()` groups assets by sender/receiver, computes salary deltas, and checks the same cap-tier rules below. No LLM, no server round-trip.
3. **Optional save.** Same persistence path as Flow A.

### Persistence (both flows)

`src/actions/trades.ts` → `saveTradeAction()` writes one `Trade` + N `TradeTeam` + M `TradeAsset` rows in a transaction, snapshotting player/team data so historic trades survive roster changes. Models in `prisma/schema.prisma`.

### Cap-tier matching rules (domain logic — get these right)

Defined in `src/lib/server-utils.ts` → `computeMatchingBounds()`. For incoming salary given outgoing salary `O`:

- `UNDER_CAP`: no bounds
- `OVER_CAP`: `O / 1.25 - 0.1M ≤ incoming ≤ O * 1.25 + 0.1M`
- `FIRST_APRON`: `O / 1.1 - 0.1M ≤ incoming ≤ O * 1.1 + 0.1M`
- `SECOND_APRON`: `incoming ≤ O` (no aggregation allowed)

### Stepien rule (domain logic)

Teams can't trade their own R1 picks in consecutive future years. Source of truth: `src/lib/server-utils.ts` → `isOwnPick()` + `getOwnStepienBlockedYears()`. These are used in two places:

- `getRosterContext` filters Stepien-blocked own R1s out of what the LLM sees (so it can't propose trading them)
- `target-asset-scorer.ts` excludes them from the candidate pool when picking partner teams

Acquired R1s (e.g. "Lakers' 2027 R1 via NYK") aren't subject to the holder's Stepien restriction and move freely.

## Eval harness (offline, not user-facing)

`src/lib/eval/` + `src/app/api/trades/eval/route.ts` (dev-only). `buildAllScenarios()` generates scenarios from live DB, runs the same `generateTradesCore()`, then `grader.ts` (salary/value/integrity) and `realism-judge.ts` (LLM-judged realism) score the output. Results land in `./eval-results/*.json`. Useful when tuning the prompt or refinement logic.

Note: grader scales draft-pick value by 0.65 vs player ratings (top-10 pick ≈ 55–65 rated player). Match this if extending the grader.

## Conventions

- **UI work:** read `DESIGN.md` ("The Kinetic Ledger" — surface hierarchy, no-line rule, elevation, component patterns) before changing components. Use the `frontend-design` skill for substantive UI.
- **ESPN integration:** `API_DOCUMENTATION.md` documents the unofficial endpoints and known gaps (notably: no salary data — contracts are synthetic).
- **Type imports:** inline (`import { type X }`) — enforced by `@typescript-eslint/consistent-type-imports`.
- **Unused args:** prefix `_` to bypass lint.

## Followups / known issues

See `context.md` — long-lived backlog. Currently tracks: player/team data freshness needs a cron (only `seed.ts` refreshes data today).
