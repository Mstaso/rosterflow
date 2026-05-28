---
target: /my-trades (saved-trades index)
total_score: 33
p0_count: 0
p1_count: 2
timestamp: 2026-05-28T14-19-21Z
slug: src-components-my-trades-saved-trades-client-tsx
---
# Critique — `/my-trades` (saved-trades index)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Active tab, sort current state, optimistic vote, CAP VALID/CAP ISSUE chip per card. |
| 2 | Match System / Real World | 4 | NBA cap vocabulary (CAP, apron-by-implication), OUT/IN/Δ inline, editorial date eyebrow. |
| 3 | User Control and Freedom | 3 | Vote toggle reversible; tab/sort instant; no per-card delete from index (lives on detail — fine). |
| 4 | Consistency and Standards | 3 | Two leaks: `Δ` (index) vs `Delta` word (detail) per DESIGN.md spec; sort uses pill-button vocabulary while tabs use editorial underline within 16px of each other. |
| 5 | Error Prevention | 3 | Sign-in prompt prevents anonymous-vote failures; optimistic vote rolls back on throw; constrained inputs. |
| 6 | Recognition Rather Than Recall | 4 | Eyebrow + labeled buttons everywhere; counts inline next to tab labels; EmptyState teaches by sample card. |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts; cards are non-focusable `<Card>` divs (cannot tab-and-enter into detail); no batch ops; optimistic vote is the only accelerator. |
| 8 | Aesthetic and Minimalist Design | 4 | Asymmetric pt-5/pb-3 padding, depth-up tonal layering, zero rule lines, font-supermolot eyebrows. Earns every pixel. |
| 9 | Error Recovery | 3 | Vote rollback is silent — no toast or inline "couldn't record vote." Confused first-timer reads it as the click missing. |
| 10 | Help and Documentation | 3 | EmptyState's SampleTradeCard teaches vocabulary; CAP chips have `title=` tooltips; `Δ` symbol unexplained; sort-disabled tooltip is desktop-hover only. |
| **Total** | | **33/40** | **Good — close the keyboard/efficiency and recovery gaps and this is shippable.** |

Trend recap: prior run **21/40 → 33/40**. The vocabulary unification (Community Trades), editorial TradeCard rewrite, demoted vote rail, hoisted SortToolbar, and teach-by-sample EmptyState lifted four heuristics (Match, Recognition, Aesthetic, Visibility) from middling to excellent.

## Anti-Patterns Verdict

**Does this look AI-generated?** No. The editorial-eyebrow + tabular-nums + depth-up layering reads like a curated sports almanac, not a SaaS template. The reflex-traps (DFS gradients, ESPN chrome, hero-metric blocks) are all avoided. The SampleTradeCard in the EmptyState is a confident, register-correct choice — most products would put a generic SVG illustration here.

**LLM assessment (DESIGN.md bans + shared design laws)**:
- ✅ No side-stripe borders, no `background-clip: text` gradients, no glassmorphism, no hero-metric template, no modal-as-first-thought.
- ✅ All cards are uniform shells, but each carries unique editorial data — not the "icon + heading + text repeated endlessly" failure mode.
- ⚠️ **Em-dashes in EmptyState body copy** ([src/components/my-trades/saved-trades-client.tsx:253](src/components/my-trades/saved-trades-client.tsx:253), [:269](src/components/my-trades/saved-trades-client.tsx:269)): "save it — it lands here…" / "what looks right — anything you back…" — shared design laws forbid `—`.
- ⚠️ Sort toolbar uses pill-style `variant="secondary"` button toggles ([:402-421](src/components/my-trades/saved-trades-client.tsx:402)) while tabs use editorial underline ([:228-243](src/components/my-trades/saved-trades-client.tsx:228)). Two vocabulary registers sitting 16px apart.

**Deterministic scan**: unavailable — `detect.mjs` entrypoint missing (`Error: bundled detector not found.`). Findings above are from manual scan of `saved-trades-client.tsx` and `trade-card.tsx` against the DESIGN.md + shared-law checklist.

**Visual overlays**: not injected — Assessment B falls back to manual scan because the detector is unavailable. Browser pass produced 7 screenshots (logged-in All, Mine-empty, Mine-empty scrolled, Upvoted-empty, All scrolled, All footer, Clerk popover) used as evidence above.

## Overall Impression

