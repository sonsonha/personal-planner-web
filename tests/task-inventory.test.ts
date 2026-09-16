import assert from "node:assert/strict";
import test from "node:test";
import {
  collapseForAllView,
  countUnscheduledTaskBadge,
  pickInventoryRepresentative,
} from "../lib/task-inventory.ts";

const NOW = new Date("2026-09-16T12:00:00+07:00").getTime();

function seriesTask(id: string, dueAt: string, status = "scheduled") {
  return {
    id,
    title: "Weekly Review & Next Week Prep",
    status,
    dueAt,
    repeatSeriesId: "series-review",
    projectType: "HABIT" as const,
    projectId: "proj",
  };
}

test("collapseForAllView keeps one row per repeat series", () => {
  const tasks = [
    seriesTask("w1", "2026-09-07T00:00:00.000Z"),
    seriesTask("w2", "2026-09-14T00:00:00.000Z"),
    seriesTask("w3", "2026-09-21T00:00:00.000Z"),
    seriesTask("w4", "2026-10-05T00:00:00.000Z"),
    {
      id: "finite",
      title: "Finalize target role profile",
      status: "scheduled",
      dueAt: "2026-09-20T00:00:00.000Z",
      repeatSeriesId: null,
      projectType: "STANDARD" as const,
      projectId: "career",
    },
  ];
  const collapsed = collapseForAllView(tasks, { nowMs: NOW });
  assert.equal(collapsed.length, 2);
  assert.equal(
    pickInventoryRepresentative(
      tasks.filter((task) => task.repeatSeriesId === "series-review"),
      NOW,
    ).id,
    "w3",
  );
});

test("countUnscheduledTaskBadge dedupes repeat series and ignores scheduled instances", () => {
  const tasks = [
    seriesTask("w1", "2026-09-07T00:00:00.000Z"),
    seriesTask("w2", "2026-09-14T00:00:00.000Z"),
    seriesTask("w3", "2026-09-21T00:00:00.000Z"),
    {
      id: "meet",
      title: "Meetings",
      status: "scheduled",
      dueAt: "2026-09-16T00:00:00.000Z",
      repeatSeriesId: "series-meet",
      projectType: "STANDARD" as const,
      projectId: "rover",
    },
    {
      id: "solo",
      title: "Send outreach",
      status: "inbox",
      dueAt: null,
      repeatSeriesId: null,
      projectType: "STANDARD" as const,
      projectId: "career",
    },
  ];
  assert.equal(countUnscheduledTaskBadge(tasks, []), 3);
  assert.equal(
    countUnscheduledTaskBadge(tasks, [{ type: "task", taskId: "w2" }, { type: "task", taskId: "meet" }]),
    1,
  );
});
