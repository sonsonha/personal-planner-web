import assert from "node:assert/strict";
import test from "node:test";
import { overlapGeometry, resolveOverlapLayout } from "../components/planner/calendar/overlap.ts";

test("resolveOverlapLayout packs concurrent blocks into columns", () => {
  const laid = resolveOverlapLayout([
    { id: "a", start: 9 * 60, duration: 60 },
    { id: "b", start: 9 * 60 + 30, duration: 60 },
    { id: "c", start: 11 * 60, duration: 30 },
  ]);

  const byId = Object.fromEntries(laid.map((block) => [block.id, block]));
  assert.equal(byId.a.col, 0);
  assert.equal(byId.b.col, 1);
  assert.ok(byId.a.numCols >= 2);
  assert.ok(byId.b.numCols >= 2);
  assert.equal(byId.c.col, 0);
  assert.equal(byId.c.numCols, 1);
});

test("overlapGeometry uses full width for a single column", () => {
  const solo = overlapGeometry(0, 1);
  assert.match(solo.left, /0%/);
  assert.match(solo.right, /0%/);
});

test("non-overlapping blocks each get one column", () => {
  const laid = resolveOverlapLayout([
    { id: "a", start: 8 * 60, duration: 30 },
    { id: "b", start: 10 * 60, duration: 30 },
  ]);
  assert.equal(laid.every((block) => block.numCols === 1), true);
});
