import assert from "node:assert/strict";
import test from "node:test";
import {
  emptySessionOutcome,
  newChecklistItem,
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
