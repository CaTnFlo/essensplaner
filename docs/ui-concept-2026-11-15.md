# Meal planner UI proposal

Status: visual direction and UX refinements updated at the user's request on 15 November 2026. These are design artifacts; no redesign, wish-selection, undo or synchronization implementation is included. The existing review fixes remain separate. The latest [mockups and behavior contract](mockups/README.md) supersede earlier chat images and conflicting earlier proposals.

The goal is to replace or move one of three weekly dishes quickly, while keeping cooking days, eating days and shopping consequences visible. Keep the three destinations, orange accent, system font, static ES modules and Firebase storage. Move navigation to a bottom bar labelled “Woche”, “Einkauf” and “Rezepte”.

## Mobbin references

All references below are iOS screenshots or flows inspected through the connected Mobbin account. They inform a mobile web interface, not a copy of any app.

| App and screen/flow | Observed pattern | Adaptation for this app |
| --- | --- | --- |
| [Recime: Meal Plan, populated week](https://mobbin.com/flows/041c90ab-7821-4dc1-8962-41ddc49ad94f?tab=screens&utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp) | Separate day sections and a visible grocery action above the plan. | Use three explicit meal blocks for So + Mo, Di + Mi and Do + Fr. Keep cooking information separate, especially “Sonntag vorkochen” for B. Do not introduce a seven-day calendar or new week navigation. |
| [Blue Apron: weekly menu](https://mobbin.com/screens/c76e2e0a-147f-41e1-a4b5-5579cc50c433?utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp) | Compact recipe rows separate title, duration and a new-recipe marker. | Give recipe names the strongest type; place duration and dietary/device badges on a quiet secondary line. Omit prices, promotional copy and unavailable photos. |
| [Crouton: Adding a recipe, selection sheet](https://mobbin.com/flows/3d70e281-7384-4810-afb1-1c8385a2ae10?tab=screens&utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp) | Recipe selection opens in a sheet with a close control, search and tags. | Keep the weekly plan behind one sheet titled for the destination slot. Search and filters precede a single list; no folder hierarchy for this small catalog. |
| [NYT Cooking: Filter sheet](https://mobbin.com/screens/b403979a-09a7-4e8f-9aed-1cfec328a282?utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp) | Cooking-time options and meal types are selectable chips. | Offer the requested six filters with clear selected states and targets of at least 48 CSS px. Use sentence-case labels and fewer groups. |
| [Kitchen Stories: Filter](https://mobbin.com/screens/1e181e40-4847-496d-8f39-61f446ed9197?utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp) | Reset control and result count remain easy to find. | Show a live candidate count and “Filter zurücksetzen”. A zero-result state explains how to widen the search without dropping R1. |
| [Swiggy: shopping list](https://mobbin.com/screens/de0f97bc-c665-431e-9cfc-7c47502f8bc8?utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp) | Ingredients appear as compact rows with one clear action area. | Use readable ingredient rows, aligned amounts and an obvious “Liste kopieren” action per shopping day. Do not copy cart creation or add shared checkboxes without a separate state decision. |
| [Crouton: Reordering recipes](https://mobbin.com/flows/30b04cbe-62f7-4248-b339-3ddf7cf0f885?tab=screens&utm_source=chatgpt&utm_medium=ai-assistant&utm_source_platform=mcp) | The lifted recipe appears above the list, and the final screen shows the changed order. | Give the dragged dish a visible lifted state and highlight the target meal block. Screenshots do not establish Crouton's press duration, Pointer Events implementation or auto-scroll behavior; those are implementation decisions here. |

## Hallmark decisions

**Hallmark · v2.0.0**

- Scope: existing app screens, preserving the three destinations in bottom navigation. No marketing hero, stock food imagery, promotional sections or screen word quota.
- Theme: neutral white/dark surfaces with the selected brighter orange #E66D20, dark canvas #121214 and cards #232326; small dark accents use #FF9B5D. See the [selected palette and contrast constraints](mockups/README.md#selected-neutral-palette). The week board shows the selected palette; the other boards illustrate UX with earlier neutral accent shades. Runtime CSS is unchanged.
- Signature: three meal blocks that distinguish when a dish is cooked from when it is eaten. The B block must make Sunday preparation for Tuesday/Wednesday unmistakable.
- Material: actual recipe names, duration, categories and planning data. No recipe photographs exist in the current data model, so no image placeholders are proposed.
- Files to edit after approval: `js/app.js`, `js/planner.js`, `css/app.css`, `SPEC.md`, planner tests and app tests. Add `js/icons.js`, `js/plan-drag.js`, icon attribution and a shared `design.md`; add `css/tokens.css` if extracting existing tokens simplifies the stylesheet. Do not delete routes or replace the component tree wholesale. `js/shopping.js` should need tests for moved C ingredients, not a new calculation model.
- Baseline: Hallmark static audit found 2 Floor failures, 10 Reflex findings and 2 warnings. The built-in render tier was unavailable because `puppeteer-core` is absent; Playwright supplied separate screenshots and geometry checks. No completed-redesign or clean-sweep claim is made.

Preserved source evidence: `css/app.css:1` and `:16` hold both palettes; `:41` uses the system font; `:44` caps the container at 640px; `:51` provides visible focus; `js/app.js:431` retains the tab shell. Existing mobile screens are in [review-assets](review-assets/).

The visual problems are uneven wrapping of equally prominent card actions, an inline replacement list that pushes the week away, and long recipe names competing with several buttons. The existing orange, readable system font, three meal blocks and dark palette are useful and remain.

## Proposed screens and behavior

### Week

Each block starts with a small calendar outline and its eating days as a real heading: “So + Mo”, “Di + Mi”, “Do + Fr”. Show the recipe name, duration and a separate cooking instruction. “Sonntag vorkochen” must remain visible for B. A tap on the recipe opens details; one labelled overflow control contains replacement, reroll, Bring and move actions. Preserve “Hat geschmeckt” in the marked new recipe's detail/action view. Orange identifies selection and the primary action; neutral surfaces carry the rest. Avoid rows of competing buttons.

Automatic recipe selection already exists behind “Woche planen”; unattended scheduled generation does not. Add one optional wish for the current week, with “Tag egal” or one of the three eating-day groups. Before a wish exists show “Wunschgericht”; afterwards show “Wunsch ändern” and a “Dein Wunsch” pin on the assigned dish. The wish sheet allows changing or releasing the wish. With one wish set, “2 Gerichte neu planen” preserves it and generates the other two dishes. A successful change offers “Rückgängig”. Compatibility rules and remote-update safeguards are in the [behavior contract](mockups/README.md).

Use inline SVGs matching the existing 24px viewBox, stroke 2 and `currentColor`. Icons support text labels, including new, fish, poultry, Airfryer and duration. Use a local subset of an open icon set and include its exact license and attribution. No icon font, emoji or runtime icon library.

### Replace recipe sheet

Open one modal sheet for the chosen block, for example “Gericht für Di + Mi ändern”. Keep search, close button and a concise result count visible; let the result list scroll. Respect the safe area and software keyboard. On larger screens, constrain the same dialog to a readable width.

Filter candidates by R1 before search or UI filters, preserve favorites-first ordering and omit the currently selected entry. All mutations still go through `setzeSlot` and `uebernehmePlan`. Recipe selection immediately commits and closes the sheet; closing or pressing Escape without selection changes nothing.

Proposed filter definitions:

| Filter | Meaning |
| --- | --- |
| Favoriten | `istFavorit` from the existing candidate model. |
| Neu | Non-favorite pool recipe not in `probiert`, or non-favorite open link. Previously tried pool recipes remain available with the filter off. |
| Bis 30 Min. | `dauerMin <= 30`, independent of the optional `schnell` tag. |
| Airfryer | `airfryer === true`. |
| Fisch / Geflügel | OR within these two protein choices; combine with the other filter groups using AND. |

“Favoriten” and “Neu” are mutually exclusive status choices. Search matches recipe/link titles and combines with filters. Links have unknown duration and appliance/protein information, so they do not match those filters; display unknown values as “Keine Zeitangabe”, not an invented duration. Badges in result rows reflect these definitions and current metadata.

Use native modal-dialog semantics, a labelled heading, focus containment, instant focus outlines and focus restoration to the triggering button. Announce the number of results without moving focus. Empty results offer reset/clear-search actions; they never offer an R1-incompatible recipe.

### Move or swap dishes

Introduce pure `tauscheSlots(plan, von, nach)`: clone the plan, exchange complete entries including variants, and move `neuSlot` with its recipe, including into B. A same-slot drop is a no-op; an empty target receives the entry. Define invalid slot IDs before implementation and test that they cannot corrupt the plan.

Update SPEC 4.4 to permit `neuSlot: "B"` after manual moves while keeping automatic planning's A/C restriction. Verify consecutive moves, rerolling the marked new recipe in B, `probiertHinzugefuegt`, link `geplantAm`, and rollback when the new recipe later leaves the plan. Existing `uebernehmePlan` already avoids rollback while the old new recipe remains anywhere in the plan; it still needs regression coverage across multiple swaps and subsequent replacement.

After a drop, run `uebernehmePlan`, save and display `pruefePlan` warnings. R1/R3/R4/R5 do not block manual swaps. The shopping list derives from the new plan, including fresh ingredients that move into or out of C.

Use Pointer Events on a dedicated drag handle with `touch-action: none` on that handle only. Start dragging after a short long-press threshold, initially 300ms, to be checked on an iPhone. The card body continues normal scrolling. Show a lifted copy, an insertion/target highlight and edge auto-scroll. Handle pointer cancellation, Escape, release outside a target and lost capture without saving. Animate only transform/opacity and respect reduced motion.

“Verschieben” opens a compact destination choice with the other two eating-day labels. If occupied, show “Mit Di + Mi tauschen”. This path works with keyboard and screen reader and calls the same pure function. Announce the move and keep focus on the moved dish.

If a partner update changes the plan during a drag or destination choice, cancel that operation with a short explanation. Apply any later selection against the newest state. Do not save a stale drag snapshot over the partner's changes.

### Shopping and recipes

Use calendar-labelled “Samstag” and “Donnerstag” tabs and a copy action for the selected day. Ingredient categories are expanded by default. Keep category names in sentence case with small inline icons and amounts aligned consistently. Reveal source recipe names by expanding an ingredient row rather than repeating them under every item. Only the separate “Habt ihr wahrscheinlich da” pantry section starts collapsed. Place per-dish Bring actions below the list. The list scrolls with sufficient bottom padding so navigation never covers the last row.

Keep favorites, the collapsible pool and own links in the recipe tab. Give long names a full first row and put actions below, instead of squeezing names beside three buttons. Preserve link-title/URL drafts and focus across remote updates. Empty states give one relevant next action, such as planning the week, without adding illustrations or onboarding steps.

## Verification after approval

1. Add planner tests for swap immutability, both variants, same-slot/empty-target behavior, `neuSlot` movement and provenance over repeated operations. Add shopping tests for moving fresh ingredients across C.
2. Verify modal focus, Escape, close without saving, filters, empty results, long names and real keyboard interaction. Check external updates while a draft, sheet or drag is active.
3. Keep `node --test tests/*.test.mjs`, full recipe validation and page generation green. Every behavior change updates SPEC in its own commit.
4. Capture week, wish/replacement sheets, shopping, recipes and feedback states in both themes at 393px for the iPhone 15 Pro layout and 360px/412px for the unknown older Galaxy A layout. Check 200% text scaling, software keyboards, safe areas, wider layouts through 1920px, reduced motion and focus contrast. Run Hallmark's app-scope sweep; resolve Floor findings and record any justified Reflex waiver.
5. Check touch drag, auto-scroll, scroll-vs-drag separation, sheet dismissal and cancellation on an actual iPhone and the actual Samsung device. Browser emulation is not proof of this behavior. Verify shared Firebase updates only with an authorized household or a test environment.

No new photography or brand asset is required for this concept. Authentic dish photos could be a later addition, but are not needed for recipe selection or the three-block plan.
