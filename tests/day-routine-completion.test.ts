import assert from "node:assert/strict";
import test from "node:test";
import { groupTasks } from "../lib/task-groups.ts";
import {
  isTaskCompletedForDayView,
  isTaskCompletedForListView,
} from "../lib/session-evidence.ts";
import type { TasksViewBlock, TasksViewTask } from "../components/planner/tasks/types.ts";

function task(partial: Partial<TasksViewTask> & Pick<TasksViewTask, "id" | "title">): TasksViewTask {
  return {
    notes: "",
    status: "scheduled",
    priority: "p2",
    projectId: "habit",
    project: "Sleep Routine",
    color: "#3366ff",
    duration: 5,
    dueAt: "2026-09-17T12:00:00+07:00",
    dueHorizon: "week",
    projectType: "HABIT",
    repeatSeriesId: "series-wake",
    ...partial,
  };
}

function block(partial: Partial<TasksViewBlock> & Pick<TasksViewBlock, "id" | "taskId" | "startAt">): TasksViewBlock {
  return {
    duration: 15,
    status: "PLANNED",
    ...partial,
  };
}

test("Day view scopes multi-session wake habit to today's Session", () => {
  const wake = task({ id: "wake", title: "Wake-up Checkpoint" });
  const blocks: TasksViewBlock[] = [
    block({ id: "mon", taskId: wake.id, startAt: "2026-09-14T06:00:00+07:00", status: "DONE" }),
    block({ id: "tue", taskId: wake.id, startAt: "2026-09-15T06:00:00+07:00", status: "PLANNED" }),
    block({ id: "wed", taskId: wake.id, startAt: "2026-09-16T06:00:00+07:00", status: "PLANNED" }),
    block({ id: "thu", taskId: wake.id, startAt: "2026-09-17T06:00:00+07:00", status: "DONE" }),
    block({ id: "fri", taskId: wake.id, startAt: "2026-09-18T06:00:00+07:00", status: "PLANNED" }),
  ];

  const allEvidence = blocks.map((item) => ({ id: item.id, status: item.status ?? "PLANNED" }));
  assert.equal(isTaskCompletedForListView({ status: "scheduled" }, allEvidence), false);
  assert.equal(deriveDayDone(blocks, "2026-09-17"), true);
  assert.equal(deriveDayDone(blocks, "2026-09-15"), false);

  const groups = groupTasks(
    "day",
    [wake],
    blocks,
    (item) => item.dueHorizon ?? null,
    () => false,
    { focusDate: "2026-09-17", emphasizeDailyFocus: true, showCompleted: true },
  );

  assert.equal(groups.find((g) => g.id === "completed")?.tasks.map((t) => t.id).join(","), "wake");
  assert.equal(groups.find((g) => g.id === "routines"), undefined);
});

test("Day view keeps open wake in Routines when today's Session is still open", () => {
  const wake = task({ id: "wake", title: "Wake-up Checkpoint" });
  const blocks: TasksViewBlock[] = [
    block({ id: "mon", taskId: wake.id, startAt: "2026-09-14T06:00:00+07:00", status: "DONE" }),
    block({ id: "thu", taskId: wake.id, startAt: "2026-09-17T06:00:00+07:00", status: "PLANNED" }),
  ];

  const groups = groupTasks(
    "day",
    [wake],
    blocks,
    (item) => item.dueHorizon ?? null,
    () => false,
    { focusDate: "2026-09-17", emphasizeDailyFocus: true, showCompleted: true },
  );

  assert.equal(groups.find((g) => g.id === "routines")?.tasks.map((t) => t.id).join(","), "wake");
  assert.equal(groups.find((g) => g.id === "completed"), undefined);
});

function deriveDayDone(blocks: TasksViewBlock[], dayKey: string) {
  const dayBlocks = blocks
    .filter((item) => item.startAt && item.startAt.startsWith(dayKey))
    .map((item) => ({ id: item.id, status: item.status ?? "PLANNED" }));
  return isTaskCompletedForDayView(dayBlocks);
}
