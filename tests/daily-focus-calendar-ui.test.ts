import assert from "node:assert/strict";
import test from "node:test";

/**
 * Mirrors CalendarEvent Daily Focus density rules in planner-app.tsx.
 * Large blocks get a badge label; compact/tiny get ★ beside the title only.
 */
function dailyFocusPresentation(input: {
  isDailyFocus: boolean;
  isExternal?: boolean;
  durationMinutes: number;
}) {
  const isDailyFocus = Boolean(input.isDailyFocus) && !input.isExternal;
  const isTiny = input.durationMinutes <= 20;
  const isCompact = input.durationMinutes <= 35;
  const showDailyFocusBadge = isDailyFocus && !isCompact && input.durationMinutes >= 40;
  return {
    className: isDailyFocus ? "daily-focus" : "",
    showDailyFocusBadge,
    showStarInTitle: isDailyFocus && !showDailyFocusBadge,
    isTiny,
    isCompact,
  };
}

test("Daily Focus large block shows badge, keeps priority class separate", () => {
  const view = dailyFocusPresentation({ isDailyFocus: true, durationMinutes: 90 });
  assert.equal(view.className, "daily-focus");
  assert.equal(view.showDailyFocusBadge, true);
  assert.equal(view.showStarInTitle, false);
});

test("Daily Focus compact/tiny blocks use ★ only (no overflow badge)", () => {
  const compact = dailyFocusPresentation({ isDailyFocus: true, durationMinutes: 30 });
  assert.equal(compact.showDailyFocusBadge, false);
  assert.equal(compact.showStarInTitle, true);
  assert.equal(compact.isCompact, true);

  const tiny = dailyFocusPresentation({ isDailyFocus: true, durationMinutes: 15 });
  assert.equal(tiny.showDailyFocusBadge, false);
  assert.equal(tiny.showStarInTitle, true);
  assert.equal(tiny.isTiny, true);
});

test("supporting Sessions get no Daily Focus classes", () => {
  const view = dailyFocusPresentation({ isDailyFocus: false, durationMinutes: 90 });
  assert.equal(view.className, "");
  assert.equal(view.showDailyFocusBadge, false);
  assert.equal(view.showStarInTitle, false);
});
