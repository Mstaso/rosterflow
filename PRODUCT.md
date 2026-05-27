# Product

## Register

product

## Users

RosterFlow is built for **NBA capologists and trade-machine power users**: people who know what the second apron does, can rattle off the Stepien rule, and follow Bobby Marks-tier content. They're typically on desktop, often on a second monitor, often mid-debate (NBA Twitter, group chat, Reddit) when they pull it up. Job-to-be-done: model a realistic multi-team trade fast, with the cap math already correct, and walk away with a result worth screenshotting.

Casuals are welcome guests, not the target. They can land on the team picker and poke around without bouncing, but the app never dumbs down for them. The bet is that hardcore design density signals quality even to people who don't read every number.

## Product Purpose

A trade machine that generates and validates realistic multi-team NBA trades. Two flows: AI-generated scenarios (Claude reasons through fit, cap, team-building logic) and user-built proposals (validated against real cap rules).

Near-term direction is **content engine / community hub**: AI-generated trades that are interesting enough to share are the gravity that pulls people in. A paid tier could come later. Success right now looks like: someone screenshots a trade card, posts it to NBA Twitter, and the design itself gets noticed alongside the trade.

## Brand Personality

**Refined, stylish, quietly confident, not stuffy.** Takes the data seriously without taking itself seriously. Closer to a well-designed sports almanac than a Bloomberg terminal; closer to a great Nike product page than ESPN's chrome. Confident enough to use editorial typography and asymmetric layouts; warm enough that a casual fan doesn't bounce.

Voice in microcopy: tight and declarative, with room for the occasional sly note. No exclamation points. No "Awesome!" or "Oops!". Sentences end.

Three words: **refined, kinetic, dataphile-friendly**.

## Anti-references

- **ESPN, Yahoo, Bleacher Report trade machines.** Cluttered, ad-bait, forms-stacked-on-forms, generic sports-portal chrome. We exist as the antidote. If a screen would look at home on ESPN, rework it.
- **Adjacent reflex traps to avoid by default:** DFS / sportsbook aesthetics (loud gradients, gamification, dopamine-bait color), generic SaaS dashboards (cream cards, hero metrics, stock illustrations), forum-era stat sites (RealGM / HoopsHype density, ad-injected tables).

## Design Principles

1. **The data is the hero; the chrome is the stage.** Numbers, ratings, cap deltas, and player names lead. UI structure recedes through tonal layering. DESIGN.md's no-line rule is the lived expression of this.
2. **Editorial, not dashboard.** A trade scenario is a small editorial spread, not a row in a table. Asymmetric spacing, deliberate hierarchy, room to breathe.
3. **Hardcore-first, casual-friendly.** Default to expert density (cap tiers, apron labels, Stepien chips surfaced). Casual entry points stay low-friction without simplifying the underlying view.
4. **Screenshot-worthy by default.** Generated trade views should look good captured and dropped into a tweet. If a screen wouldn't survive that test, it needs more design love.
5. **Refined, not somber.** Dark mode and editorial spacing don't mean joyless. Small kinetic touches (subtle motion on validation, glow on selection, warmth in copy) keep it human.

## Accessibility & Inclusion

Design-led, no hard WCAG target. Floor commitments: body text contrast readable in normal indoor lighting (DESIGN.md's `on-surface` over `surface` already clears AA), every interactive element has a visible focus state, motion respects `prefers-reduced-motion`.
