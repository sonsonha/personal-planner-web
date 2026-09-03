import assert from "node:assert/strict";
import test from "node:test";

/**
 * Mirrors planner-app taskInCalendarDrawer membership rules (horizon-first).
 */
type Horizon = "day" | "week" | "month" | null;
type Filter = "today" | "week" | "inbox";

function membership(
  task: { status: string; dueHorizon: Horizon; dueAt: string | null },
  filter: Filter,
  opts: { hasSessionToday: boolean; dueInCurrentWeek: boolean },
) {
  if (task.status === "done") return false;
  const horizon = task.dueHorizon;

  if (filter === "today") {
    if (horizon === "day" && task.dueAt) return true; // caller already day-matched
    if (opts.hasSessionToday) return true;
    return false;
  }
  if (filter === "week") {
    if (horizon !== "week") return false;
    if (!task.dueAt) return true;
    return opts.dueInCurrentWeek;
  }
  if (horizon === "day" || horizon === "week" || horizon === "month") return false;
  return true;
}

test("calendar drawer: WEEK with 0 sessions is This Week, not Inbox", () => {
  const task = { status: "inbox", dueHorizon: "week" as const, dueAt: "2026-09-01T00:00:00.000Z" };
  assert.equal(membership(task, "week", { hasSessionToday: false, dueInCurrentWeek: true }), true);
  assert.equal(membership(task, "inbox", { hasSessionToday: false, dueInCurrentWeek: true }), false);
});

test("calendar drawer: WEEK with many sessions stays This Week once", () => {
  const task = { status: "scheduled", dueHorizon: "week" as const, dueAt: "2026-09-01T00:00:00.000Z" };
  assert.equal(membership(task, "week", { hasSessionToday: true, dueInCurrentWeek: true }), true);
  assert.equal(membership(task, "inbox", { hasSessionToday: true, dueInCurrentWeek: true }), false);
});

test("calendar drawer: DAY today is Today", () => {
  const task = { status: "scheduled", dueHorizon: "day" as const, dueAt: "2026-09-03T12:00:00.000Z" };
  assert.equal(membership(task, "today", { hasSessionToday: false, dueInCurrentWeek: false }), true);
});

test("calendar drawer: no horizon is Inbox", () => {
  const task = { status: "inbox", dueHorizon: null, dueAt: null };
  assert.equal(membership(task, "inbox", { hasSessionToday: false, dueInCurrentWeek: false }), true);
  assert.equal(membership(task, "week", { hasSessionToday: false, dueInCurrentWeek: false }), false);
});

test("calendar drawer: MONTH with zero sessions is not Inbox", () => {
  const task = { status: "inbox", dueHorizon: "month" as const, dueAt: "2026-09-01T00:00:00.000Z" };
  assert.equal(membership(task, "inbox", { hasSessionToday: false, dueInCurrentWeek: false }), false);
  assert.equal(membership(task, "week", { hasSessionToday: false, dueInCurrentWeek: false }), false);
});
