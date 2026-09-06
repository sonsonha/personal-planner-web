import assert from "node:assert/strict";
import test from "node:test";
import {
  getOutcomeSnapshot,
  isTrackingStatusMetric,
  parseTargetNumber,
  withMetricTarget,
} from "../lib/goal-outcome.ts";
import type { ApiGoal } from "../lib/planner-api.ts";

function goal(partial: Partial<ApiGoal> & Pick<ApiGoal, "id" | "title">): ApiGoal {
  return {
    lifeArea: "LIFE",
    description: "",
    horizon: "SHORT",
    status: "ACTIVE",
    targetDate: null,
    parentId: null,
    successCriteria: "",
    outcome: partial.outcome ?? partial.title,
    why: "",
    metric: "",
    focusType: "FOCUS",
    outcomeStatus: "ACTIVE",
    achievedAt: null,
    closedAt: null,
    currentMilestoneId: null,
    milestones: [],
    systems: [],
    processes: [],
    metricObservations: [],
    reflection: {},
    reviewSnapshot: {},
    revision: 1,
    updatedAt: new Date().toISOString(),
    ...partial,
  } as ApiGoal;
}

test("parseTargetNumber prefers Target line over Current: 0", () => {
  const g = goal({
    id: "1",
    title: "Get offer",
    metric: "Number of accepted backend job offers\nCurrent: 0 offer accepted\nTarget: 1 offer accepted",
  });
  assert.equal(parseTargetNumber(g), 1);
  assert.equal(getOutcomeSnapshot(g).line, "0 / 1 offers");
});

test("parseTargetNumber defaults offer goals without numbers to 1", () => {
  const g = goal({
    id: "2",
    title: "Get offer",
    metric: "Signed offer",
  });
  assert.equal(parseTargetNumber(g), 1);
  assert.equal(getOutcomeSnapshot(g).line, "0 / 1 offers");
});

test("unknown metric current is not coerced to 0", () => {
  const g = goal({
    id: "ielts",
    title: "Achieve IELTS 7.0",
    metric: "IELTS Overall Band\nBaseline: Not set\nTarget: 7.0",
    outcome: "Achieve IELTS Overall Band 7.0.",
  });
  const snap = getOutcomeSnapshot(g);
  assert.equal(snap.current, null);
  assert.equal(snap.target, 7);
  assert.equal(snap.line, "— / 7.0");
  assert.doesNotMatch(snap.line ?? "", /^0\s*\//);
});

test("finance stale threshold is not an outcome target", () => {
  const g = goal({
    id: "finance",
    title: "Maintain Personal Financial Awareness & Control",
    metric: "Finance tracking freshness (future: lastFinanceActivity within 5 days)",
    outcome: "Keep personal finances sufficiently recorded.",
  });
  assert.equal(isTrackingStatusMetric(g), true);
  assert.equal(parseTargetNumber(g), null);
  assert.equal(getOutcomeSnapshot(g).line, "Integration pending");
  assert.doesNotMatch(getOutcomeSnapshot(g).line ?? "", /0\s*\/\s*5/);
});

test("withMetricTarget rewrites Target line", () => {
  const next = withMetricTarget(
    "Offers\nCurrent: 0\nTarget: 1 offer",
    2,
  );
  assert.match(next, /Target: 2/);
  assert.doesNotMatch(next, /Target: 1/);
});
