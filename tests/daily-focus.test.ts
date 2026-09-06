import assert from "node:assert/strict";
import test from "node:test";
import {
  dailyFocusDayVerdict,
  findDailyFocusTask,
  isDailyFocusForDate,
  productDateString,
  resolveDailyFocusReplacement,
} from "../lib/daily-focus.ts";

test("Daily Focus belongs to a specific product date", () => {
  assert.equal(isDailyFocusForDate({ dailyFocusDate: "2026-09-07" }, "2026-09-07"), true);
  assert.equal(isDailyFocusForDate({ dailyFocusDate: "2026-09-07" }, "2026-09-08"), false);
  const tasks = [
    { id: "a", dailyFocusDate: "2026-09-06" },
    { id: "b", dailyFocusDate: "2026-09-07" },
  ];
  assert.equal(findDailyFocusTask(tasks, "2026-09-07")?.id, "b");
});

test("replacement does not leave duplicate active focus", () => {
  const result = resolveDailyFocusReplacement({
    existingFocusTaskId: "old",
    nextTaskId: "new",
  });
  assert.equal(result.clearTaskId, "old");
  assert.equal(result.focusTaskId, "new");
  assert.equal(result.needsConfirm, true);
});

test("priority is independent of Daily Focus", () => {
  const task = { priority: "p2", dailyFocusDate: "2026-09-07" };
  assert.equal(task.priority, "p2");
  assert.equal(isDailyFocusForDate(task, "2026-09-07"), true);
});

test("core priority missed when Daily Focus incomplete despite supporting done", () => {
  assert.equal(
    dailyFocusDayVerdict({ focusDone: false, supportingDone: 4, supportingTotal: 4 }),
    "core-missed",
  );
  assert.equal(
    dailyFocusDayVerdict({ focusDone: true, supportingDone: 1, supportingTotal: 4 }),
    "core-achieved",
  );
});

test("productDateString is YYYY-MM-DD", () => {
  assert.match(productDateString(new Date("2026-09-06T17:00:00Z")), /^\d{4}-\d{2}-\d{2}$/);
});
