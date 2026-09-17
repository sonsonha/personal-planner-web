import type {
  HorizonScope,
  TaskHorizon,
  TasksViewBlock,
  TasksViewTask,
} from "../components/planner/tasks/types.ts";
import { findDailyFocusSession, isSessionDailyFocusOnDate, productDateFromEpoch } from "./daily-focus.ts";
import {
  isTaskCompletedForDayView,
  isTaskCompletedForListView,
} from "./session-evidence.ts";
import {
  buildWeekTaskHierarchy,
  isRoutineTask,
  routineGroupingKey,
  type WeekHierarchyRow,
  type WeekHierarchySection,
  type WeekTaskMeta,
} from "./week-task-hierarchy.ts";

export type TaskGroup = {
  id: string;
  label: string;
  tasks: TasksViewTask[];
  /** Week hierarchy rows (task or collapsed routine). */
  rows?: WeekHierarchyRow[];
  weekMetaByTaskId?: Record<string, WeekTaskMeta>;
  completedSessions?: number;
  plannedSessions?: number;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
};

function blockForTask(taskId: string, blocks: TasksViewBlock[]) {
  return blocks.find((block) => block.taskId === taskId);
}

function sessionProductDate(block: TasksViewBlock): string | null {
  if (!block.startAt) return null;
  const epoch = new Date(block.startAt).getTime();
  if (!Number.isFinite(epoch)) return null;
  return productDateFromEpoch(epoch);
}

/** Sessions for a task on one product day (Day Tasks evidence scope). */
export function blocksForTaskOnDay(
  taskId: string,
  blocks: TasksViewBlock[],
  dayKey: string,
): TasksViewBlock[] {
  return blocks.filter(
    (block) => block.taskId === taskId && sessionProductDate(block) === dayKey,
  );
}

function tasksById(tasks: TasksViewTask[]) {
  return new Map(tasks.map((task) => [task.id, task]));
}

function flattenWeekSection(
  section: WeekHierarchySection,
  byId: Map<string, TasksViewTask>,
): TasksViewTask[] {
  const out: TasksViewTask[] = [];
  for (const row of section.rows) {
    if (row.kind === "task") {
      const task = byId.get(row.taskId);
      if (task) out.push(task);
      continue;
    }
    const representative = byId.get(row.routine.representativeTaskId);
    if (representative) out.push(representative);
  }
  return out;
}

function weekMetaMap(section: WeekHierarchySection): Record<string, WeekTaskMeta> {
  const map: Record<string, WeekTaskMeta> = {};
  for (const row of section.rows) {
    if (row.kind === "task") map[row.taskId] = row.meta;
  }
  return map;
}

function dueDateKey(task: TasksViewTask): string | null {
  if (!task.dueAt) return null;
  const time = new Date(task.dueAt).getTime();
  if (!Number.isFinite(time)) return null;
  return productDateFromEpoch(time);
}

function taskHasSession(taskId: string, blocks: TasksViewBlock[]) {
  return blocks.some((block) => block.taskId === taskId);
}

/**
 * Day view: one row per habit series.
 * Prefer the instance that has a Session today; else the due-matching instance.
 * Avoids “Unscheduled” + “06:00” duplicates after paste / due-date edits.
 */
