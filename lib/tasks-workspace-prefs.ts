import type { HorizonScope } from "../components/planner/tasks/types.ts";

export type TasksWorkspacePrefs = {
  horizon: HorizonScope;
  anchorMs: number;
  showCompleted: boolean;
  projectFilterId: string | "all" | "inbox";
  query: string;
};

const DEFAULTS: TasksWorkspacePrefs = {
  horizon: "day",
  showCompleted: true,
  projectFilterId: "all",
  query: "",
  anchorMs: 0,
};

/** In-memory only — survives SPA section switches; clears on full page reload. */
let sessionCache: Partial<TasksWorkspacePrefs> | null = null;

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getTasksWorkspacePrefs(now = new Date()): TasksWorkspacePrefs {
  const todayMs = startOfDay(now).getTime();
  const cached = sessionCache ?? {};
  return {
    horizon: cached.horizon ?? DEFAULTS.horizon,
    showCompleted: cached.showCompleted ?? DEFAULTS.showCompleted,
    projectFilterId: cached.projectFilterId ?? DEFAULTS.projectFilterId,
    query: cached.query ?? DEFAULTS.query,
    anchorMs: cached.anchorMs && cached.anchorMs > 0 ? cached.anchorMs : todayMs,
  };
}

export function patchTasksWorkspacePrefs(partial: Partial<TasksWorkspacePrefs>) {
  sessionCache = { ...getTasksWorkspacePrefs(), ...partial };
}

/** Test helper — not used in production UI. */
export function resetTasksWorkspacePrefsCacheForTests() {
  sessionCache = null;
}
