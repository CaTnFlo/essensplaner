# UI and Bring follow-up

Changes from live feedback:

- Day headings and recipe metadata regain neutral badge backgrounds.
- Action sheets group plan changes and recipe/shopping actions in rounded containers with local icons.
- Pointer opening focuses the heading. Touch does not leave a close-button outline or native tap flash; keyboard navigation retains visible focus.
- Backdrop taps and downward swipes from the grip/header dismiss without saving drafts. Short swipes and pointer cancellation reset the sheet; content remains scrollable.
- Generated recipe import metadata omits pantry-flagged ingredients from both base recipes and variants. Visible cooking ingredients remain complete. Catalog Bring links use a distinct query string; external recipe links are unchanged.

Verification: 118 Node tests passed; all 37 recipes passed full validation; 46 recipe pages regenerated. The existing browser suite passed at 360, 393, 412 and 1920 px in both themes, with enlarged text and modal checks. The focused `tests/sheet-feedback-browser.mjs` passed backdrop, touch-swipe, short-swipe, focus and native tap-highlight checks using Chromium touch events. Light/dark action-menu screenshots were inspected. No real phone or Bring account was used in these checks.

Bring's documented import uses Schema.org/JSON-LD:
https://www.getbring.com/en/integration-check

The import payload is verified; behavior inside the Bring app and its cache is not claimed as device-tested. Existing items already in a Bring list are not deleted by this change. Fresh basil and other fresh herbs retain their existing non-pantry classification.
