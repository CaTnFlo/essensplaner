# Mobile UI implementation and verification

Implemented on `review/meal-planner-ui-concept` for PR #1. The approved week mockup,
behavior contract and palette remain the design source. No merge or deployment
is part of this change.

## Implemented scope

| Requirement | Implementation and evidence |
| --- | --- |
| Mobile week, shared palette | Bottom navigation, eating-day headings, separate cooking lines, local SVGs and shared `css/tokens.css`. Recipe pages and the manifest use the same neutral colors. |
| Optional shared wish | Catalog search, compatible day choices, Tag egal, changed-slot preview, apply and release. Applying a wish preserves valid unaffected entries and variants. |
| Replan with fixed wish | Exact wish entry and slot survive; exhaustive candidate search follows the existing relaxation tiers. No invalid emergency plan is saved. |
| Undo | Immediate action in the status message plus persistent week/menu actions. Restores the prior plan, wish and the operation's own provenance. Newer plan revisions invalidate it. |
| Replace and filter | Native modal, R1 filtering, favorites first, exclusive status choices, duration/appliance/protein semantics, result count and empty state. |
| Move and swap | Complete entries, variants, new marker and wish move together. Dedicated long-press handle, target highlight, edge scrolling, cancellation and keyboard destination choice. |
| Shopping | Active-day copy, selectable fallback, expanded categories, row source disclosure, pantry-flag grouping and Bring actions below the list. |
| Shared state and recovery | Transactional field changes, plan revisions and ordered listener reconciliation; persistent retry/discard, separate listener health, retained sheet and link drafts. |

`SPEC.md` describes the updated behavior and storage contract. `design.md` records
the fixed design decisions. The only generated recipe-page change is the favicon
link, added after the browser check found a request for a missing `/favicon.ico`.

## Verified on 15 November 2026

- `node --test tests/*.test.mjs`: **117 passed**, zero failed. Coverage includes
  wishes across seeds, impossible combinations, R3 relaxation, tried/link provenance,
  repeated swaps, rerolling a new recipe in B, moved shopping ingredients, filters,
  stale undo, concurrent field changes and buffered listener ordering.
- `node scripts/validate-recipes.mjs --voll`: **37 recipes passed**.
- `node scripts/build-pages.mjs`: **46 pages generated**.
- `node tests/browser.mjs`: **PASS** with Playwright and local Chromium. Week,
  shopping, recipes, wish and replacement were captured at **360, 393, 412 and
  1920 px in light and dark**. The run produced 46 screenshots, including failure
  feedback, enlarged text and standalone recipes. Screenshots were visually reviewed.
  Controls were checked for 48 px minimum geometry; no horizontal page overflow
  was observed. The 200% text check used 360 px, dark mode. A 400 px high viewport
  checked scroll access to modal apply controls; it does not emulate a real keyboard.
- Browser interactions covered wish application/release, fixed-slot replanning,
  undo, Escape/Back, focus containment/restoration, filter reset, empty results,
  selected-day copy, clipboard fallback, save failure/retry and two local tabs.
  Partner updates cancelled movement and invalidated undo. Link drafts, focus and
  text selection survived updates. No unexpected console errors or failed requests
  remained; the deliberate write-failure injection was excluded from that verdict.
- `node tests/drag-browser.mjs`: **PASS** for long press, swapping, Escape,
  pointer cancellation, edge scrolling, outside release and keyboard movement/focus.
- Computed primary labels were **20 px / 700**, with **3.05:1** contrast on orange.
  Normal text on cards measured **15.30:1 light / 14.02:1 dark**; muted text
  **5.81:1 / 7.95:1**; small accents **4.66:1 / 7.54:1**.
- Hallmark app-scope static sweep: **0 Floor failures**, no unwaived Reflex
  findings. Gate 24b's 18 spacing findings share the documented compact-layout
  waiver. Two inherited-text-color warnings were checked against computed colors.
  The built-in render tier could not run because Puppeteer was unavailable;
  the separate Playwright results above are the render evidence.
- `git diff --check`: **PASS**.

The Firebase adapter test executes the production transaction callback against an
optimistic test transport, including a concurrent retry and rejection of a stale
plan. It does **not** establish live Firestore connectivity or security-rule behavior.

## Reproduce browser checks

Serve the repository locally, then run with Playwright installed:

```sh
python3 -m http.server 8876 --bind 127.0.0.1
node tests/browser.mjs
node tests/drag-browser.mjs
```

Optional environment variables: `TEST_URL`, `TEST_OUTPUT`, `PLAYWRIGHT_MODULE`
(the absolute path to Playwright's `index.mjs`) and `CHROMIUM_PATH`. The tests use
local fixture data only and do not access a household. Their default screenshots
are written to `/tmp/meal-ui-evidence`.

## Review screenshots

These are browser screenshots at 393 CSS px with the documented example dishes,
not the original generated mockups:

| Screen | Light | Dark |
| --- | --- | --- |
| Week | [Screenshot](ui-implementation-assets/week-light.png) | [Screenshot](ui-implementation-assets/week-dark.png) |
| Wish | [Screenshot](ui-implementation-assets/wish-light.png) | [Screenshot](ui-implementation-assets/wish-dark.png) |
| Shopping | [Screenshot](ui-implementation-assets/shopping-light.png) | [Screenshot](ui-implementation-assets/shopping-dark.png) |

## Release checks still required

Physical iPhone 15 Pro and the actual Samsung device were unavailable. Native
software keyboards, touch/scroll feel, actual Android Back, safe-area hardware
behavior and screen-reader output remain unverified. Chromium emulation is not
an iOS Safari pass.

No live Firebase household or deployed rules were accessed. Run two-device
conflict, retry and listener-recovery checks against an authorized test household
before release. The Firebase emulator was not available in this environment.
Local cross-tab writes are serialized with Web Locks where supported; older
browsers without that API do not have the same atomicity guarantee. Unsaved changes
are retained in memory, not across reloads. Bring URLs retain the existing format;
no import into a real Bring account was performed.

GitHub Pages was checked before delivery: its source is `main`, path `/`. The
review-branch push therefore does not publish this UI to Pages.
