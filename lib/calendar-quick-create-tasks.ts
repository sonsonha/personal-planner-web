import { productDateFromEpoch } from "./daily-focus.ts";
import { isRoutineTask, routineGroupingKey } from "./week-task-hierarchy.ts";

export type QuickCreateSourceTask = {
  id: string;
  title: string;
  projectId: string | null;
  project: string;
  color: string;
  duration: number;
  status: string;
  priority?: "p1" | "p2" | "p3" | "p4";
  dueAt?: string | null;
  dueHorizon?: "day" | "week" | "month" | null;
  repeatSeriesId?: string | null;
  projectType?: "STANDARD" | "HABIT" | null;
  /** Lower = more important project (owner priority order). */
  projectRank?: number;
};

export type QuickCreateListedTask = QuickCreateSourceTask & {
  /** True when this row stands for many routine instances. */
  isRoutine?: boolean;
  instanceCount?: number;
};

function isDone(status: string) {
  return status === "done" || status === "DONE";
}

function dueDateKey(task: QuickCreateSourceTask): string | null {
  if (!task.dueAt) return null;
  const time = new Date(task.dueAt).getTime();
  if (!Number.isFinite(time)) return null;
  return productDateFromEpoch(time);
}

/**
 * Calendar "Task" dropdown: link a session to an existing Task.
 * Routine series (Wake-up / Bedtime / Daily Review, …) collapse to one row
 * so historical DAY instances do not flood the list.
 * Prefers the open instance whose due date matches the slot day.
 */
export function listTasksForQuickCreate(
  tasks: QuickCreateSourceTask[],
  slotDateKey?: string | null,
): QuickCreateListedTask[] {
  const open = tasks.filter((task) => !isDone(task.status));
  const buckets = new Map<string, QuickCreateSourceTask[]>();

  for (const task of open) {
    const key = routineGroupingKey(task);
    const bucket = buckets.get(key) ?? [];
    bucket.push(task);
    buckets.set(key, bucket);
  }

  const listed: QuickCreateListedTask[] = [];
  for (const bucket of buckets.values()) {
    const pick = pickRepresentative(bucket, slotDateKey);
    if (!pick) continue;
    const routine = isRoutineTask(pick) || bucket.length > 1;
    listed.push({
      ...pick,
      isRoutine: routine,
      instanceCount: bucket.length,
    });
  }

  return listed.sort((a, b) => {
    const aRoutine = a.isRoutine ? 1 : 0;
    const bRoutine = b.isRoutine ? 1 : 0;
    if (aRoutine !== bRoutine) return aRoutine - bRoutine;
    const aPriority = priorityRank(a.priority);
    const bPriority = priorityRank(b.priority);
    if (aPriority !== bPriority) return aPriority - bPriority;
    const aProject = a.projectRank ?? Number.MAX_SAFE_INTEGER;
    const bProject = b.projectRank ?? Number.MAX_SAFE_INTEGER;
    if (aProject !== bProject) return aProject - bProject;
    const aHorizon = horizonRank(a.dueHorizon);
    const bHorizon = horizonRank(b.dueHorizon);
    if (aHorizon !== bHorizon) return aHorizon - bHorizon;
    return a.title.localeCompare(b.title);
  });
}

function priorityRank(priority: QuickCreateSourceTask["priority"]) {
  if (priority === "p1") return 0;
  if (priority === "p2") return 1;
  if (priority === "p3") return 2;
  if (priority === "p4") return 3;
  return 1;
}

function horizonRank(horizon: QuickCreateSourceTask["dueHorizon"]) {
  if (horizon === "week") return 0;
  if (horizon === "month") return 1;
  if (horizon == null) return 2;
  return 3; // day / routines last among non-routines
}

function pickRepresentative(
  bucket: QuickCreateSourceTask[],
  slotDateKey?: string | null,
): QuickCreateSourceTask | null {
  if (bucket.length === 0) return null;
  if (slotDateKey) {
    const onSlot = bucket.find((task) => dueDateKey(task) === slotDateKey);
    if (onSlot) return onSlot;
  }
  // Prefer most recent due among open instances (closest to “current” habit row).
  return [...bucket].sort((a, b) => {
    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : 0;
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : 0;
    return bDue - aDue;
  })[0]!;
}
