import assert from "node:assert/strict";
import test from "node:test";
import {
  getTasksWorkspacePrefs,
  patchTasksWorkspacePrefs,
  resetTasksWorkspacePrefsCacheForTests,
} from "../lib/tasks-workspace-prefs.ts";

test("defaults to day view with show completed on first visit", () => {
  resetTasksWorkspacePrefsCacheForTests();
  const prefs = getTasksWorkspacePrefs(new Date("2026-09-16T12:00:00+07:00"));
  assert.equal(prefs.horizon, "day");
  assert.equal(prefs.showCompleted, true);
  assert.equal(prefs.projectFilterId, "all");
});

test("in-memory cache survives simulated navigation within one session", () => {
  resetTasksWorkspacePrefsCacheForTests();
  patchTasksWorkspacePrefs({ horizon: "week", showCompleted: false });
  const prefs = getTasksWorkspacePrefs();
  assert.equal(prefs.horizon, "week");
  assert.equal(prefs.showCompleted, false);
});

test("full reload clears cache via reset helper (fresh defaults)", () => {
  patchTasksWorkspacePrefs({ horizon: "month", query: "meetings" });
  resetTasksWorkspacePrefsCacheForTests();
  const prefs = getTasksWorkspacePrefs();
  assert.equal(prefs.horizon, "day");
  assert.equal(prefs.query, "");
});