The page now reads like one continuous editorial — the navbar masthead, tab strip, sort toolbar, and TradeCard all share the same uppercase-tracking vocabulary. The biggest visible win is the EmptyState: the SampleTradeCard at opacity-70 with an "EXAMPLE — THIS IS WHAT A TRADE LOOKS LIKE" eyebrow teaches the cap-math reading order in 3 seconds — exactly what Jordan needs. The biggest remaining liabilities are (a) cards aren't keyboard-focusable so Alex can't tab through, and (b) failed votes silently rewind so Jordan can't tell the click registered.

Single biggest opportunity: make the cards real `<button>` or `role="button" tabindex={0}` so keyboard nav actually works — that one change clears the largest Heuristic-7 / Persona-Alex gap.

## What's Working

- **EmptyState teach-by-sample** ([:466-571](src/components/my-trades/saved-trades-client.tsx:466)). The static SampleTradeCard with "MAY 14 · CAP VALID — Suns dump Beal for cap relief; Pistons land a vet wing rotation" and PHX/DET strips trains the eye on the live card vocabulary before any real data exists. Per-tab heading + CTA keeps the next action obvious. This is the strongest part of the page.
- **Editorial tab strip** ([:228-244](src/components/my-trades/saved-trades-client.tsx:228) + [:436-464](src/components/my-trades/saved-trades-client.tsx:436)). The 2px primary underline matches the navbar's editorial-label pattern, counts ride as muted `tabular-nums` next to each label, and the relative-positioned `after:` pseudo prevents layout shift on hover/focus. Exactly the DESIGN.md "Navigation" spec — both registers (page nav + in-page tabs) sing the same magazine.
- **TradeCard vocabulary parity with detail page**. Date eyebrow, CAP VALID/CAP ISSUE chip, headline, subdeck, per-team `bg-surface-high` strip inside `bg-surface-container` card. Depth moves up toward the user (DESIGN.md no-line + elevation rules), and the subdeck is computed from cap math (`computeSubdeck`) so the index card always reads as the contact-sheet for the detail article.

## Priority Issues

- **[P1] Cards aren't keyboard-focusable.** The `<Card>` at [trade-card.tsx:175-178](src/components/my-trades/trade-card.tsx:175) carries `onClick={onClick}` and `cursor-pointer` but is a plain div. **Why it matters:** Alex can't tab to a card and hit Enter to open the detail page; Sam (screen reader) has no announced affordance. Currently 46 focusable elements on the page — none of them are the cards themselves. **Fix:** Wrap each card in a Next.js `<Link>` *or* add `role="button" tabIndex={0}` plus an `onKeyDown` Enter/Space handler. Make sure the inner vote buttons still `e.stopPropagation()`. **Suggested command:** `/impeccable harden trade-card.tsx — keyboard activation`.
- **[P1] Silent vote-failure rollback.** [saved-trades-client.tsx:103-113](src/components/my-trades/saved-trades-client.tsx:103) catches a `voteOnTrade` throw and restores the snapshot with no user-facing feedback (only `console.error`). **Why it matters:** Jordan reads the snap-back as the click missing and re-clicks, doubling the failed request. Casey on flaky cellular gets repeated invisible failures. **Fix:** Surface a transient toast or inline "Couldn't record vote — try again" near the vote rail. **Suggested command:** `/impeccable clarify — vote failure copy + toast wiring`.
- **[P2] DELTA vs Δ vocabulary drift between index and detail.** DESIGN.md "Standardized Trade-Result View Conventions" spec the editorial eyebrow as `Out / In / Delta`. Index uses `Δ` ([trade-card.tsx:332](src/components/my-trades/trade-card.tsx:332)); detail uses `Delta` ([saved-trade-detail.tsx:709-710](src/components/my-trades/saved-trade-detail.tsx:709)). **Why it matters:** Jordan has to translate the glyph; Alex notices the inconsistency immediately. **Fix:** Pick one. `Δ` is fine at narrow widths but only if it's universal. The DESIGN.md spec says "Delta" word; bring the detail page's choice to the index, or update DESIGN.md if `Δ` is the new canon. **Suggested command:** `/impeccable clarify — standardize Out/In/Delta eyebrow across index + detail`.
- **[P2] Sort toolbar vocabulary clashes with tabs.** Sort uses pill-style `variant="secondary"` button toggles with leading lucide icons ([saved-trades-client.tsx:402-421](src/components/my-trades/saved-trades-client.tsx:402)); the tabs 16px below use editorial uppercase-tracking underline. **Why it matters:** Two segmented controls in the same column read as belonging to two different products. **Fix:** Drop the icons, restyle the buttons to the same `font-supermolot text-[11px] tracking-[0.22em]` vocabulary as the tabs (active = primary text, inactive = on-surface-variant). Or convert Sort to a one-line eyebrow + small text-button pair. **Suggested command:** `/impeccable typeset — unify sort + tab type vocabulary`.
- **[P2] Em-dashes in EmptyState body copy.** [saved-trades-client.tsx:253](src/components/my-trades/saved-trades-client.tsx:253) ("save it — it lands here…") and [:269](src/components/my-trades/saved-trades-client.tsx:269) ("what looks right — anything you back…"). Shared design laws forbid `—`. **Why it matters:** Two of the three editorial laws cited in PRODUCT.md ("tight and declarative", "Sentences end") want commas or periods here. **Fix:** Replace each `—` with a comma. **Suggested command:** `/impeccable clarify — strip em-dashes from EmptyState copy`.

