import assert from "node:assert/strict";
import test from "node:test";
import { groupTasks } from "../lib/task-groups.ts";
import { isRoutineTask } from "../lib/week-task-hierarchy.ts";
import type { TasksViewBlock, TasksViewTask } from "../components/planner/tasks/types.ts";

function task(partial: Partial<TasksViewTask> & Pick<TasksViewTask, "id" | "title">): TasksViewTask {
  return {
    notes: "",
    status: "scheduled",
    priority: "p2",
    projectId: "proj",
    project: "Project",
    color: "#3366ff",
    duration: 60,
    dueAt: "2026-09-16T16:59:00.000Z",
    dueHorizon: "day",
    projectType: "STANDARD",
    ...partial,
  };
}

function block(partial: Partial<TasksViewBlock> & Pick<TasksViewBlock, "id" | "taskId">): TasksViewBlock {
  return {
    duration: 30,
    status: "PLANNED",
    startAt: "2026-09-16T06:00:00+07:00",
    ...partial,
  };
}

test("weekly STANDARD meeting is Also today, not a Routine", () => {
  assert.equal(
    isRoutineTask({
      projectType: "STANDARD",
      repeatSeriesId: "series-meetings-weekly",
    }),
    false,
  );

  const focusDate = "2026-09-16";
  const groups = groupTasks(
    "day",
    [
      task({
        id: "wake",
        title: "Wake-up Checkpoint",
        projectType: "HABIT",
        repeatSeriesId: "series-wake",
        project: "Sleep Routine",
      }),
      task({
        id: "meet",
        title: "Meetings",
        projectType: "STANDARD",
        repeatSeriesId: "series-meetings-weekly",
        project: "Landfill Rover",
      }),
    ],
    [
      block({ id: "bw", taskId: "wake", startAt: "2026-09-16T06:00:00+07:00" }),
      block({ id: "bm", taskId: "meet", startAt: "2026-09-16T14:00:00+07:00" }),
    ],
    (item) => item.dueHorizon ?? null,
    () => false,
    { focusDate, emphasizeDailyFocus: true },
  );

  assert.deepEqual(
    groups.map((group) => group.id),
    ["daily-focus", "also-today", "routines"],
  );
  assert.equal(groups.find((g) => g.id === "also-today")?.tasks.map((t) => t.id).join(","), "meet");
  assert.equal(groups.find((g) => g.id === "routines")?.tasks.map((t) => t.id).join(","), "wake");
  assert.equal(groups.find((g) => g.id === "routines")?.defaultCollapsed, true);
  assert.equal(groups.find((g) => g.id === "routines")?.collapsible, true);
});

test("Day view puts habits in Routines, finite work in Also today", () => {
  const focusDate = "2026-09-16";
  const groups = groupTasks(
    "day",
    [
      task({
        id: "wake",
        title: "Wake-up Checkpoint",
        projectType: "HABIT",
        repeatSeriesId: "series-wake",
        project: "Sleep Routine",
      }),
      task({
        id: "bed",
        title: "Bedtime Checkpoint",
        projectType: "HABIT",
        repeatSeriesId: "series-bed",
        project: "Sleep Routine",
      }),
      task({
        id: "meet",
        title: "Meetings",
        project: "Landfill Rover",
      }),
      task({
        id: "focus",
        title: "Ship CV",
      }),
    ],
    [
      block({
        id: "bf",
        taskId: "focus",
        startAt: "2026-09-16T09:00:00+07:00",
        isDailyFocus: true,
      }),
      block({ id: "bw", taskId: "wake", startAt: "2026-09-16T06:00:00+07:00" }),
      block({ id: "bm", taskId: "meet", startAt: "2026-09-16T14:00:00+07:00" }),
    ],
    (item) => item.dueHorizon ?? null,
    () => false,
    { focusDate, emphasizeDailyFocus: true },
  );

  assert.deepEqual(
    groups.map((group) => group.id),
    ["daily-focus", "also-today", "routines"],
  );
  assert.equal(groups.find((g) => g.id === "also-today")?.label, "Also today");
  assert.equal(groups.find((g) => g.id === "also-today")?.tasks.map((t) => t.id).join(","), "meet");
  assert.equal(groups.find((g) => g.id === "routines")?.tasks.length, 2);
  assert.equal(groups.find((g) => g.id === "daily-focus")?.tasks[0]?.id, "focus");
  assert.equal(groups.find((g) => g.id === "routines")?.defaultCollapsed, true);
});
