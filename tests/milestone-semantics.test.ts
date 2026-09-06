import assert from "node:assert/strict";
import test from "node:test";

/** Mirrors Goal journey visual semantics: CURRENT ≠ COMPLETED. */
type MilestoneStatus = "done" | "current" | "pending";

function milestoneVisual(status: MilestoneStatus): "checkmark" | "filled-dot" | "hollow-dot" {
  if (status === "done") return "checkmark";
  if (status === "current") return "filled-dot";
  return "hollow-dot";
}

test("milestone CURRENT is not rendered as completed", () => {
  assert.equal(milestoneVisual("current"), "filled-dot");
  assert.notEqual(milestoneVisual("current"), "checkmark");
  assert.equal(milestoneVisual("done"), "checkmark");
  assert.equal(milestoneVisual("pending"), "hollow-dot");
});

test("seed-style journey starts with CURRENT then PENDING", () => {
  const titles = [
    "Diagnostic baseline established",
    "Writing and Speaking weaknesses identified",
  ];
  const milestones = titles.map((title, index) => ({
    title,
    status: (index === 0 ? "current" : "pending") as MilestoneStatus,
  }));
  assert.equal(milestones[0]!.status, "current");
  assert.equal(milestoneVisual(milestones[0]!.status), "filled-dot");
  assert.equal(milestones[1]!.status, "pending");
});
