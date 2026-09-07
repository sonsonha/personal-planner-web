/**
 * Week Tasks view hierarchy — derived UI only.
 * CORE = finite Tasks with ≥1 Daily Focus Session in the selected week.
 * SUPPORTING = finite non-routine Tasks without Daily Focus this week.
 * ROUTINES = Habit / repeat-series instances collapsed by series lineage.
 */
import { productDateFromEpoch } from "./daily-focus.ts";

export type WeekHierarchyTask = {
  id: string;
  title: string;
  notes?: string;
  status: string;
  priority?: string;
  projectId: string | null;
  project: string;
  color: string;
  duration?: number;
  dueAt?: string | null;
  dueHorizon?: string | null;
  repeatSeriesId?: string | null;
  projectType?: "STANDARD" | "HABIT" | null;
};

export type WeekHierarchySession = {
  id: string;
  taskId?: string | null;
  startAt?: string | null;
  startEpochMs?: number | null;
  status?: string | null;
  isDailyFocus?: boolean | null;
};

export type WeekTaskMeta = {
  focusWeekdays: string[];
  focusDateKeys: string[];
  completedSessions: number;
  plannedSessions: number;
};

export type WeekRoutineRow = {
  key: string;
  title: string;
  project: string;
  color: string;
  projectId: string | null;
  repeatSeriesId: string | null;
  taskIds: string[];
  representativeTaskId: string;
  completedSessions: number;
  plannedSessions: number;
};

export type WeekHierarchyRow =
  | { kind: "task"; taskId: string; meta: WeekTaskMeta }
  | { kind: "routine"; routine: WeekRoutineRow };

export type WeekHierarchySection = {
  id: "overdue" | "core" | "supporting" | "routines" | "completed";
  label: string;
  rows: WeekHierarchyRow[];
  /** Aggregate session progress for routines section. */
  completedSessions?: number;
  plannedSessions?: number;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
};

export type WeekHierarchyResult = {
  sections: WeekHierarchySection[];
  counts: {
    core: number;
    supporting: number;
    routines: number;
    overdue: number;
    completed: number;
  };
};

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function isRoutineTask(task: {
  repeatSeriesId?: string | null;
  projectType?: "STANDARD" | "HABIT" | null;
}): boolean {
  return Boolean(task.repeatSeriesId) || task.projectType === "HABIT";
}

/** Prefer repeat-series lineage; fall back to habit semantic identity — never title alone across projects. */
export function routineGroupingKey(task: {
  id: string;
  title: string;
  projectId: string | null;
  repeatSeriesId?: string | null;
  projectType?: "STANDARD" | "HABIT" | null;
}): string {
  if (task.repeatSeriesId) return `series:${task.repeatSeriesId}`;
  if (task.projectType === "HABIT") {
    return `habit:${task.projectId ?? "inbox"}:${normalizeRoutineTitle(task.title)}`;
  }
  return `task:${task.id}`;
}

function normalizeRoutineTitle(title: string) {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function sessionEpoch(session: WeekHierarchySession): number | null {
  if (typeof session.startEpochMs === "number" && Number.isFinite(session.startEpochMs)) {
    return session.startEpochMs;
  }
  if (session.startAt) {
    const time = new Date(session.startAt).getTime();
    return Number.isFinite(time) ? time : null;
  }
  return null;
}

export function sessionInWeek(
  session: WeekHierarchySession,
  weekStartMs: number,
  weekEndMs: number,
): boolean {
  const epoch = sessionEpoch(session);
  if (epoch == null) return false;
  return epoch >= weekStartMs && epoch < weekEndMs;
}

function isSessionDone(status?: string | null) {
  return status === "DONE" || status === "done";
}

function weekdayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  // Noon UTC+7 → stable weekday for product date.
  const epoch = Date.UTC(y, m - 1, d, 5, 0, 0);
  return WEEKDAY_SHORT[new Date(epoch).getUTCDay()] ?? dateKey;
}

export function formatFocusWeekdays(dateKeys: string[]): string[] {
  return [...dateKeys].sort().map(weekdayLabel);
}

function weekSessionsForTask(
  taskId: string,
  sessions: WeekHierarchySession[],
  weekStartMs: number,
  weekEndMs: number,
) {
  return sessions.filter(
    (session) =>
      session.taskId === taskId && sessionInWeek(session, weekStartMs, weekEndMs),
  );
}

