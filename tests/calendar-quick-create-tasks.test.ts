import assert from "node:assert/strict";
import test from "node:test";
import { listTasksForQuickCreate } from "../lib/calendar-quick-create-tasks.ts";

test("collapses repeat-series checkpoints to one option", () => {
  const seriesId = "series-bedtime";
  const listed = listTasksForQuickCreate(
    [
      {
        id: "a",
        title: "Bedtime Checkpoint",
        projectId: "p",
        project: "Habits",
        color: "#000",
        duration: 15,
        status: "scheduled",
        dueAt: "2026-09-14T16:59:00.000Z",
        dueHorizon: "day",
        repeatSeriesId: seriesId,
      },
      {
        id: "b",
        title: "Bedtime Checkpoint",
        projectId: "p",
        project: "Habits",
        color: "#000",
        duration: 15,
        status: "scheduled",
        dueAt: "2026-09-15T16:59:00.000Z",
        dueHorizon: "day",
        repeatSeriesId: seriesId,
      },
      {
        id: "c",
        title: "Bedtime Checkpoint",
        projectId: "p",
        project: "Habits",
        color: "#000",
        duration: 15,
        status: "scheduled",
        dueAt: "2026-09-16T16:59:00.000Z",
        dueHorizon: "day",
        repeatSeriesId: seriesId,
      },
      {
        id: "role",
        title: "Finalize target role profile",
        projectId: "career",
        project: "Career",
        color: "#111",
        duration: 60,
        status: "inbox",
        dueHorizon: "week",
      },
    ],
    "2026-09-16",
  );

  assert.equal(listed.length, 2);
  const bedtime = listed.find((task) => task.title === "Bedtime Checkpoint");
  assert.ok(bedtime);
  assert.equal(bedtime!.id, "c");
  assert.equal(bedtime!.instanceCount, 3);
  assert.equal(listed[0]!.id, "role");
});

test("skips done tasks and keeps unique one-offs", () => {
  const listed = listTasksForQuickCreate([
    {
      id: "1",
      title: "Done thing",
      projectId: null,
      project: "Inbox",
      color: "#000",
      duration: 30,
      status: "done",
      dueHorizon: "week",
    },
    {
      id: "2",
      title: "Open thing",
      projectId: null,
      project: "Inbox",
      color: "#000",
      duration: 30,
      status: "inbox",
      dueHorizon: "month",
    },
  ]);
  assert.equal(listed.length, 1);
  assert.equal(listed[0]!.id, "2");
});
