import assert from "node:assert/strict";
import test from "node:test";
import { mergePlannerBlocksPreservingNewerOutcomes } from "../lib/planner-block-merge.ts";

test("stale planner fetch keeps newer local Session Outcome revision", () => {
  const previous = [{
    id: "session-1",
    type: "task",
    revision: 5,
    sessionOutcome: {
      type: "CHECKLIST",
      items: [{ id: "a", text: "coherent story", done: true }],
    },
  }];
  const incoming = [{
    id: "session-1",
    type: "task",
    revision: 4,
    sessionOutcome: {
      type: "CHECKLIST",
      items: [{ id: "a", text: "coherent story", done: false }],
    },
  }];
  const merged = mergePlannerBlocksPreservingNewerOutcomes(previous, incoming);
  assert.equal(merged[0]?.revision, 5);
  assert.equal(
    (merged[0]?.sessionOutcome as { items: Array<{ done: boolean }> }).items[0]?.done,
    true,
  );
});

test("equal-or-newer fetch replaces local outcome", () => {
  const previous = [{
    id: "session-1",
    type: "task",
    revision: 4,
    sessionOutcome: { type: "CHECKLIST", items: [{ id: "a", text: "x", done: true }] },
  }];
  const incoming = [{
    id: "session-1",
    type: "task",
    revision: 5,
    sessionOutcome: { type: "CHECKLIST", items: [{ id: "a", text: "x", done: false }] },
  }];
  const merged = mergePlannerBlocksPreservingNewerOutcomes(previous, incoming);
  assert.equal(merged[0]?.revision, 5);
  assert.equal(
    (merged[0]?.sessionOutcome as { items: Array<{ done: boolean }> }).items[0]?.done,
    false,
  );
});