## Persona Red Flags

**Alex (Power User)**
- Cards not keyboard-focusable — cannot Tab + Enter to a trade. The biggest single Alex blocker on the page.
- No keyboard shortcut for Mine/Upvoted/All (Radix Tabs default gives arrow-key cycling once focus is on a tab — but Alex has to mouse-click the tab strip first to get focus there).
- No shortcut for Recent ↔ Popular toggle.
- Pagination is Previous / "Page 1 of M" / Next only — no jump-to-last, no page-number input. Tolerable at <5 pages, painful at 20+.

**Jordan (First-Timer)**
- `Δ` glyph unexplained. The CAP VALID/CAP ISSUE chips have `title=` tooltips, but `Δ` does not.
- Silent vote-failure rollback (see P1) — Jordan re-clicks thinking nothing happened.
- The "CAP ISSUE" chip surfaces only the verdict, not the reason — Jordan can't tell *why* without clicking through. (The detail page surfaces the rationale, so the progressive disclosure is correct — but at least a tooltip with one-line reason on the index card would short-circuit the round-trip.)
- The strongest win: the SampleTradeCard teaches every vocabulary item Jordan needs (date eyebrow, OUT/IN/Δ, IN/OUT asset lines) before they make their first trade. This persona was the redesign's primary winner.

## Minor Observations

- [trade-card.tsx:243-244](src/components/my-trades/trade-card.tsx:243) code comment says "vote + comment count inline" but no comment count is rendered. Either add the count (would be a nice activity signal for popular trades) or drop the comment.
- Sign-in dialog button still uses `variant="indigo"` ([saved-trades-client.tsx:194](src/components/my-trades/saved-trades-client.tsx:194)) — palette pivoted to teal but the variant token kept the legacy name. Cosmetic; rename in a follow-up.
- Tab counts of `0` for Mine/Upvoted are already at 60% opacity — fine. Don't suppress them entirely; the explicit 0 is more reassuring than a missing chip.
- Footer on `/my-trades` is a generic 3-column SaaS-link list. Doesn't undermine the editorial register but doesn't reinforce it either. Out of scope here; flag for a separate `quieter` pass.
- Sample card's "EXAMPLE — THIS IS WHAT A TRADE LOOKS LIKE" eyebrow is at `opacity-60` on top of a card at `opacity-70`. Compositional contrast is muddy. Push the card to opacity-55 *or* lift the eyebrow back to full opacity — one of them should anchor.
- Sort tooltip ("Sort applies to All — Mine and Upvoted stay chronological.") uses an em-dash. Same as above; replace with a period.

## Questions to Consider

- What if the index card surfaced the computed subdeck *as the headline* and demoted the user-typed title to the eyebrow? User titles are often weak ("Paul George trade", "harden to hawks summer"); the computed `computeSubdeck` line reads better as the contact-sheet headline.
- What if the empty Mine state — for a *signed-in* user — showed two or three real popular community trades inline ("Trades from the room while you build yours") instead of a static sample? Same teaching effect, plus activation.
- What if `Δ` lived alongside a one-glyph cap-tier badge (▲ second apron / ▴ first apron / · over cap / · under cap)? Trades involving teams in the second apron would carry more visible stakes without any chrome growth.
- What if the cap chip carried a one-line reason inline at >`md` breakpoints (e.g. "CAP ISSUE — LAC must send $24M more") and collapsed to just "CAP ISSUE" below md? Saves Jordan the click; doesn't hurt Alex.