export function pickDayRoutineRepresentative(
  bucket: TasksViewTask[],
  blocks: TasksViewBlock[],
  focusDate?: string | null,
): TasksViewTask {
  if (bucket.length === 0) {
    throw new Error("pickDayRoutineRepresentative: empty bucket");
  }
  if (bucket.length === 1) return bucket[0]!;
  const withSession = bucket.filter((task) => taskHasSession(task.id, blocks));
  const pool = withSession.length > 0 ? withSession : bucket;
  if (focusDate) {
    const dueMatch = pool.find((task) => dueDateKey(task) === focusDate);
    if (dueMatch) return dueMatch;
  }
  return [...pool].sort((left, right) => {
    const leftDue = left.dueAt ? new Date(left.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const rightDue = right.dueAt ? new Date(right.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    return leftDue - rightDue;
  })[0]!;
}

function dedupeDayRoutineTasks(
  tasks: TasksViewTask[],
  blocks: TasksViewBlock[],
  focusDate?: string | null,
): TasksViewTask[] {
  const buckets = new Map<string, TasksViewTask[]>();
  for (const task of tasks) {
    const key = routineGroupingKey(task);
    const bucket = buckets.get(key) ?? [];
    bucket.push(task);
    buckets.set(key, bucket);
  }
  return [...buckets.values()].map((bucket) =>
    pickDayRoutineRepresentative(bucket, blocks, focusDate),
  );
}

/** Group Tasks for Day/Week/Month lists — one row per Task, never per TimeBlock. */
export function groupTasks(
  horizon: HorizonScope,
  tasks: TasksViewTask[],
  blocks: TasksViewBlock[],
  getHorizon: (task: TasksViewTask) => TaskHorizon,
  isOverdue: (task: TasksViewTask) => boolean,
  opts?: {
    focusDate?: string | null;
    emphasizeDailyFocus?: boolean;
    weekStartMs?: number;
    weekEndMs?: number;
    showCompleted?: boolean;
  },
): TaskGroup[] {
  if (horizon === "week" && opts?.weekStartMs != null && opts.weekEndMs != null) {
    const hierarchy = buildWeekTaskHierarchy({
      tasks,
      sessions: blocks,
      weekStartMs: opts.weekStartMs,
      weekEndMs: opts.weekEndMs,
      isOverdue,
      showCompleted: opts.showCompleted ?? true,
    });
    const byId = tasksById(tasks);
    return hierarchy.sections.map((section) => ({
      id: section.id,
      label: section.label,
      tasks: flattenWeekSection(section, byId),
      rows: section.rows,
      weekMetaByTaskId: weekMetaMap(section),
      completedSessions: section.completedSessions,
      plannedSessions: section.plannedSessions,
      collapsible: section.collapsible,
      defaultCollapsed: section.defaultCollapsed,
    }));
  }

  const buckets: Record<string, TasksViewTask[]> = {};
  const ensure = (id: string) => {
    if (!buckets[id]) buckets[id] = [];
    return buckets[id]!;
  };

  const dayKey = horizon === "day" ? (opts?.focusDate ?? null) : null;
  const focusDate = opts?.emphasizeDailyFocus ? dayKey : null;
  const focusSession = focusDate ? findDailyFocusSession(blocks, focusDate) : null;
  const focusTaskId = focusSession?.taskId ?? null;

  for (const task of tasks) {
    const allTaskBlocks = blocks.filter((block) => block.taskId === task.id);
    const taskBlocks = dayKey
      ? blocksForTaskOnDay(task.id, blocks, dayKey)
      : allTaskBlocks;
    const evidence = taskBlocks.map((item) => ({
      id: item.id,
      status: item.status ?? "PLANNED",
    }));
    const completedOnDay = Boolean(dayKey) && isTaskCompletedForDayView(evidence);
    if (completedOnDay || isTaskCompletedForListView(task, evidence)) {
      ensure("completed").push(task);
      continue;
    }
    if (isOverdue(task)) {
      ensure("overdue").push(task);
      continue;
    }

    const taskHorizon = getHorizon(task);
    const block = dayKey
      ? (blocksForTaskOnDay(task.id, blocks, dayKey)[0] ?? blockForTask(task.id, blocks))
      : blockForTask(task.id, blocks);
    const hasFocusSessionToday = Boolean(
      focusDate
      && blocks.some(
        (candidate) =>
          candidate.taskId === task.id && isSessionDailyFocusOnDate(candidate, focusDate),
      ),
    );

    if (horizon === "day") {
      if (focusDate && (task.id === focusTaskId || hasFocusSessionToday)) {
        ensure("daily-focus").push(task);
      } else if (isRoutineTask(task)) {
        ensure("routines").push(task);
      } else if (taskHorizon === "day") {
        ensure(focusDate || dayKey ? "also-today" : "day-due").push(task);
      } else if (block) {
        ensure(focusDate || dayKey ? "also-today" : "scheduled").push(task);
      } else {
        ensure(focusDate || dayKey ? "also-today" : "scheduled").push(task);
      }
      continue;
    }

    if (horizon === "week") {
      // Fallback without week window — legacy flat scheduled/open buckets.
      if (block) {
        ensure("scheduled").push(task);
      } else if (task.status === "inbox" && taskHorizon === "week") {
        ensure("week-open").push(task);
      } else {
        ensure("week-open").push(task);
      }
      continue;
    }

    if (horizon === "month") {
      if (taskHorizon === "month") {
        ensure("month").push(task);
      } else if (taskHorizon === "week") {
        ensure("week").push(task);
      } else {
        ensure("month").push(task);
      }
      continue;
    }

    if (taskHorizon === "day") continue; // All inventory skips daily checkpoints
    if (taskHorizon === "week") ensure("week").push(task);
    else if (taskHorizon === "month") ensure("month").push(task);
    else ensure("someday").push(task);
  }

  const order: Array<{ id: string; label: string }> =
    horizon === "day"
      ? dayKey
        ? [
            { id: "overdue", label: "Overdue" },
            ...(focusDate ? [{ id: "daily-focus", label: "Daily Focus" }] : []),
            { id: "also-today", label: "Also today" },
            { id: "routines", label: "Routines & Maintain" },
            { id: "completed", label: "Completed" },
          ]
        : [
            { id: "overdue", label: "Overdue" },
            { id: "day-due", label: "Day due" },
            { id: "scheduled", label: "Scheduled" },
            { id: "routines", label: "Routines & Maintain" },
            { id: "completed", label: "Completed" },
          ]
      : horizon === "week"
        ? [
            { id: "overdue", label: "Overdue" },
            { id: "scheduled", label: "Scheduled" },
            { id: "week-open", label: "This week · no specific day" },
            { id: "completed", label: "Completed" },
          ]
        : horizon === "month"
          ? [
              { id: "overdue", label: "Overdue" },
              { id: "month", label: "Month membership" },
              { id: "week", label: "Week membership" },
              { id: "completed", label: "Completed" },
            ]
          : [
              { id: "overdue", label: "Overdue" },
              { id: "week", label: "Week" },
              { id: "month", label: "Month" },
              { id: "someday", label: "Someday" },
              { id: "completed", label: "Completed" },
            ];

  return order
    .map((meta) => {
      let list = buckets[meta.id] ?? [];
      if (horizon === "day" && (meta.id === "routines" || meta.id === "overdue" || meta.id === "completed")) {
        list = dedupeDayRoutineTasks(list, blocks, dayKey);
      }
      return {
        id: meta.id,
        label: meta.label,
        tasks: list,
        ...(meta.id === "routines"
          ? {
              collapsible: true,
              // Always start collapsed so habits don't bury real work.
              defaultCollapsed: true,
            }
          : {}),
      };
    })
    .filter((group) => {
      if (group.id === "daily-focus") return true;
      return group.tasks.length > 0;
    });
}

export type { WeekHierarchyRow, WeekTaskMeta };
