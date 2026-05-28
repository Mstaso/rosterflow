---
target: /my-trades (saved-trades index)
total_score: 36
p0_count: 0
p1_count: 0
timestamp: 2026-05-28T15-32-41Z
slug: saved-trades-client-tsx
---
# Critique — `/my-trades` (saved-trades index) — fourth pass

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Focus ring on Link, active tab/sort underlines, optimistic vote, toast on failure, comment count visible per card. |
| 2 | Match System / Real World | 4 | NBA cap vocabulary, OUT/IN/DELTA, MAY 18 editorial date eyebrow. |
| 3 | User Control and Freedom | 3 | Vote toggle, sort/tab instant. No bulk ops, no per-card delete from index. |
| 4 | Consistency and Standards | 4 | Sample card now carries real PHX/DET logos + comment-count vote rail — full parity with live card. DELTA word universal. Em-dashes scrubbed on index and detail. |
| 5 | Error Prevention | 3 | Sign-in dialog gates anonymous voting; optimistic rollback. |
| 6 | Recognition Rather Than Recall | 4 | Eyebrows page-deep, counts inline, sample card teaches by demonstration with logos. |
| 7 | Flexibility and Efficiency | 3 | Card is a real <Link> now. Still no Mine/Upvoted/All shortcut, no Recent↔Popular shortcut, no jump-to-page pagination. |
| 8 | Aesthetic and Minimalist Design | 4 | Void resolved (TeamRow packs left, single editorial line). Vote rail anchored both ends. Cards read dense and scannable. |
| 9 | Error Recovery | 4 | Sonner toast on vote failure; sign-in dialog routes anonymous. |
| 10 | Help and Documentation | 3 | Sample card matches live vocabulary. CAP ISSUE chip still doesn't surface rationale on index card. |
| **Total** | | **36/40** | **Strong. Diminishing-returns territory; remaining gains are progressive-disclosure + keyboard accelerators.** |

Trend: 21 → 33 → 35 → 36. Structural debt (void, orphan rail, composite-button, sample parity) paid. What's left is feature-shaped (shortcuts, inline rationale) not craft-shaped.

## Anti-Patterns Verdict

**Does this look AI-generated?** No. The biggest tell-clean this pass: the sample empty-state card now carries the same vocabulary, logos, and vote rail as the live cards.

**LLM assessment**:
- ✅ All shared absolute bans: clear.
- ✅ Composite-button anti-pattern resolved: Card shell wraps Link (header + team rows) + sibling VoteRail.
- ✅ Wide-screen void resolved: TeamRow packs identity + cap stats onto one flex-wrap line, left-anchored.
- ✅ Vote rail anchored on both ends — up/score/down left, comment-count right.
- ✅ Em-dashes scrubbed across index and detail getSalaryRationale().
- ⚠️ Hover affordance now leans on translate + bg-shift only (glow removed by user choice). Subtle but intentional.
- ⚠️ CAP ISSUE chip still doesn't expose the rationale inline.

**Deterministic scan**: still unavailable (detect.mjs bundled entry missing — third pass reporting this; worth flagging upstream).

**Visual overlays**: not injected — fallback to browser screenshots. Captured 4 fresh screenshots at 1440×900. Console clean.

## Overall Impression

Production-quality. The team strip collapsing to one editorial line and the vote rail growing a right-side comment-count anchor change the rhythm of the card from "data anchored to opposite walls of a wide hall" to "one packed left-to-right paragraph." Sample card matching live cards down to logos closes the teaching loop completely.

What's left is progressive disclosure and power-user accelerators: surface cap-issue rationale on the index without a click, wire keyboard shortcuts, replace Prev/Next with jump-to-page.

## What's Working

- **TeamRow as editorial paragraph.** trade-card.tsx:310 — logo · ABBREV · OUT $X · IN $X · DELTA ±$X on one wrap-friendly line. Eye scans left-to-right naturally instead of jumping across dead space.
- **Vote rail anchored on both ends.** trade-card.tsx:165 — up/score/down left, comment-count right with aria-label + aria-live="polite". No longer reads as floating tools.
- **Card → Link semantics.** trade-card.tsx:181 — Card shell wraps real Link with VoteRail sibling. SR announces "Open trade" link cleanly; vote buttons are top-level interactives.
- **Sample card parity with live.** saved-trades-client.tsx:572 — real PHX/DET ESPN logos via next/image, full inline TeamRow shape, vote rail with comment count. "EXAMPLE" promise honest end-to-end.

