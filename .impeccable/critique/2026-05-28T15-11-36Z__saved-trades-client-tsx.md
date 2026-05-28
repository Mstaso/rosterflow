---
target: /my-trades (saved-trades index)
total_score: 35
p0_count: 0
p1_count: 2
timestamp: 2026-05-28T15-11-36Z
slug: saved-trades-client-tsx
---
# Critique — `/my-trades` (saved-trades index) — third pass

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Focus ring, active tab/sort underlines, optimistic vote, CAP VALID/CAP ISSUE chip, toast on vote failure. |
| 2 | Match System / Real World | 4 | NBA cap vocabulary, OUT/IN/DELTA inline (word now, not glyph), editorial MAY 18 date eyebrow. |
| 3 | User Control and Freedom | 3 | Vote toggle reversible, sort/tab instant, per-card delete lives on detail (fine). No bulk ops. |
| 4 | Consistency and Standards | 4 | One editorial voice top-to-bottom: navbar masthead, SORT, tabs, card eyebrows, sample card. DELTA word unified. |
| 5 | Error Prevention | 3 | Sign-in dialog gates anonymous voting; optimistic vote rolls back; inputs constrained. |
| 6 | Recognition Rather Than Recall | 4 | Eyebrow labels everywhere, counts inline next to tab labels, EmptyState teaches by sample card. |
| 7 | Flexibility and Efficiency | 3 | Cards now keyboard-activatable (Tab+Enter verified). Still no Mine/Upvoted/All shortcut, no Recent↔Popular shortcut, no jump-to-page pagination. |
| 8 | Aesthetic and Minimalist Design | 3 | Asymmetric padding + tonal layering still strong; but at ≥1280px each team strip has ~700px of empty middle between team identity and cap stats. Card reads under-filled. |
| 9 | Error Recovery | 4 | Vote rollback now surfaces a sonner toast ("Couldn't record your vote. Try again in a moment."); sign-in dialog routes the anonymous-vote case. |
| 10 | Help and Documentation | 3 | Sample card + CAP chip `title=` tooltips remain. Cap-issue chip still doesn't surface the *reason* on the index card — that lives only on the detail page. |
| **Total** | | **35/40** | **Very good — last gains require structural rework, not polish.** |

Trend: 21 → 33 → 35. Smaller lift this pass is honest; the two remaining-large issues (wide-screen void inside cards, vote-rail orphan) need layout rework rather than token swaps.

## Anti-Patterns Verdict

**Does this look AI-generated?** No, and less so than last pass. The vocabulary now runs continuously from the navbar wordmark down through the page sort, tab strip, card eyebrows, OUT/IN/DELTA strip, IN/OUT asset rows, and the sample empty-state card. A reader could screenshot any horizontal band of the page and the type system would look intentional.

**LLM assessment (DESIGN.md bans + shared design laws)**:
- ✅ No side-stripe borders, no `background-clip: text` gradients, no glassmorphism, no hero-metric template, no modal-as-first-thought.
- ✅ Em-dashes scrubbed from EmptyState body, EXAMPLE eyebrow, sort tooltip (verified in source).
- ✅ Card hover composited via `transform` + tonal swap, not layout properties.
- ⚠️ Card hover advertises a "brand-tinted ambient shadow" but `rgba(5,10,20,0.6)` is a navy-charcoal — there's no hue from the brand palette in it. Reads as a normal drop shadow. If the intent is brand tint, color it through `oklch(...primary)` at low alpha.
- ⚠️ Composite-button anti-pattern: `<Card role="button">` contains real `<button>` upvote/downvote children. Visually fine; semantically, screen-reader users hear "button: Open trade: …" first and only discover the vote buttons by exploring inside. A real `<Link>` (or `<a>`) wrapper + vote rail outside the link, or vote rail moved outside the activation target, is the standard pattern.
- ⚠️ Sample card lacks team logos while live cards show them — small expectation mismatch on a teaching aid that explicitly says "this is what a trade looks like."

