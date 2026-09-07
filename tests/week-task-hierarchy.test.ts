import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWeekTaskHierarchy,
  formatWeekHeaderCounts,
  isRoutineTask,
  routineGroupingKey,
} from "../lib/week-task-hierarchy.ts";
import { groupTasks } from "../lib/task-groups.ts";
import type { TasksViewBlock, TasksViewTask } from "../components/planner/tasks/types.ts";

const WEEK_START = Date.parse("2026-09-07T00:00:00+07:00");
const WEEK_END = Date.parse("2026-09-14T00:00:00+07:00");

function task(partial: Partial<TasksViewTask> & Pick<TasksViewTask, "id" | "title">): TasksViewTask {
  return {
    notes: "",
    status: "scheduled",
    priority: "p2",
    projectId: "proj",
    project: "Project",
    color: "#3366ff",
    duration: 60,
    dueAt: "2026-09-08T00:00:00.000Z",
    dueHorizon: "day",
    projectType: "STANDARD",
    ...partial,
  };
}

function session(partial: Partial<TasksViewBlock> & Pick<TasksViewBlock, "id" | "taskId" | "startAt">): TasksViewBlock {
  return {
    duration: 60,
    status: "PLANNED",
    isDailyFocus: false,
    ...partial,
  };
}

test("1. Task with one Daily Focus Session → Core", () => {
  const focusTask = task({ id: "core-1", title: "Ship CV" });
  const hierarchy = buildWeekTaskHierarchy({
    tasks: [focusTask],
    sessions: [
      session({
        id: "s1",
        taskId: "core-1",
        startAt: "2026-09-08T10:00:00+07:00",
        isDailyFocus: true,
      }),
    ],
    weekStartMs: WEEK_START,
    weekEndMs: WEEK_END,
    isOverdue: () => false,
  });
  const core = hierarchy.sections.find((section) => section.id === "core");
  assert.equal(core?.rows.length, 1);
  assert.equal(core?.rows[0]?.kind, "task");
  if (core?.rows[0]?.kind === "task") {
    assert.equal(core.rows[0].taskId, "core-1");
    assert.deepEqual(core.rows[0].meta.focusWeekdays, ["Tue"]);
  }
});

test("2. Task with multiple Daily Focus Sessions → one Core row", () => {
  const focusTask = task({ id: "apps", title: "Submit 4 quality applications" });
  const hierarchy = buildWeekTaskHierarchy({
    tasks: [focusTask],
    sessions: [
      session({ id: "w", taskId: "apps", startAt: "2026-09-09T10:00:00+07:00", isDailyFocus: true }),
      session({ id: "f", taskId: "apps", startAt: "2026-09-11T10:00:00+07:00", isDailyFocus: true }),
    ],
    weekStartMs: WEEK_START,
    weekEndMs: WEEK_END,
    isOverdue: () => false,
  });
  const core = hierarchy.sections.find((section) => section.id === "core");
  assert.equal(core?.rows.length, 1);
  if (core?.rows[0]?.kind === "task") {
    assert.deepEqual(core.rows[0].meta.focusWeekdays, ["Wed", "Fri"]);
    assert.equal(core.rows[0].meta.plannedSessions, 2);
  }
});

test("3. finite non-focus Task → Supporting", () => {
  const supporting = task({ id: "outreach", title: "Send 2 outreaches" });
  const hierarchy = buildWeekTaskHierarchy({
    tasks: [supporting],
    sessions: [
      session({ id: "s", taskId: "outreach", startAt: "2026-09-07T10:00:00+07:00" }),
    ],
    weekStartMs: WEEK_START,
    weekEndMs: WEEK_END,
    isOverdue: () => false,
  });
  assert.equal(hierarchy.counts.supporting, 1);
  assert.equal(hierarchy.counts.core, 0);
});

test("4–6. repeated Habit Tasks group by series identity into one 0/7 row", () => {
  const seriesId = "series-wakeup";
  const instances = [0, 1, 2, 3, 4, 5, 6].map((offset) =>
    task({
      id: `wake-${offset}`,
      title: "Wake-up Checkpoint",
      projectType: "HABIT",
      project: "Sleep Routine",
      repeatSeriesId: seriesId,
      dueAt: `2026-09-${String(7 + offset).padStart(2, "0")}T00:00:00+07:00`,
    }),
  );
  // Unrelated same title, different series — must not merge.
  const other = task({
    id: "other-wake",
    title: "Wake-up Checkpoint",
    projectType: "HABIT",
    project: "Other",
    repeatSeriesId: "series-other",
  });
  const sessions = instances.map((item, offset) =>
    session({
      id: `sess-${offset}`,
      taskId: item.id,
      startAt: `2026-09-${String(7 + offset).padStart(2, "0")}T06:00:00+07:00`,
    }),
  );
  assert.equal(routineGroupingKey(instances[0]!), `series:${seriesId}`);
  assert.notEqual(routineGroupingKey(instances[0]!), routineGroupingKey(other));

  const hierarchy = buildWeekTaskHierarchy({
    tasks: [...instances, other],
    sessions: [
      ...sessions,
      session({ id: "other-s", taskId: other.id, startAt: "2026-09-07T06:30:00+07:00" }),
    ],
    weekStartMs: WEEK_START,
    weekEndMs: WEEK_END,
    isOverdue: () => false,
  });
  const routines = hierarchy.sections.find((section) => section.id === "routines");
  assert.equal(routines?.rows.length, 2);
  const wake = routines?.rows.find(
    (row) => row.kind === "routine" && row.routine.repeatSeriesId === seriesId,
  );
  assert.ok(wake && wake.kind === "routine");
  if (wake?.kind === "routine") {
    assert.equal(wake.routine.plannedSessions, 7);
    assert.equal(wake.routine.completedSessions, 0);
    assert.equal(wake.routine.taskIds.length, 7);
  }
});

