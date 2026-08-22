import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Personal OS calendar planner", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Personal OS — Calendar Planner<\/title>/i);
  assert.match(html, /Calendar planner/);
  assert.match(html, /Google Calendar/);
  // Default calendar side-panel filter is "today" (not inbox).
  // Apostrophe may be HTML-escaped in SSR output (Today&#x27;s work).
  assert.match(html, /Today(?:&#x27;|&apos;|')s work/);
  // Side panel still teaches drag-to-schedule (copy may evolve with Make migration).
  assert.match(html, /Drag onto free time to schedule|Drag a task onto free time/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships the core planning interactions", async () => {
  const [
    source,
    page,
    layout,
    plannerLayout,
    packageJson,
    apiClient,
    proxy,
    taskRoute,
    taskBlocksRoute,
    progressDisplay,
    progressWorkspace,
    tasksWorkspaceView,
    quickAddView,
    taskEditorView,
  ] = await Promise.all([
    readFile(new URL("../app/planner-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(planner)/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/(planner)/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../lib/planner-api.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/planner-backend.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/tasks/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/tasks/[id]/time-blocks/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/goal-progress-display.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/progress-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/planner/tasks/TasksWorkspaceView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/planner/tasks/QuickAddView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/planner/tasks/TaskEditorView.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(plannerLayout, /getChatGPTUser/);
  assert.match(plannerLayout, /<PlannerApp/);
  assert.match(page, /return null/);
  assert.match(layout, /Personal OS — Calendar Planner/);
  assert.match(source, /onCalendarDrop/);
  assert.match(source, /application\/x-personal-os/);
  assert.match(source, /completeTask/);
  assert.match(source, /QuickAdd/);
  assert.match(source, /fetchPlanner/);
  assert.match(source, /changes rolled back/);
  assert.match(apiClient, /createTimeBlock/);
  assert.match(apiClient, /updateTimeBlock/);
  assert.match(apiClient, /getGoogleAuthUrl/);
  assert.match(apiClient, /syncGoogleCalendar/);
  assert.match(source, /Google Calendar is up to date/);
  assert.match(source, /still need attention/);
  assert.match(source, /failedSyncCount/);
  assert.match(source, /AUTO_SYNC_INTERVAL_MS/);
  assert.match(source, /window\.addEventListener\("focus"/);
  assert.match(source, /document\.addEventListener\("visibilitychange"/);
  assert.match(source, /lastCalendarSyncAttemptRef/);
  assert.match(source, /function TasksWorkspace/);
  assert.match(source, /function TaskEditor/);
  assert.match(source, /Unschedule/);
  assert.match(source, /blocksOverlap/);
  assert.match(source, /SlotScheduleModal/);
  assert.match(source, /function MonthCalendar/);
  assert.match(source, /event-resize-handle/);
  assert.match(source, /resolveOverlapLayout/);
  assert.match(source, /PersonalOsBlockPopover|GoogleEventPopover/);
  assert.match(source, /activeSection === "projects"/);
  assert.match(source, /activeSection === "progress"/);
  assert.match(source, /ProgressWorkspace/);
  assert.match(source, /event\.key === "1"/);
  assert.match(source, /event\.key === "\/"/);
  assert.match(source, /view === "month"/);
  assert.match(source, /showExternalEvents/);
  assert.match(source, /projectFilterId/);

  // Calendar side-panel still supports both filter modes (source contract).
  assert.match(source, /Today's work/);
  assert.match(source, /Unscheduled work/);

  // Progress: completed/planned/target lives in goal-progress-display + ProgressWorkspace
  // (replaces obsolete planner-app weekPlannedPercent symbol after Batch 2 extraction).
  assert.match(progressDisplay, /processOnTargetSummary/);
  assert.match(progressDisplay, /processBucketCompact/);
  assert.match(progressDisplay, /completed/);
  assert.match(progressDisplay, /planned/);
  assert.match(progressDisplay, /target/);
  assert.match(progressWorkspace, /GlobalProgressView/);
  assert.match(progressWorkspace, /processBucketCompact/);

  // Tasks UI: presentational components after Batch 3 extraction.
  assert.match(source, /TasksWorkspaceView/);
  assert.match(source, /QuickAddView/);
  assert.match(source, /TaskEditorView/);
  assert.match(tasksWorkspaceView, /task-project-filter/);
  assert.match(tasksWorkspaceView, /Search tasks/);
  assert.match(quickAddView, /forHorizon|Planning period|For/);
  assert.match(taskEditorView, /Planning period/);
  assert.match(taskEditorView, /Unschedule/);

  assert.match(apiClient, /createProject/);
  assert.match(apiClient, /deleteGoal/);
  assert.match(apiClient, /fetchTaskTimeBlocks/);
  assert.match(apiClient, /deleteTask/);
  assert.match(taskRoute, /export async function DELETE/);
  assert.match(taskBlocksRoute, /\/v2\/tasks\/\$\{id\}\/time-blocks/);
  assert.match(proxy, /PLANNER_WEB_TOKEN/);
  assert.doesNotMatch(proxy, /NEXT_PUBLIC_PLANNER_WEB_TOKEN/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("returns a safe setup response while the planner backend is not configured", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("api-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/api/planner?from=2026-08-10T00%3A00%3A00.000Z&to=2026-08-17T00%3A00%3A00.000Z"),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );

  assert.equal(response.status, 401);
  const payload = await response.json();
  assert.equal(payload.error.code, "UNAUTHORIZED");
});
