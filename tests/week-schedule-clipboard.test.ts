import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWeekScheduleClipboard,
  formatWeekPasteToast,
  occupiedSlotsForWeekPaste,
  planWeekSchedulePaste,
  resolveTaskIdForWeekPaste,
  slotConflictsWithOccupied,
  weekSlotsOverlap,
} from "../lib/week-schedule-clipboard.ts";

const WEEK = new Date("2026-09-14T00:00:00+07:00");

function slotDate(weekStart: Date, day: number, minutes: number) {
  const date = new Date(weekStart);
  date.setDate(date.getDate() + day);
  date.setHours(0, 0, 0, 0);
  date.setMinutes(minutes);
  return date;
}

test("adjacent sessions do not conflict; 5-minute overlap does", () => {
  assert.equal(
    weekSlotsOverlap(
      { day: 1, start: 10 * 60, duration: 60 },
      { day: 1, start: 11 * 60, duration: 60 },
    ),
    false,
  );
  assert.equal(
    weekSlotsOverlap(
      { day: 1, start: 10 * 60, duration: 65 },
      { day: 1, start: 11 * 60, duration: 60 },
    ),
    true,
  );
  assert.equal(
    weekSlotsOverlap(
      { day: 1, start: 10 * 60, duration: 60 },
      { day: 2, start: 10 * 60, duration: 60 },
    ),
    false,
  );
});

test("all-day externals are not timed occupancy; timed externals are", () => {
  const occupied = occupiedSlotsForWeekPaste([
    { id: "t1", type: "task", day: 0, start: 9 * 60, duration: 60 },
    { id: "e-all", type: "external", day: 0, start: 0, duration: 24 * 60, allDay: true },
    { id: "e-meet", type: "external", day: 0, start: 14 * 60, duration: 60 },
  ]);
  assert.equal(occupied.length, 2);
  assert.equal(
    slotConflictsWithOccupied({ day: 0, start: 14 * 60 + 30, duration: 30 }, occupied),
    true,
  );
  assert.equal(
    slotConflictsWithOccupied({ day: 0, start: 16 * 60, duration: 30 }, occupied),
    false,
  );
});

test("habit series remaps to target-day instance", () => {
  const tasks = [
    {
      id: "wake-mon",
      title: "Wake-up",
      status: "scheduled",
      projectId: "sleep",
      dueAt: "2026-09-14T16:59:00.000Z",
      repeatSeriesId: "series-wake",
      projectType: "HABIT" as const,
    },
    {
      id: "wake-tue",
      title: "Wake-up",
      status: "scheduled",
      projectId: "sleep",
      dueAt: "2026-09-15T16:59:00.000Z",
      repeatSeriesId: "series-wake",
      projectType: "HABIT" as const,
    },
  ];
  const tue = slotDate(WEEK, 1, 6 * 60);
  assert.equal(
    resolveTaskIdForWeekPaste(
      { taskId: "wake-mon", repeatSeriesId: "series-wake" },
      tue,
      tasks,
    ),
    "wake-tue",
  );
});

test("finite task keeps same id even when done", () => {
  const tasks = [
    { id: "meet", title: "Meetings", status: "scheduled", projectId: "rover" },
    { id: "done", title: "Old", status: "done", projectId: null },
  ];
  const day = slotDate(WEEK, 2, 14 * 60);
  assert.equal(
    resolveTaskIdForWeekPaste({ taskId: "meet", repeatSeriesId: null }, day, tasks),
    "meet",
  );
  assert.equal(
    resolveTaskIdForWeekPaste({ taskId: "done", repeatSeriesId: null }, day, tasks),
    "done",
  );
});

test("habit target-day done instance is still selected so paste can reopen it", () => {
  const tasks = [
    {
      id: "wake-mon",
      title: "Wake-up",
      status: "scheduled",
      projectId: "sleep",
      dueAt: "2026-09-14T16:59:00.000Z",
      repeatSeriesId: "series-wake",
      projectType: "HABIT" as const,
    },
    {
      id: "wake-fri",
      title: "Wake-up",
      status: "done",
      projectId: "sleep",
      dueAt: "2026-09-18T16:59:00.000Z",
      repeatSeriesId: "series-wake",
      projectType: "HABIT" as const,
    },
  ];
  const fri = slotDate(WEEK, 4, 6 * 60);
  assert.equal(
    resolveTaskIdForWeekPaste(
      { taskId: "wake-mon", repeatSeriesId: "series-wake" },
      fri,
      tasks,
    ),
    "wake-fri",
  );
});

