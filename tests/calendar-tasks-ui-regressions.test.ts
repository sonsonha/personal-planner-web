import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { shouldApplyPlannerFetch } from "../lib/planner-fetch-guard.ts";

test("applies the latest planner fetch and ignores stale/aborted responses", () => {
  assert.equal(shouldApplyPlannerFetch({
    aborted: false,
    requestSeq: 2,
    latestSeq: 2,
  }), true);
  assert.equal(shouldApplyPlannerFetch({
    aborted: true,
    requestSeq: 1,
    latestSeq: 1,
  }), false);
  assert.equal(shouldApplyPlannerFetch({
    aborted: false,
    requestSeq: 1,
    latestSeq: 2,
  }), false);
});

test("tasks list scroll container uses flex min-height 0 overflow auto", () => {
  const css = readFileSync(
    path.join(process.cwd(), "components/planner/planner-ui.css"),
    "utf8",
  );
  assert.match(css, /\.pos-task\s*\{[^}]*display:\s*flex/s);
  assert.match(css, /\.pos-task\s*\{[^}]*min-height:\s*0/s);
  assert.match(css, /\.pos-task\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.pos-task-scroll\s*\{[^}]*overflow:\s*auto/s);
  assert.match(css, /\.pos-task-scroll\s*\{[^}]*min-height:\s*0/s);
});
