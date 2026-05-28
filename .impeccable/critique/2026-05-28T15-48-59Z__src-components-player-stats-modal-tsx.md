---
target: src/components/player-stats-modal.tsx
total_score: 21
p0_count: 2
p1_count: 3
timestamp: 2026-05-28T15-48-59Z
slug: src-components-player-stats-modal-tsx
---
# Critique — player-stats-modal.tsx — first pass

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Backdrop fade + zoom-in entrance, loading skeleton, error copy. No aria-busy. |
| 2 | Match System / Real World | 3 | NBA stat vocabulary correct. "Age: 0" renders for falsy-age player. |
| 3 | User Control and Freedom | 1 | No Esc to close. Verified — Escape leaves modal open. Only X button or backdrop click. No focus return. No focus trap. |
| 4 | Consistency and Standards | 1 | Bespoke modal vs Radix Dialog elsewhere. Eyebrows use tracking-wider, not project's font-supermolot. Hero-metric template (banned). Hardcoded indigo #6366f1 (pre-teal palette). text-white where DESIGN.md mandates on-surface. |
| 5 | Error Prevention | 2 | Opens unconditionally even when espnId missing — dead-end. |
| 6 | Recognition Rather Than Recall | 3 | NBA-standard abbreviations (GP/MIN/FG/OR/DR). Familiar to Alex, opaque to Jordan. No tooltips. |
| 7 | Flexibility and Efficiency | 2 | No keyboard close, no Tab cycle between players, no copy/export. |
| 8 | Aesthetic and Minimalist Design | 2 | Hero-metric template (banned). Pure #fff + #000. Gradient with mud-overlay. |
| 9 | Error Recovery | 2 | "Unable to load stats" — no retry. Empty espnId is dead-end. |
| 10 | Help and Documentation | 2 | No tooltips on stat abbreviations. No ESPN source link. |
| **Total** | | **21/40** | **Below bar. Two P0s + four P1s. Same starting score as /my-trades pass 1.** |

First run for this target — no trend yet.

## Anti-Patterns Verdict

**Does this look AI-generated?** Partially. Hero block + gradient + glass = generic SaaS-modal aesthetic, close to ESPN's player popovers (anti-referenced in PRODUCT.md). Dense season table is on-brand but buried.

**LLM assessment**:
- ❌ Hero-metric template — DESIGN.md absolute ban. PTS/REB/AST/FG% in text-2xl font-bold + text-[10px] uppercase labels.
- ❌ Pure black + pure white — jersey badge bg-white text-black, header text-white throughout.
- ❌ Modal as first thought — DESIGN.md ban. Could be slide-over panel or inline expand.
- ⚠️ Glassmorphism (glass class) — DESIGN.md permits for modals/popovers, on-spec.
- ⚠️ Eyebrow vocabulary drift — text-[10px] font-semibold uppercase tracking-wider instead of font-supermolot text-[10px] tracking-[0.22em].
- ⚠️ Hardcoded ESPN endpoint client-side — inconsistent with /api/espn/athlete/${espnId} route used immediately above.

**Deterministic scan**: unavailable (detect.mjs missing — 4th consecutive run).

**Visual overlays**: not injected. Captured 3 screenshots + JS introspection confirming role=null, aria-modal=null, gradient=linear-gradient(135deg, rgb(29,66,138) 0%, rgb(224,18,52) 100%). Console clean. Esc verified non-functional.

## Overall Impression

Modal pulls real per-game career table, current-season highlight, jersey, contract, dimensions — right data. Execution lets data down. Hero block is exact SaaS cliché the rest of the app avoids; dense table below is editorial moment compressed into 28vh with double scroll axes. Keyboard users can't escape; screen-reader users get no dialog landmark. Two visible bugs (Age: 0, Esc-doesn't-close) compound impression that this component was built earlier than rest and never came forward.

Biggest opportunity: swap bespoke modal for Radix Dialog primitive. One change ships focus trap, Esc, ARIA, body scroll lock, focus return — all free. Then re-author inside with editorial vocabulary.

## What's Working

- **Real career table.** player-stats-modal.tsx:310 — tabular, dense, current-season highlighted, career-totals row pinned bottom. Almanac-feel.
- **Parallel data fetch.** player-stats-modal.tsx:79 — stats + athlete info in Promise.all, each response.ok checked, each shape guarded.
- **Optional team-color theming.** Header gradient picks up athlete's actual team color when available. Intent is right.

## Priority Issues