function taskWeekMeta(
  taskId: string,
  sessions: WeekHierarchySession[],
  weekStartMs: number,
  weekEndMs: number,
): WeekTaskMeta {
  const weekSessions = weekSessionsForTask(taskId, sessions, weekStartMs, weekEndMs);
  const focusDateKeys = [
    ...new Set(
      weekSessions
        .filter((session) => session.isDailyFocus)
        .map((session) => {
          const epoch = sessionEpoch(session);
          return epoch == null ? null : productDateFromEpoch(epoch);
        })
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort();
  return {
    focusWeekdays: formatFocusWeekdays(focusDateKeys),
    focusDateKeys,
    completedSessions: weekSessions.filter((session) => isSessionDone(session.status)).length,
    plannedSessions: weekSessions.length,
  };
}

function hasDailyFocusThisWeek(
  taskId: string,
  sessions: WeekHierarchySession[],
  weekStartMs: number,
  weekEndMs: number,
): boolean {
  return weekSessionsForTask(taskId, sessions, weekStartMs, weekEndMs).some(
    (session) => Boolean(session.isDailyFocus),
  );
}

function pickRoutineTitle(tasks: WeekHierarchyTask[]): string {
  const titles = tasks.map((task) => task.title.trim()).filter(Boolean);
  if (titles.length === 0) return "Routine";
  // Prefer the shortest common-looking title (instances may append dates).
  return [...titles].sort((a, b) => a.length - b.length || a.localeCompare(b))[0]!;
}

function buildRoutineRow(
  key: string,
  tasks: WeekHierarchyTask[],
  sessions: WeekHierarchySession[],
  weekStartMs: number,
  weekEndMs: number,
): WeekRoutineRow {
  const taskIds = tasks.map((task) => task.id);
  const idSet = new Set(taskIds);
  const weekSessions = sessions.filter(
    (session) =>
      session.taskId
      && idSet.has(session.taskId)
      && sessionInWeek(session, weekStartMs, weekEndMs),
  );
  const representative =
    tasks.find((task) => task.status !== "done" && task.status !== "DONE")
    ?? tasks[0]!;
  return {
    key,
    title: pickRoutineTitle(tasks),
    project: representative.project,
    color: representative.color,
    projectId: representative.projectId,
    repeatSeriesId: representative.repeatSeriesId ?? null,
    taskIds,
    representativeTaskId: representative.id,
    completedSessions: weekSessions.filter((session) => isSessionDone(session.status)).length,
    plannedSessions: weekSessions.length,
  };
}

export function buildWeekTaskHierarchy(input: {
  tasks: WeekHierarchyTask[];
  sessions: WeekHierarchySession[];
  weekStartMs: number;
  weekEndMs: number;
  isOverdue: (task: WeekHierarchyTask) => boolean;
  showCompleted?: boolean;
}): WeekHierarchyResult {
  const { tasks, sessions, weekStartMs, weekEndMs, isOverdue } = input;
  const showCompleted = input.showCompleted ?? true;

  const overdue: WeekHierarchyRow[] = [];
  const core: WeekHierarchyRow[] = [];
  const supporting: WeekHierarchyRow[] = [];
  const completed: WeekHierarchyRow[] = [];
  const routineBuckets = new Map<string, WeekHierarchyTask[]>();

  const seenCore = new Set<string>();

  for (const task of tasks) {
    const done = task.status === "done" || task.status === "DONE";
    const routine = isRoutineTask(task);

    if (routine) {
      const key = routineGroupingKey(task);
      const bucket = routineBuckets.get(key) ?? [];
      bucket.push(task);
      routineBuckets.set(key, bucket);
      continue;
    }

    if (done) {
      if (showCompleted) {
        completed.push({
          kind: "task",
          taskId: task.id,
          meta: taskWeekMeta(task.id, sessions, weekStartMs, weekEndMs),
        });
      }
      continue;
    }

    if (isOverdue(task)) {
      overdue.push({
        kind: "task",
        taskId: task.id,
        meta: taskWeekMeta(task.id, sessions, weekStartMs, weekEndMs),
      });
      continue;
    }

    if (hasDailyFocusThisWeek(task.id, sessions, weekStartMs, weekEndMs)) {
      if (seenCore.has(task.id)) continue;
      seenCore.add(task.id);
      core.push({
        kind: "task",
        taskId: task.id,
        meta: taskWeekMeta(task.id, sessions, weekStartMs, weekEndMs),
      });
      continue;
    }

    supporting.push({
      kind: "task",
      taskId: task.id,
      meta: taskWeekMeta(task.id, sessions, weekStartMs, weekEndMs),
    });
  }

  const routineRows: WeekRoutineRow[] = [...routineBuckets.entries()]
    .map(([key, bucket]) => buildRoutineRow(key, bucket, sessions, weekStartMs, weekEndMs))
    .filter((row) => row.plannedSessions > 0 || bucketHasOpenTask(routineBuckets.get(row.key) ?? []))
    .sort((a, b) => a.title.localeCompare(b.title));

  // Keep routines that have open tasks even with zero sessions (week-open habits).
  const routines: WeekHierarchyRow[] = routineRows.map((routine) => ({
    kind: "routine",
    routine,
  }));

  const routineCompleted = routineRows.reduce((sum, row) => sum + row.completedSessions, 0);
  const routinePlanned = routineRows.reduce((sum, row) => sum + row.plannedSessions, 0);
  const hasCore = core.length > 0;

  const sections: WeekHierarchySection[] = [
    { id: "overdue", label: "Overdue", rows: overdue },
    { id: "core", label: "Core Work", rows: core },
    { id: "supporting", label: "Supporting", rows: supporting },
    {
      id: "routines",
      label: "Routines & Maintain",
      rows: routines,
      completedSessions: routineCompleted,
      plannedSessions: routinePlanned,
      collapsible: true,
      defaultCollapsed: hasCore,
    },
    { id: "completed", label: "Completed", rows: completed },
  ].filter((section) => {
    if (section.id === "core") return true;
    return section.rows.length > 0;
  });

  return {
    sections,
    counts: {
      core: core.length,
      supporting: supporting.length,
      routines: routines.length,
      overdue: overdue.length,
      completed: completed.length,
    },
  };
}

function bucketHasOpenTask(tasks: WeekHierarchyTask[]) {
  return tasks.some((task) => task.status !== "done" && task.status !== "DONE");
}

export function formatWeekRangeCaption(weekStart: Date): string {
  const end = new Date(weekStart.getTime() + 6 * 86_400_000);
  const startLabel = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endLabel = end.getMonth() === weekStart.getMonth()
    ? String(end.getDate())
    : end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${startLabel}–${endLabel}`;
}

export function formatWeekHeaderCounts(counts: WeekHierarchyResult["counts"]): string {
  const parts = [
    `${counts.core} Core`,
    `${counts.supporting} Supporting`,
    `${counts.routines} Routine${counts.routines === 1 ? "" : "s"}`,
  ];
  return parts.join(" · ");
}