test("paste keeps target busy slots and only fills free time", () => {
  const clipboard = buildWeekScheduleClipboard({
    weekStart: new Date("2026-09-07T00:00:00+07:00"),
    label: "Sep 7–13",
    blocks: [
      {
        id: "a",
        type: "task",
        day: 2,
        start: 14 * 60,
        duration: 60,
        taskId: "meet",
        title: "Meetings",
        notes: "",
        projectId: "rover",
        color: "#f00",
      },
      {
        id: "b",
        type: "task",
        day: 2,
        start: 16 * 60,
        duration: 60,
        taskId: "deep",
        title: "Deep work",
        notes: "",
        projectId: "career",
        color: "#0f0",
      },
      {
        id: "c",
        type: "task",
        day: 3,
        start: 9 * 60,
        duration: 90,
        taskId: "deep",
        title: "Deep work",
        notes: "",
        projectId: "career",
        color: "#0f0",
      },
    ],
    tasks: [
      { id: "meet", title: "Meetings", status: "scheduled", projectId: "rover" },
      { id: "deep", title: "Deep work", status: "scheduled", projectId: "career" },
    ],
  });
  assert.equal(clipboard.sessions.length, 3);

  const plan = planWeekSchedulePaste({
    clipboard,
    targetWeekStart: WEEK,
    existingBlocks: [
      // Target already has something overlapping Wed 14:00–15:00 by 5 minutes.
      {
        id: "busy",
        type: "task",
        day: 2,
        start: 14 * 60 + 55,
        duration: 30,
        taskId: "other",
      },
      // Timed Google event Thu morning.
      {
        id: "gcal",
        type: "external",
        day: 3,
        start: 9 * 60,
        duration: 60,
      },
    ],
    tasks: [
      { id: "meet", title: "Meetings", status: "scheduled", projectId: "rover" },
      { id: "deep", title: "Deep work", status: "scheduled", projectId: "career" },
      { id: "other", title: "Other", status: "scheduled", projectId: null },
    ],
    slotDate,
  });

  assert.deepEqual(
    plan.create.map((item) => `${item.day}:${item.start}`),
    [`2:${16 * 60}`],
  );
  assert.equal(plan.skippedConflict.length, 2);
  assert.equal(plan.skippedMissingTask.length, 0);

  const toast = formatWeekPasteToast(plan);
  assert.match(toast.message, /Pasted 1/);
  assert.match(toast.message, /skipped 2/);
  assert.equal(toast.kind, "warning");
});

test("later copies cannot stack onto earlier accepted paste slots", () => {
  const clipboard = buildWeekScheduleClipboard({
    weekStart: WEEK,
    label: "same",
    blocks: [
      {
        id: "1",
        type: "task",
        day: 0,
        start: 10 * 60,
        duration: 60,
        taskId: "a",
        title: "A",
      },
      {
        id: "2",
        type: "task",
        day: 0,
        start: 10 * 60 + 30,
        duration: 60,
        taskId: "b",
        title: "B",
      },
    ],
    tasks: [
      { id: "a", title: "A", status: "inbox", projectId: null },
      { id: "b", title: "B", status: "inbox", projectId: null },
    ],
  });

  // Source week somehow had overlap (or we paste onto empty): first wins, second conflicts with first accepted.
  const plan = planWeekSchedulePaste({
    clipboard,
    targetWeekStart: WEEK,
    existingBlocks: [],
    tasks: [
      { id: "a", title: "A", status: "inbox", projectId: null },
      { id: "b", title: "B", status: "inbox", projectId: null },
    ],
    slotDate,
  });
  assert.equal(plan.create.length, 1);
  assert.equal(plan.create[0]!.taskId, "a");
  assert.equal(plan.skippedConflict.length, 1);
  assert.equal(plan.skippedConflict[0]!.taskId, "b");
});

test("pending blocks occupy time; clipboard ignores pending sources", () => {
  const clipboard = buildWeekScheduleClipboard({
    weekStart: WEEK,
    label: "w",
    blocks: [
      {
        id: "pending-1",
        type: "task",
        day: 0,
        start: 10 * 60,
        duration: 60,
        taskId: "a",
        title: "A",
      },
      {
        id: "real",
        type: "task",
        day: 0,
        start: 12 * 60,
        duration: 30,
        taskId: "a",
        title: "A",
      },
    ],
    tasks: [{ id: "a", title: "A", status: "scheduled", projectId: null }],
  });
  assert.equal(clipboard.sessions.length, 1);
  assert.equal(clipboard.sessions[0]!.start, 12 * 60);
});
