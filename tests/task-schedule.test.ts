import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateTaskSchedule,
  formatScheduledMinutes,
  remainingSessionsAfterRemove,
} from "../lib/task-schedule.ts";
import { groupTasks } from "../lib/task-groups.ts";
import type { TasksViewBlock, TasksViewTask } from "../components/planner/tasks/types.ts";

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
  assert.equal(aggregateTaskSchedule("a", blocks).sessionCount, 2);
  assert.equal(aggregateTaskSchedule("b", blocks).sessionCount, 1);
  assert.deepEqual(aggregateTaskSchedule("missing", blocks), {
    sessionCount: 0,
    totalScheduledMinutes: 0,
    scheduledDays: [],
  });
});

test("Tasks Week lists one card for one WEEK Task with five TimeBlocks", () => {
  const task: TasksViewTask = {
    id: "essay-task",
    title: "Complete 2 IELTS Writing essays",
    notes: "",
    status: "scheduled",
    priority: "p2",
    projectId: "proj-1",
    project: "IELTS Writing",
    color: "#705CF6",
    dueHorizon: "week",
    dueAt: "2026-09-06T00:00:00.000Z",
    duration: 240,
  };
  const blocks: TasksViewBlock[] = [0, 1, 2, 3, 4].map((day) => ({
    id: `block-${day}`,
    taskId: "essay-task",
    day,
    start: 19 * 60,
    duration: 60,
    startAt: `2026-09-0${day + 1}T12:00:00.000Z`,
  }));
  const groups = groupTasks(
    "week",
    [task],
    blocks,
    () => "week",
    () => false,
  );
  const listed = groups.flatMap((group) => group.tasks);
  assert.equal(listed.length, 1, "Week view must show one Task card, not five session rows");
  assert.equal(listed[0]?.id, "essay-task");
  assert.equal(aggregateTaskSchedule("essay-task", blocks).sessionCount, 5);
});

test("removing one session keeps Task scheduled when other sessions remain", () => {
  const blocks = [
    { id: "b1", taskId: "essay-task" },
    { id: "b2", taskId: "essay-task" },
    { id: "b3", taskId: "essay-task" },
  ];
  assert.equal(remainingSessionsAfterRemove("essay-task", "b2", blocks), 2);
  assert.equal(remainingSessionsAfterRemove("essay-task", "b1", [{ id: "b1", taskId: "essay-task" }]), 0);
});
