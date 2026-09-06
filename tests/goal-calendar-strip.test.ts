import assert from "node:assert/strict";
import test from "node:test";
import { buildGoalCalendarStrip } from "../lib/goal-calendar-strip.ts";

test("goal calendar strip excludes unrelated Google events", () => {
  const now = new Date("2026-09-07T12:00:00");
  const goalTasks = [{ id: "t-ielts", title: "Writing drill", status: "todo" }];
  const blocks = [
    {
      id: "b-goal",
      type: "task",
      taskId: "t-ielts",
      startAt: "2026-09-08T10:00:00",
      duration: 60,
      title: "Writing drill",
    },
    {
      id: "b-google",
      type: "external",
      taskId: null,
      startAt: "2026-09-08T14:00:00",
      duration: 120,
      title: "Work standup",
    },
    {
      id: "b-other-goal",
      type: "task",
      taskId: "t-job",
      startAt: "2026-09-09T10:00:00",
      duration: 90,
      title: "Interview prep",
    },
  ];

  const strip = buildGoalCalendarStrip(goalTasks, blocks, now);
  const labels = strip.days.flatMap((d) => d.blocks.map((b) => b.label));
  assert.deepEqual(labels, ["Writing drill"]);
  assert.equal(strip.hasGoalSessions, true);
  assert.equal(strip.protectedMinutes, 60);
});

test("empty goal calendar has no sessions", () => {
  const now = new Date("2026-09-07T12:00:00");
  const strip = buildGoalCalendarStrip([], [
    {
      id: "b-google",
      type: "external",
      startAt: "2026-09-08T14:00:00",
      duration: 120,
      title: "Busy",
    },
  ], now);
  assert.equal(strip.hasGoalSessions, false);
  assert.equal(strip.days.every((d) => d.blocks.length === 0), true);
});