**Deterministic scan**: unavailable — `node scripts/detect.mjs` reported `Error: bundled detector not found.` Same as the prior pass. Findings above are from source-level scan against DESIGN.md + shared-law checklist plus browser inspection at 1440×900.

**Visual overlays**: not injected — Assessment B falls back to browser screenshots because the bundled detector is missing. Browser pass captured 8 screenshots (All tab top, All scrolled, Mine empty top, Mine empty footer, ALL tab focused, focused-card zoom, tab-strip zoom) and confirmed:
- Card bg = `rgb(20, 27, 39)` (surface-container, DESIGN.md compliant)
- All tab triggers have `bg: rgba(0,0,0,0)` — no leftover pill background (the darker rectangle I thought I saw earlier was Chrome's click highlight, not a render)
- DOM activeElement after `Tab Tab` from tab strip is a `<div role="button">` — keyboard activation lands on the card, not an inner button
- Console clean (no errors/warnings on `/my-trades`)

## Overall Impression

The page now reads as one continuous editorial broadsheet: nothing fights, nothing competes for attention. The biggest win this pass is invisible — the unification of the SORT toolbar with the tab strip removes a previously jarring pill-vs-underline clash, and dropping the lucide icons gave both bands the same magazine confidence. The keyboard-activation work on cards closes the largest Alex blocker from the prior pass.

The remaining ceiling is structural, not cosmetic. At full desktop width each team strip stretches `team logo + abbreviation` to the far left and `OUT / IN / DELTA` to the far right with a yawning 700px void between them. The card uses its real estate the way a printed sports almanac uses a column — but laid across a wide page, the geometry reads as half-empty. The single biggest opportunity: collapse the team strip so the cap stats sit *next to* the team identity (one editorial line, anchored left), reclaiming the right half of the card for the asset lines or a small inline rationale.

## What's Working

- **Editorial vocabulary now runs page-deep.** Navbar wordmark + COMMUNITY TRADES subtitle, page-level SORT · Recent · Popular, tabs MINE · UPVOTED · ALL, card date eyebrow, OUT/IN/DELTA cap strip, IN/OUT asset rows, sample-card EXAMPLE eyebrow — all share the `font-supermolot text-[10-11px] tracking-[0.22em]` voice with the same 2px primary underline as the active affordance. Confirmed in the [zoomed tab-strip screenshot](./tab-zoom).
- **Card keyboard path verified end-to-end.** `Tab Tab` from the active tab lands on the first card; the active element is a `<div role="button">` with a clearly visible primary-teal ring offset from the card by 2px. Inner vote buttons remain reachable via further Tab. Enter/Space handler in `trade-card.tsx:177-182` activates router push. This was the largest Heuristic-7 gap last pass.
- **Failure-mode coverage on vote.** Server throw → state snapshot restore → sonner toast at `saved-trades-client.tsx:109-111` (`"Couldn't record your vote." / "Try again in a moment."`). Anonymous vote → AlertDialog with `SignInButton` → no silent failures. Both paths are deliberate, both are tight copy. The optimistic-update comment block (`saved-trades-client.tsx:88-91`) explains the deliberate "don't re-sort mid-click" choice clearly.

## Priority Issues

- **[P1] Wide-screen "void" inside the team strip.** At 1280–1920px viewports, each `TeamRow` (`trade-card.tsx:310-372`) renders team logo + abbreviation pinned left and `OUT / IN / DELTA` pinned right with a ~700px gap between them on a 1100px card width. The asset lines below have the same shape — short summarized text + `truncate` leaves the right half blank. **Why it matters:** the card looks under-filled to Alex and visually weaker than the dense detail page he'll land on; Jordan reads the empty middle as "is something supposed to be here." Editorial confidence requires using the column or shortening it. **Fix:** drop content-area `max-w-6xl` to `max-w-4xl` (≈896px) *or* restructure `TeamRow` so the cap-stats sit immediately right of the team identity (one editorial line, anchored left) and free the right half for inline asset lines or a one-line cap-issue rationale. **Suggested command:** `/impeccable layout — fix wide-screen void in trade-card team strip`.

- **[P1] Vote rail reads as orphan UI.** Up-arrow / score / down-arrow sit flush-left at the bottom of the card with no companion control on the right (`trade-card.tsx:256-298`). No comment count, no share, no separator from the card content. Reads like leaked tooling. **Why it matters:** Jordan doesn't connect the up/down icons to *this card's* score (the code comment at `:243` even still says "vote + comment count inline" — comment count never shipped). Alex expects a comment count next to a vote rail (Reddit-pattern). **Fix:** add comment count as a muted right-side counterpart, or pair the rail with a `share`/`open` chevron on the right, or wrap the rail in a contained `bg-surface-low` strip that anchors it as toolbar. The detail page renders comments — surfacing the count here is a one-line addition. **Suggested command:** `/impeccable layout — vote rail anchor + comment count`.

- **[P2] Composite-button a11y.** `<Card role="button">` wraps real `<button>` vote children (`trade-card.tsx:192-298`). Visually fine; the click handlers use `stopPropagation`. Semantically, this is the "interactive inside interactive" smell — NVDA/VoiceOver announce "button: Open trade: …" and a sighted-but-keyboard-only user has to discover that the vote buttons exist via further Tab inside a thing that already says "button." **Why it matters:** Sam (screen reader) and the keyboard-only Alex both pay a small confusion tax on every card. **Fix:** convert `<Card>` to a Next.js `<Link>` and move the vote rail outside the link (below the link or as a sibling). The whole-card link area is preserved; the vote buttons become standalone semantics. **Suggested command:** `/impeccable harden — split card link from vote rail (a11y)`.

- **[P2] Hover shadow isn't actually brand-tinted.** Code claims "brand-tinted ambient shadow" (`trade-card.tsx:201`) but uses `rgba(5,10,20,0.6)` — pure navy-charcoal, no primary hue. Reads as a vanilla drop shadow against `surface`. **Why it matters:** small thing, but DESIGN.md's elevation rule asks for shadow tinted toward the brand, and the hover affordance is the only kinetic moment on a card the rest of the time. A 4% primary-tint glow would land. **Fix:** swap to e.g. `0 12px 32px -10px oklch(0.62 0.14 195 / 0.18)` (primary at 18% alpha) or use `--shadow-primary-ambient` token if you have one. **Suggested command:** `/impeccable colorize — brand-tint card hover shadow`.

- **[P2] Sample card lacks team logos.** SampleTradeCard (`saved-trades-client.tsx:552-595`) renders PHX/DET as text-only abbreviations; live `TeamRow` renders a 26px logo + abbreviation. The eyebrow promises "this is what a trade looks like" — the sample should match. **Why it matters:** Jordan's first impression of a card *is* the sample; landing on a real card later registers as a different component. **Fix:** render two SVG placeholder logos (or actual PHX/DET headers if the file paths are stable), or include a comment that the placeholder is intentional and adjust the eyebrow copy ("CARD STRUCTURE" instead of "WHAT A TRADE LOOKS LIKE"). **Suggested command:** `/impeccable polish — bring sample card vocabulary parity with live card`.

## Persona Red Flags

**Alex (Power User)**
- ✅ Cards keyboard-focusable now — Tab + Enter opens detail. Prior pass's biggest single Alex blocker is closed.
- ✗ No keyboard shortcut for Mine / Upvoted / All (Radix Tabs gives arrow-key cycling only once focus lands on a tab, which still requires a click or many Tabs to reach).
- ✗ No shortcut for Recent ↔ Popular toggle.
- ✗ Pagination is Previous / "Page 1 of M" / Next only — no jump-to-last, no page-number input. Painful at 20+ pages once the community grows.
- ✗ Vote keyboard path: card-as-button means Alex tabs into the card, then has to Tab again to reach vote buttons inside. The intuitive `j`/`k` and `u`/`d` Reddit/HN model isn't wired.

**Jordan (First-Timer)**
- ✅ Sample card teaches the cap-math vocabulary (date eyebrow, CAP chip, OUT/IN/DELTA, IN/OUT asset lines) before any real card loads. Strongest moment on the page.
- ✅ Vote-failure toast surfaces the error inline rather than silently rolling back.
- ✗ CAP ISSUE chip surfaces the verdict, not the reason. Jordan still has to click through to learn *why* a trade is invalid. A `title=` tooltip on the chip carrying `getSalaryRationale()` one-liner would short-circuit the round-trip. (Note: the detail page's `getSalaryRationale()` itself emits em-dashes — see Minor Observations.)
- ✗ Weak user-typed titles muddied with bold subdeck. Both visible cards have titles "Paul George traded" / "Paul George trade" — the muted-kicker placement is correct but reads as redundant noise when the subdeck headline already says "Philadelphia 76ers cross into the first apron." Could suppress the kicker when user title word-count match-rate with subdeck > 60%, or when title is <3 words.

**Casey (Mobile + on-the-go)** — implied from PRODUCT.md "mid-debate (NBA Twitter, group chat, Reddit)":
- Not exercised in this pass (1440×900 only). `flex-shrink-0` on cap-stat row and `truncate` on asset lines should degrade acceptably, but the OUT/IN/DELTA row at ≤375px will likely wrap unpredictably. Worth a `/impeccable adapt` pass at xs viewport.

**Sam (screen reader)**
- ✅ Card exposes `role="button"` + `aria-label="Open trade: {title}"`.
- ✅ Vote buttons carry `aria-label="Upvote trade"` / `"Downvote trade"`.
- ✗ Composite button (see P2) — vote children inside button parent is the announce-confusion case.
- ✗ No live region on vote count change, so a successful vote is silent.

## Minor Observations

- The "EXAMPLE. This is what a trade looks like." eyebrow lands well at full opacity over the opacity-55 sample card — the prior pass's compositional-contrast muddiness is fixed.
- `Mine 0` / `Upvoted 0` counts at 60% opacity (`saved-trades-client.tsx:484`) read appropriately quiet. Don't suppress entirely.
- The dev-comment at `trade-card.tsx:243-244` says "vote + comment count inline" but no comment count was added. Either ship the count (one-line) or strip the stale comment.
- Sample card title "Suns slide back under the second apron." — short, punchy, exactly the editorial voice you want. Use this as the gold-standard reference when reviewing future LLM-generated subdecks.
- `saved-trade-detail.tsx`'s `getSalaryRationale()` (`:370-411`) emits em-dashes (`"exceeds limit by $X — need $Y max"`). Same family as the EmptyState em-dash fix this pass shipped. Out of scope here per the brief — flagged as a follow-up on the detail page.
- Empty Mine state body copy "It lands here in the shape below, with your verdict, cap math, and assets ready to share." — "in the shape below" is doing a lot of work. The sample card is below; the user's actual saved trade will look like the sample but with their data. Acceptable phrasing.
- Footer beneath empty Mine state is a generic 3-column SaaS link list (RosterFlows wordmark + product + resources). Doesn't undermine the editorial register but doesn't reinforce it. Out of scope for /my-trades; flag for a separate `/impeccable quieter footer` pass.
- Sign-in dialog button still uses literal `<Button variant="primary">` (`saved-trades-client.tsx:193`) — palette pivot landed cleanly, no leftover `variant="indigo"` here.

## Questions to Consider

- What if the index card surfaced the cap-issue rationale inline ("CAP ISSUE · PHI must send $24M more") at `md+` viewports, collapsing back to just "CAP ISSUE" below md? Saves Jordan the click without hurting Alex.
- What if comment count rode the right side of the vote rail as a muted glyph, e.g. `↑ 5 ↓   💬 3` (right-aligned)? Solves vote-rail orphan + the missing `comment count inline` promise in one pass.
- What if the team strip collapsed from "logo + abbreviation [void] OUT/IN/DELTA" to "logo + abbreviation · OUT $60.4M · IN $67.1M · DELTA +$6.7M" as a single editorial line? Reclaims the wide-screen column, and the IN/OUT asset rows could then carry inline assets with more breathing room.
- What if the active tab indicator picked up a per-tab tinted color (Mine teal-primary, Upvoted warning-copper, All neutral)? Sub-second wayfinding without adding chrome.
