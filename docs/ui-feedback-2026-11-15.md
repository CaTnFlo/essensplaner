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

## Palette, radii and modal scrolling follow-up

The palette assembled and inspected in [Coolors](https://coolors.co/121214-232326-e66d20-99c9ef-18354c) retains orange and neutral surfaces. Day badges use light blue #99C9EF with ink #18354C in both themes. Shared radius tokens use 12px for controls, 20px for containers and full rounding for pills. Joined action rows retain square internal edges.

Opening a sheet fixes the background body at its current offset. Sheet transitions retain this lock; dismissal restores the original inline styles and page position without focus-induced scrolling. Sheet content remains independently scrollable. Regression coverage exercises background wheel input, sheet transitions, content scrolling and offset restoration alongside backdrop, swipe, keyboard and touch focus checks.

## Warm day badges and consistent card headers

The blue extension was rejected in visual review. Day labels now use warm sand #E4C9A0 with brown #49351F. All header badges and the overflow button share a 48px height and 12px radius. Every sheet has a constrained, independently scrollable body, a shorter 32px grip area and 24px bottom content padding plus the safe-area inset. Background locking remains unchanged. Browser coverage now includes matching header heights and native touch scrolling in a freshly loaded 360 × 500 viewport. Physical iPhone verification remains outstanding.
