import assert from "node:assert/strict";
import test from "node:test";
import {
  emptySessionOutcome,
  newChecklistItem,
  resetSessionOutcomeForPaste,
  sessionOutcomeProgressLabel,
} from "../lib/session-outcome.ts";

test("session outcome NONE has no progress label", () => {
  assert.equal(sessionOutcomeProgressLabel(emptySessionOutcome()), null);
});

test("checklist progress and quantity exceed-target remain visible", () => {
  const checklist = {
    type: "CHECKLIST" as const,
    items: [
      newChecklistItem("A"),
      { ...newChecklistItem("B"), done: true },
      { ...newChecklistItem("C"), done: true },
      newChecklistItem("D"),
    ],
    target: null,
    actual: null,
    unit: null,
  };
  assert.equal(sessionOutcomeProgressLabel(checklist), "2 / 4");

  const quantity = {
    type: "QUANTITY" as const,
    items: [],
    target: 2,
    actual: 3,
    unit: "applications",
  };
  assert.equal(sessionOutcomeProgressLabel(quantity), "3 / 2 applications");
});

test("resetSessionOutcomeForPaste keeps template but clears progress", () => {
  assert.equal(resetSessionOutcomeForPaste(emptySessionOutcome()), null);
  assert.deepEqual(
    resetSessionOutcomeForPaste({
      type: "QUANTITY",
      items: [],
      target: 2,
      actual: 1,
      unit: "applications",
    }),
    {
      type: "QUANTITY",
      items: [],
      target: 2,
      actual: 0,
      unit: "applications",
    },
  );
  const reset = resetSessionOutcomeForPaste({
    type: "CHECKLIST",
    items: [{ id: "1", text: "A", done: true }],
    target: null,
    actual: null,
    unit: null,
  });
  assert.equal(reset?.type, "CHECKLIST");
  assert.equal(reset?.items[0]?.done, false);
});
