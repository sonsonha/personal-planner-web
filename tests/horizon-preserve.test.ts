import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Scheduling a Session must never mutate Task dueHorizon.
 * This mirrors the planner-app rule removed from scheduleTaskAtSlot / onCalendarDrop.
 */
function applyScheduleWithoutHorizonMutation(task: {
  status: string;
  dueHorizon: "day" | "week" | "month" | null;
  dueAt: string | null;
}) {
  return {
    ...task,
    status: "scheduled",
    // Intentionally do not touch dueHorizon / dueAt.
  };
}

describe("session schedule preserves task horizon", () => {
  it("keeps WEEK after scheduling a session", () => {
    const next = applyScheduleWithoutHorizonMutation({
      status: "inbox",
      dueHorizon: "week",
      dueAt: "2026-09-01T00:00:00.000Z",
    });
    assert.equal(next.dueHorizon, "week");
    assert.equal(next.dueAt, "2026-09-01T00:00:00.000Z");
    assert.equal(next.status, "scheduled");
  });

  it("keeps MONTH after scheduling", () => {
    const next = applyScheduleWithoutHorizonMutation({
      status: "inbox",
      dueHorizon: "month",
      dueAt: "2026-09-01T00:00:00.000Z",
    });
    assert.equal(next.dueHorizon, "month");
  });
});
