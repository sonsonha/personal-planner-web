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
  assert.match(html, /Unscheduled work/);
  assert.match(html, /Drag a task onto free time/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships the core planning interactions", async () => {
  const [source, page, layout, packageJson, apiClient, proxy, taskRoute, taskBlocksRoute] = await Promise.all([
    readFile(new URL("../app/planner-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../lib/planner-api.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/planner-backend.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/tasks/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/tasks/[id]/time-blocks/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /getChatGPTUser/);
  assert.match(page, /<PlannerApp/);
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
  assert.match(source, /activeSection === "projects"/);
  assert.match(source, /activeSection === "goals"/);
  assert.match(source, /event\.key === "1"/);
  assert.match(source, /event\.key === "\/"/);
  assert.match(source, /view === "month"/);
  assert.match(source, /weekPlannedPercent/);
  assert.match(source, /showExternalEvents/);
  assert.match(source, /projectFilterId/);
  assert.match(source, /task-project-filter/);
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