## Priority Issues

- **[P2] CAP ISSUE chip still doesn't surface its reason.** Validator already computes a one-liner in saved-trade-detail.tsx:370 getSalaryRationale(). Index cards show only the verdict.
  **Why it matters:** Jordan reads "CAP ISSUE", has no idea why, and either clicks through or scrolls past. Cost to expose: one title= attr or one inline span at md+.
  **Fix:** lift getSalaryRationale() from saved-trade-detail.tsx into trade-warnings.ts so both views consume the same string; pass to CAP ISSUE chip as title= (or inline at md+).
  **Suggested:** /impeccable clarify — surface cap-issue rationale on index card.

- **[P2] No keyboard accelerators for power use.** Alex still has to mouse-click into the tab strip to engage Radix arrow-key cycling. No j/k between cards, no u to upvote, no r/p to toggle sort.
  **Why it matters:** PRODUCT.md targets "NBA capologists and trade-machine power users" — exactly the audience that lives in keyboard-driven tools.
  **Fix:** add a small keymap (useEffect with keydown listener gated by !isInputFocused()) for tab switch, sort toggle, j/k between cards, u/d on focused card.
  **Suggested:** /impeccable harden — keyboard shortcuts for tab/sort/vote.

- **[P2] Pagination tops out at Prev/Page-N-of-M/Next.** Tolerable at <5 pages, painful at 20+.
  **Why it matters:** As All grows past one page of Recent, finding last week's trade requires many Next clicks.
  **Fix:** replace central span with editable page input + jump-to-last button, or render windowed page numbers (1 … 4 5 [6] 7 8 … 20). Keep editorial vocabulary.
  **Suggested:** /impeccable harden — paginate jumps + windowed numbers.

## Minor Observations

- Hover state translate + bg-shift only (per user choice). Squint test still passes; quieter than most click-card UIs. Intentional.
- VoteRail at score=0 renders 0 muted. Explicit 0 more reassuring than blank.
- aria-live="polite" on score announces on every vote. Acceptable.
- Kicker ("Paul George traded") still appears when user title is weak. Suppress when overlap with subdeck > 60%, or title length ≤ 3 words. P3 polish.
- Footer beneath empty Mine still generic 3-column SaaS link list. Out of scope.
- detect.mjs reported missing on three consecutive runs. File upstream.

## Persona Red Flags

**Alex (Power User)**
- ✅ Card is a real <Link>; Tab + Enter standard. SR announces cleanly.
- ✅ Comment count visible without click-through.
- ✗ No j/k/u/d/r/p shortcuts. Mouse-only feels off for the persona.
- ✗ Pagination still Prev/Next only at scale.

**Jordan (First-Timer)**
- ✅ Sample card teaches with real logos and real vote rail.
- ✅ Vote failure toast — no silent rollback.
- ✗ CAP ISSUE chip still verdict-only.

**Sam (screen reader)**
- ✅ Card no longer interactive; Link is.
- ✅ Vote rail aria-labels + aria-live="polite" on score.
- ✅ Empty state semantic h3 + p + button.

**Casey (mobile)** — not exercised this pass. New flex-wrap TeamRow should degrade to two-row layout at narrow widths. Worth one xs screenshot to confirm.

## Questions to Consider

- What if CAP ISSUE chip became hoverable everywhere, surfacing getSalaryRationale() inline? One PR closes Jordan's biggest gap and lifts H10 to 4.
- What if index showed most-upvoted comment as a muted line under headline? Turns comment count from glyph into editorial bait.
- What if Recent/Popular sort were a single segmented select styled as eyebrow text, freeing horizontal real estate for search?
- What if cards used view-transition-name for headline + cap chip, so navigation to detail felt like the same article expanding?