test("7. completed Session updates grouped routine progress", () => {
  const seriesId = "series-review";
  const instances = [0, 1, 2].map((offset) =>
    task({
      id: `rev-${offset}`,
      title: "Daily Review",
      projectType: "HABIT",
      repeatSeriesId: seriesId,
    }),
  );
  const sessions = [
    session({
      id: "a",
      taskId: "rev-0",
      startAt: "2026-09-07T21:00:00+07:00",
      status: "DONE",
    }),
    session({
      id: "b",
      taskId: "rev-1",
      startAt: "2026-09-08T21:00:00+07:00",
      status: "DONE",
    }),
    session({
      id: "c",
      taskId: "rev-2",
      startAt: "2026-09-09T21:00:00+07:00",
      status: "PLANNED",
    }),
  ];
  const hierarchy = buildWeekTaskHierarchy({
    tasks: instances,
    sessions,
    weekStartMs: WEEK_START,
    weekEndMs: WEEK_END,
    isOverdue: () => false,
  });
  const row = hierarchy.sections.find((section) => section.id === "routines")?.rows[0];
  assert.ok(row && row.kind === "routine");
  if (row?.kind === "routine") {
    assert.equal(row.routine.completedSessions, 2);
    assert.equal(row.routine.plannedSessions, 3);
  }
});

test("8. All view still lists concrete Tasks via groupTasks", () => {
  const tasks = [
    task({ id: "a", title: "A", dueHorizon: "day" }),
    task({ id: "b", title: "B", dueHorizon: "week", repeatSeriesId: "s1", projectType: "HABIT" }),
  ];
  const groups = groupTasks("all", tasks, [], (item) => item.dueHorizon ?? null, () => false);
  const listed = groups.flatMap((group) => group.tasks);
  assert.equal(listed.length, 2);
});

test("9. week hierarchy is derived — no Task mutation", () => {
  const original = task({
    id: "immutable",
    title: "Wake-up",
    repeatSeriesId: "s",
    projectType: "HABIT",
  });
  const snapshot = structuredClone(original);
  buildWeekTaskHierarchy({
    tasks: [original],
    sessions: [
      session({ id: "s1", taskId: "immutable", startAt: "2026-09-07T06:00:00+07:00" }),
    ],
    weekStartMs: WEEK_START,
    weekEndMs: WEEK_END,
    isOverdue: () => false,
  });
  assert.deepEqual(original, snapshot);
});

test("groupTasks week uses Core / Supporting / Routines sections", () => {
  const core = task({ id: "c", title: "Core" });
  const support = task({ id: "s", title: "Support" });
  const habit = task({
    id: "h1",
    title: "Wake-up",
    projectType: "HABIT",
    repeatSeriesId: "wake",
  });
  const blocks: TasksViewBlock[] = [
    session({ id: "cf", taskId: "c", startAt: "2026-09-08T10:00:00+07:00", isDailyFocus: true }),
    session({ id: "sf", taskId: "s", startAt: "2026-09-08T11:00:00+07:00" }),
    session({ id: "hf", taskId: "h1", startAt: "2026-09-08T06:00:00+07:00" }),
  ];
  const groups = groupTasks(
    "week",
    [core, support, habit],
    blocks,
    () => "day",
    () => false,
    { weekStartMs: WEEK_START, weekEndMs: WEEK_END },
  );
  assert.deepEqual(
    groups.map((group) => group.id),
    ["core", "supporting", "routines"],
  );
  assert.equal(isRoutineTask(habit), true);
  assert.equal(formatWeekHeaderCounts({
    core: 1,
    supporting: 1,
    routines: 1,
    overdue: 0,
    completed: 0,
  }), "1 Core · 1 Supporting · 1 Routine");
});

test("Routines collapse default when Core Work exists", () => {
  const hierarchy = buildWeekTaskHierarchy({
    tasks: [
      task({ id: "c", title: "Core" }),
      task({ id: "h", title: "Habit", projectType: "HABIT", repeatSeriesId: "r" }),
    ],
    sessions: [
      session({ id: "1", taskId: "c", startAt: "2026-09-08T10:00:00+07:00", isDailyFocus: true }),
      session({ id: "2", taskId: "h", startAt: "2026-09-08T06:00:00+07:00" }),
    ],
    weekStartMs: WEEK_START,
    weekEndMs: WEEK_END,
    isOverdue: () => false,
  });
  const routines = hierarchy.sections.find((section) => section.id === "routines");
  assert.equal(routines?.defaultCollapsed, true);
});
