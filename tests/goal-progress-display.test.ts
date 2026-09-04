import assert from "node:assert/strict";
import test from "node:test";
import {
  coerceProcessBucketForDisplay,
  formatObservationEntry,
  formatProcessRatio,
  formatProcessValue,
  isVagueGoalOutcome,
  normalizeProcessUnit,
  processBucketCompact,
  processOnTargetSummary,
} from "../lib/goal-progress-display.ts";

test("processOnTargetSummary counts processes meeting threshold", () => {
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
  assert.equal(processOnTargetSummary(processes, "week"), "2 of 3 processes currently on target");
});

test("processBucketCompact separates target and planned with units", () => {
  const hours = processBucketCompact({ completed: 4.8, target: 120, planned: 10.2, unit: "h" });
  assert.equal(hours.targetLine, "4.8h / 120h target");
  assert.equal(hours.plannedLine, "10.2h planned");

  const sessions = processBucketCompact(
    { completed: 4, target: 5, planned: 6 },
    "COUNT",
  );
  assert.equal(sessions.targetLine, "4 sessions / 5 sessions target");
  assert.equal(sessions.plannedLine, "6 sessions planned");
});

test("formatProcessValue always shows duration hours and count sessions", () => {
  assert.equal(formatProcessValue(4.8, "h"), "4.8h");
  assert.equal(formatProcessValue(120, "hours"), "120h");
  assert.equal(formatProcessValue(4.8, undefined, "DURATION"), "4.8h");
  assert.equal(formatProcessValue(4.8, "min", "DURATION"), "4.8h");
  assert.equal(formatProcessValue(2, undefined, "COUNT"), "2 sessions");
  assert.equal(formatProcessValue(3, "sections"), "3 sections");
  assert.equal(formatProcessRatio(4.8, 120, "h"), "4.8h / 120h");
  assert.equal(normalizeProcessUnit("HR"), "h");
});

test("coerceProcessBucketForDisplay converts legacy minute targets to hours", () => {
  const coerced = coerceProcessBucketForDisplay(
    { completed: 4.8, target: 120, planned: 10.2, unit: "min" },
    "DURATION",
  );
  assert.equal(coerced.unit, "h");
  assert.equal(coerced.target, 2);
  assert.equal(coerced.completed, 4.8);
  assert.equal(formatProcessValue(coerced.completed, coerced.unit, "DURATION"), "4.8h");
  assert.equal(formatProcessValue(coerced.target, coerced.unit, "DURATION"), "2h");
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
