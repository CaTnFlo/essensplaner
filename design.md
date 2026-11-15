# Meal planner interface

The selected system is fixed by `docs/ui-concept-2026-11-15.md`,
`docs/mockups/README.md`, `docs/mockups/palette.json` and the week mockup.
No new design direction is introduced by implementation.

Use the system font and neutral light/dark surfaces. Orange fills primary actions;
small foreground accents use the separate light/dark accent values. All runtime
color and font values are CSS tokens. Dark cards are lighter than the canvas.
Primary labels use at least 20 px bold text for the approved 3.05:1 pairing.

Keep the three destinations and three eating-day groups. Cooking instructions
remain separate, especially Sunday preparation for Tuesday/Wednesday. Recipe
names lead, actions live in one menu, and a dedicated handle supports dragging.
No food photography, gradients, decorative hero or calendar redesign.

Use native modal dialogs, 48 px controls, visible focus, safe-area spacing and
reduced motion. The same shell applies at 360, 393 and 412 px and remains capped
at 640 px on desktop. Enlarged text may increase scrolling.

Hallmark scope is the existing app. The approved neutral tokens override tinted
neutrals. Compact metadata spacing is an intentional exception to gate 24b's
4 px grid; target sizes and overflow are separately checked in the browser.
App data, recipe lists and task-oriented dialogs are not subject to a marketing
hero or 80-word quota. Static checks complement the browser suite; the unavailable
built-in Puppeteer render tier is not reported as a passing render check.
