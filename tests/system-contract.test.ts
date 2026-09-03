import assert from "node:assert/strict";
import test from "node:test";
import type { GoalSystem } from "../lib/planner-api.ts";

/** Contract: System is rhythm intent only — never carries spawned Task/TimeBlock ids. */
function buildSystemV1(partial: Partial<GoalSystem> & Pick<GoalSystem, "id" | "title">): GoalSystem {
  return {
    targetType: "COUNT",
    targetValue: 5,
    unit: "sessions",
    period: "WEEK",
    durationWeeks: 8,
    status: "ACTIVE",
    startDate: null,
    preferredDays: null,
    preferredTime: null,
    ...partial,
  };
}

test("System V1 payload has rhythm fields and does not spawn Task or TimeBlock entities", () => {
  const system = buildSystemV1({
    id: "sys-english",
    title: "English Study",
    preferredDays: [1, 3, 5],
    preferredTime: "19:00",
  });
  assert.equal(system.title, "English Study");
  assert.equal(system.targetValue, 5);
  assert.equal(system.durationWeeks, 8);
  assert.equal(system.period, "WEEK");
  assert.equal(system.status, "ACTIVE");
  assert.deepEqual(system.preferredDays, [1, 3, 5]);
  // No auto-spawned execution entities on the System record.
  assert.equal("taskIds" in system, false);
  assert.equal("timeBlockIds" in system, false);
  assert.equal("googleEventIds" in system, false);
});

test("empty systems array is a valid Goal shape", () => {
  const systems: GoalSystem[] = [];
  assert.equal(systems.length, 0);
});
