import assert from "node:assert/strict";
import test from "node:test";
import { aggregateTaskSchedule, formatScheduledMinutes } from "../lib/task-schedule.ts";

test("aggregates many TimeBlocks under one Task identity", () => {
  const blocks = [60, 60, 60, 60, 30].map((duration, index) => ({
    taskId: "essay-task",
    duration,
    startAt: `2026-09-0${index + 1}T12:00:00.000Z`,
  }));
  const aggregate = aggregateTaskSchedule("essay-task", blocks);
  assert.equal(aggregate.sessionCount, 5);
  assert.equal(aggregate.totalScheduledMinutes, 270);
  assert.equal(formatScheduledMinutes(aggregate.totalScheduledMinutes), "4h 30m");
});

test("keeps separate Tasks separate and supports zero sessions", () => {
  const blocks = [{ taskId: "a", duration: 30 }, { taskId: "b", duration: 45 }, { taskId: "a", duration: 60 }];
  assert.deepEqual(aggregateTaskSchedule("a", blocks).sessionCount, 2);
  assert.deepEqual(aggregateTaskSchedule("b", blocks).sessionCount, 1);
  assert.deepEqual(aggregateTaskSchedule("missing", blocks), { sessionCount: 0, totalScheduledMinutes: 0, scheduledDays: [] });
});
