import assert from "node:assert/strict";
import test from "node:test";
import {
  formatObservationEntry,
  isVagueGoalOutcome,
  processBucketCompact,
  processOnTargetSummary,
} from "../lib/goal-progress-display.ts";

test("processOnTargetSummary counts systems meeting threshold", () => {
  const processes = [
    {
      id: "a",
      name: "Applications",
      thisWeek: { completed: 4, target: 5, planned: 6 },
      thisMonth: { completed: 4, target: 5, planned: 6 },
      allTime: { completed: 20, target: 25, planned: 26 },
    },
    {
      id: "b",
      name: "Speaking",
      thisWeek: { completed: 2, target: 3, planned: 3 },
      thisMonth: { completed: 2, target: 3, planned: 3 },
      allTime: { completed: 10, target: 12, planned: 12 },
    },
    {
      id: "c",
      name: "Mock",
      thisWeek: { completed: 1, target: 1, planned: 1 },
      thisMonth: { completed: 1, target: 1, planned: 1 },
      allTime: { completed: 4, target: 4, planned: 4 },
    },
  ];
  assert.equal(processOnTargetSummary(processes, "week"), "2 of 3 systems currently on target");
});

test("processBucketCompact separates target and planned", () => {
  const lines = processBucketCompact({ completed: 4, target: 5, planned: 6 });
  assert.equal(lines.targetLine, "4 / 5 target");
  assert.equal(lines.plannedLine, "6 planned");
});

test("formatObservationEntry prefers readable month labels", () => {
  const entry = formatObservationEntry({
    observedAt: "2026-07-01T00:00:00.000Z",
    value: 0,
    label: "July — 0 offers",
  });
  assert.equal(entry.month, "July");
  assert.equal(entry.detail, "0 offers");
});

test("isVagueGoalOutcome flags generic titles", () => {
  assert.equal(isVagueGoalOutcome("Scholarship"), true);
  assert.equal(isVagueGoalOutcome("Get a Backend Developer job before November"), false);
});
