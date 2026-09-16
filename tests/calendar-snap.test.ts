import assert from "node:assert/strict";
import test from "node:test";
import { snapMinutesForCreate, snapToFineGrid } from "../lib/calendar-snap.ts";

test("fine grid stays at 5-minute marks", () => {
  assert.equal(snapToFineGrid(11 * 60 + 7), 11 * 60 + 5);
  assert.equal(snapToFineGrid(11 * 60 + 13), 11 * 60 + 15);
});

test("create snap pulls nearby clicks onto :00 / :30", () => {
  // Aiming for 11:00
  assert.equal(snapMinutesForCreate(11 * 60 + 5), 11 * 60);
  assert.equal(snapMinutesForCreate(11 * 60 + 10), 11 * 60);
  assert.equal(snapMinutesForCreate(10 * 60 + 55), 11 * 60);

  // Aiming for 11:30
  assert.equal(snapMinutesForCreate(11 * 60 + 25), 11 * 60 + 30);
  assert.equal(snapMinutesForCreate(11 * 60 + 35), 11 * 60 + 30);
});

test("create snap keeps mid-slot times away from majors", () => {
  assert.equal(snapMinutesForCreate(11 * 60 + 15), 11 * 60 + 15);
  // 11:20 is within pull of 11:30 → magnet applies
  assert.equal(snapMinutesForCreate(11 * 60 + 20), 11 * 60 + 30);
});
