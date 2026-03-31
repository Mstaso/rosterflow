# Design System Strategy: High-Performance Sports Analytics

## 1. Overview & Creative North Star
### The Creative North Star: "The Kinetic Ledger"
This design system is built for the high-stakes, data-dense world of professional sports front offices. We are moving away from the "generic SaaS dashboard" look. Instead, we embrace **The Kinetic Ledger**—a design philosophy that treats sports data as a living, breathing entity. 

By utilizing intentional asymmetry, sophisticated tonal layering, and high-contrast typography, we create an editorial-grade experience that feels authoritative yet fluid. We do not use rigid lines to contain data; we use the depth of the dark-mode canvas to let the information "flow." The goal is to provide a premium interface that feels more like a luxury sports watch or a high-end financial terminal than a standard web app.

---

## 2. Colors & Surface Philosophy
The palette is rooted in a deep navy foundation, using vibrant blues to signify action and tertiary pinks/purples for analytical "heat" or alerts.

### The "No-Line" Rule
Standard 1px solid borders are strictly prohibited for sectioning. Structural boundaries must be defined solely through:
1.  **Background Color Shifts:** Placing a `surface-container-low` section on a `surface` background.
2.  **Tonal Transitions:** Using slight shifts in value to imply a break in content without a physical line.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of "frosted carbon fiber" sheets. 
- **Base Layer:** `surface` (#080e18) for the main application background.
- **Sectioning:** Use `surface-container-low` (#0d131f) for broad organizational areas.
- **Content Cards:** Use `surface-container` (#131a26) or `surface-container-high` (#18202d) for data cards.
- **The Depth Rule:** Never place a higher-elevation color inside a lower-elevation one (e.g., don't put `surface` inside `surface-container-highest`). Depth must always move "up" toward the user.

### The "Glass & Gradient" Rule
To add soul to the interface, main CTAs and "Success" banners (like trade validation) should use subtle linear gradients (transitioning from `primary` to `primary-container`). Floating menus or "Save" dialogs should utilize **Glassmorphism**: use `surface-variant` with a 60% opacity and a `backdrop-blur` of 20px to create a sophisticated, integrated look.

---

## 3. Typography
We use **Inter** as our typographic engine. It is clean, modern, and highly legible at small scales—critical for trade machines.

*   **Display Scale:** Use `display-md` or `display-sm` for large, high-impact player stats or trade outcomes. These should feel like newspaper headlines.
*   **Headlines & Titles:** Use `headline-sm` for team names and `title-lg` for card headers. These provide the "Editorial" structure.
*   **Data Points:** `body-md` is the workhorse for player names and salaries.
*   **The Technical Layer:** `label-md` and `label-sm` are reserved for metadata (e.g., "Cap Space," "2nd Apron"). These should use `on-surface-variant` to sit back in the hierarchy, ensuring the primary numbers pop.

---

## 4. Elevation & Depth
In this system, light is the architect. We don't use structural boxes; we use tonal layering.

*   **The Layering Principle:** Stacking `surface-container-lowest` cards on a `surface-container-low` section creates a "lifted" effect that feels natural and premium.
*   **Ambient Shadows:** For floating elements (Modals/Popovers), use a shadow color tinted with `#050a14` at 8% opacity. Shadows must be wide and soft (Blur: 32px, Spread: -4px).
*   **The "Ghost Border" Fallback:** If accessibility requires a border, it must be a **Ghost Border**. Use the `outline-variant` token at 15% opacity. Never use a 100% opaque border.
*   **Interactive Glows:** Active states (like a selected trade slot) should use a subtle outer glow using the `primary` color at 10% opacity, rather than a thick stroke.

---

## 5. Components

### Buttons
*   **Primary:** A vibrant gradient of `primary` to `primary-container`. High-impact, white text. Roundedness: `DEFAULT` (0.5rem).
*   **Secondary/Ghost:** `outline-variant` ghost border with `on-surface` text. For secondary actions like "Edit Trade."
*   **Tertiary:** Transparent background, `primary` text. Use for low-priority navigation like "Back to Generator."

### Trade Cards & Player Lists
*   **Prohibition on Dividers:** Never use horizontal lines to separate players in a list. Use `0.5rem` (Spacing 2.5) of vertical white space or a subtle background alternate (zebra striping) using `surface-container-low` and `surface-container`.
*   **Player Avatars:** Should sit within `surface-container-highest` containers with `md` (0.75rem) rounded corners.

### Status Chips (Trade Validation)
*   **The Success Bar:** For a valid trade, use a container of `surface-container-high` with a 2px left-accent border of `primary`. Do not fill the entire bar with bright green; keep it sophisticated.

### Input Fields
*   **Modern State:** Use `surface-container-low` for the field background. On focus, transition the background to `surface-container-high` and add a `primary` ghost border (20% opacity).

---

## 6. Do's and Don'ts

### Do:
*   **Do** use asymmetrical spacing (e.g., more padding at the top of a card than the bottom) to create an editorial, "Roster Flows" feel.
*   **Do** use `primary_dim` for data labels that need to be readable but shouldn't compete with the main data values.
*   **Do** lean into the `xl` (1.5rem) roundedness for large containers to soften the "data-heavy" feel.

### Don't:
*   **Don't** use pure white (#FFFFFF) for text. Use `on-surface` (#e0e5f4) to reduce eye strain in the dark environment.
*   **Don't** use standard "Success Green" or "Error Red" at full saturation. Use our custom `error_dim` and `primary` tokens to maintain the high-end color story.
*   **Don't** cram data. If a trade machine view feels cluttered, increase the spacing from `2` (0.4rem) to `4` (0.9rem) between elements.