- **[P0] Age: 0 renders as raw 0.** player-stats-modal.tsx:242 — {player?.age && (<span>Age: {player.age}</span>)}. When player.age === 0 (saved-trade-detail.tsx:1127 default), 0 && ... returns 0, React renders literally.
  **Why it matters:** functional bug visible on every player opened from saved-trade-detail (always passes age: 0). Reads as data error.
  **Fix:** {player?.age ? <span>Age: {player.age}</span> : null} or guard with !!player?.age.
  **Suggested:** /impeccable harden — kill falsy-zero render bugs.

- **[P0] No Esc, no focus trap, no role/aria-modal.** Verified: Escape does nothing. .glass.getAttribute('role') = null. aria-modal = null.
  **Why it matters:** every keyboard-only user and screen-reader user stuck. Below WCAG 2.1.1 (Keyboard) — floor commitment PRODUCT.md named.
  **Fix:** replace bespoke <div> shell with Radix Dialog. Primitive ships Esc, focus trap, ARIA, body scroll lock, focus return free.
  **Suggested:** /impeccable harden — port to Radix Dialog.

- **[P1] Hero-metric template (absolute ban).** player-stats-modal.tsx:270-285. PTS/REB/AST/FG% text-2xl font-bold + text-[10px] uppercase = textbook SaaS cliché.
  **Why it matters:** DESIGN.md + shared laws explicitly name this. Season History table immediately below already carries the same numbers (current-season row highlighted).
  **Fix:** delete hero block. If summary line desired, render inline editorial under player name: "2025-26: 17.3 pts · 5.3 reb · 3.6 ast · 43.9% FG · 37 games".
  **Suggested:** /impeccable distill — strip hero metrics.

- **[P1] Pure white + pure black tokens.** Header text (text-white), jersey badge (bg-white text-black), headshot border. DESIGN.md forbids #fff/#000.
  **Why it matters:** consistency drift. Pure white over colored gradient also less readable at certain hues than tinted neutral.
  **Fix:** text-white → text-on-surface. Jersey badge bg-white text-black → bg-surface text-on-surface + 1px tinted shadow.
  **Suggested:** /impeccable polish — token compliance.

- **[P1] Bespoke modal duplicates Radix infrastructure.** player-stats-modal.tsx:174-373 — fixed backdrop, manual !isOpen return null. Detail page next to it uses AlertDialog (Radix). Two modal patterns in one feature.
  **Why it matters:** composite of two P0s above — porting to Dialog primitive closes both P0s and this P1 in one PR.
  **Fix:** see P0 #2.

## Persona Red Flags

**Alex (Power User)**
- ✗ Esc doesn't close modal.
- ✗ No Tab cycle between players in the trade.
- ✗ No Cmd+C "Copy as Markdown/CSV" on table.
- ✗ Stats table has horizontal + vertical scroll inside modal — three nested scrolls at xs.

**Jordan (First-Timer)**
- ✗ "Age: 0" reads as data error.
- ✗ Stat-column abbreviations (OR, DR, PF, TO, BLK) without tooltips. Bobby-Marks fluency assumed.
- ✗ Backdrop bg-black/80 heavy — page silhouette nearly black, loses spatial-context cue.

**Sam (screen reader)**
- ✗ role="dialog" missing → no landmark.
- ✗ aria-modal="true" missing → outside in tab order.
- ✗ Close button no accessible name.
- ✗ No aria-labelledby linking dialog to player h2.
- ✗ Loading state no aria-busy.

**Casey (mobile)** — modal max-w-2xl + stats banner + 28vh table + horizontal-scroll = highly compressed at xs. Probably wants bottom-sheet Drawer. Not exercised this pass.

## Minor Observations

- Legacy palette fallback #6366f1 (pre-teal pivot).
- Direct ESPN client-side call inconsistent with /api/espn/athlete server route used above.
- (cat: any) TypeScript escape.
- Loading skeleton single h-32 w-full — doesn't match final table shape; layout jolts on data arrival.
- Header bg-black/20 overlay flattens gradient.
- No motion-reduce: on animate-in zoom-in-95.
- Career totals row border-t-2 — 2px structural line, violates ghost-border rule.
- Sticky-column visual seam: first column bg-background, rest of row transparent on bg-surface-low.
- displayName has no firstName+lastName fallback.
- Detector unavailable 4 consecutive runs.

## Questions to Consider

- What if PlayerStatsModal became PlayerStatsSheet — slide-over from right on desktop, bottom sheet on mobile?
- What if modal navigated between players in the trade with ← / → keys?
- What if dense season table were the entrypoint and 4-stat hero block collapsed into a single editorial line?
- What if hovering column headers revealed one-line definition tooltips?
- What if modal embedded ESPN attribution + "View on ESPN" link?
