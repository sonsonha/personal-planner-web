import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const webRoot = fileURLToPath(new URL("..", import.meta.url));

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate port"));
        return;
      }
      const { port } = address;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function withProdServer(run, env = {}) {
  const port = await freePort();
  const child = spawn(process.execPath, [".output/server/index.mjs"], {
    cwd: webRoot,
    env: {
      ...process.env,
      ...env,
      PORT: String(port),
      HOST: "127.0.0.1",
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let ready = false;
  const started = Date.now();
  while (Date.now() - started < 15_000) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/calendar`, {
        headers: { accept: "text/html" },
      });
      if (response.status === 200 || response.status === 500) {
        ready = true;
        break;
      }
    } catch {
      // server still booting
    }
    await delay(150);
  }

  if (!ready) {
    child.kill("SIGKILL");
    throw new Error("Nitro production server failed to start");
  }

  try {
    return await run(port);
  } finally {
    child.kill("SIGTERM");
    await delay(200);
    if (!child.killed) child.kill("SIGKILL");
  }
}

test("server-renders the Personal OS calendar planner", async () => {
  await withProdServer(async (port) => {
    const response = await fetch(`http://127.0.0.1:${port}/calendar`, {
      headers: { accept: "text/html" },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

    const html = await response.text();
    assert.match(html, /<title>Personal OS — Calendar Planner<\/title>/i);
    assert.match(html, /Calendar planner/);
    assert.match(html, /Google Calendar/);
    assert.match(html, /Today(?:&#x27;|&apos;|')s work/);
    assert.match(html, /Drag onto free time to schedule|Drag a task onto free time/);
    assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);

    const root = await fetch(`http://127.0.0.1:${port}/`, { redirect: "manual" });
    assert.equal(root.status, 307);
    assert.match(root.headers.get("location") ?? "", /\/calendar$/);
  }, {
    PLANNER_API_BASE_URL: "",
    PLANNER_WEB_TOKEN: "",
    PLANNER_WEB_PRIVATE_KEY: "",
  });
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
    viteConfig,
    popoverSource,
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
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/planner/calendar/BlockPopover.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(plannerLayout, /getChatGPTUser/);
  assert.match(plannerLayout, /AuthGate/);
  assert.match(page, /redirect\(["']\/calendar["']\)/);
  assert.match(layout, /Personal OS — Calendar Planner/);
  assert.match(layout, /THEME_BOOT_SCRIPT|theme-boot/);
  assert.match(layout, /ThemeProvider/);
  assert.match(source, /data-priority/);
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
  assert.match(source, /CalendarQuickCreatePopover/);
  assert.doesNotMatch(source, /function SlotScheduleModal/);
  assert.match(source, /event-complete/);
  assert.match(source, /DestructiveConfirmModal/);
  assert.match(source, /DEFAULT_SESSION_MINUTES/);
  assert.match(source, /pos-cal-slot-select/);
  assert.match(source, /pos-cal-draft-block/);
  assert.match(source, /MIN_SESSION_MINUTES/);
  assert.match(popoverSource, /Repeat session/);
  assert.match(popoverSource, /Remove session/);
  assert.doesNotMatch(popoverSource, /Mark session done/);
  assert.doesNotMatch(popoverSource, /Open task/);
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

  assert.match(source, /handleSyncNow/);
  assert.match(source, /handleCalendarConnect/);
  assert.match(source, /handleSyncChipClick/);
  assert.doesNotMatch(source, /handleCalendarConnection/);
  assert.match(source, /Today's work/);
  assert.match(source, /This week's work/);
  assert.match(source, /Inbox · Unscheduled/);
  assert.match(source, /This Week/);
  assert.match(source, /taskInCalendarDrawer/);
  assert.match(source, /No tasks for today/);
  assert.match(source, /No remaining tasks this week/);
  assert.match(source, /No unscheduled tasks/);

  assert.match(progressDisplay, /processOnTargetSummary/);
  assert.match(progressDisplay, /processBucketCompact/);
  assert.match(progressDisplay, /completed/);
  assert.match(progressDisplay, /planned/);
  assert.match(progressDisplay, /target/);
  assert.match(progressWorkspace, /GlobalProgressView/);
  assert.match(progressWorkspace, /processBucketCompact/);

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
  assert.match(packageJson, /"nitro"/);
  assert.doesNotMatch(packageJson, /@cloudflare\/vite-plugin/);
  assert.match(viteConfig, /nitro\(\)/);
  assert.doesNotMatch(viteConfig, /cloudflare\(/);
});

test("returns a safe setup response while the planner backend is not configured", async () => {
  await withProdServer(async (port) => {
    const response = await fetch(
      `http://127.0.0.1:${port}/api/planner?from=2026-08-10T00%3A00%3A00.000Z&to=2026-08-17T00%3A00%3A00.000Z`,
    );
    assert.equal(response.status, 503);
    const payload = await response.json();
    assert.equal(payload.error.code, "PLANNER_NOT_CONFIGURED");
  }, {
    PLANNER_API_BASE_URL: "",
    PLANNER_WEB_TOKEN: "",
    PLANNER_WEB_PRIVATE_KEY: "",
  });
});
