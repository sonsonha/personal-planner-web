import { routineGroupingKey } from "./week-task-hierarchy.ts";

export type InventoryTask = {
  id: string;
  title: string;
  status: string;
  dueAt?: string | null;
  repeatSeriesId?: string | null;
  projectType?: "STANDARD" | "HABIT" | null;
  projectId: string | null;
};

function isDone(status: string) {
  return status === "done" || status === "DONE";
}

function dueEpoch(task: InventoryTask): number {
  if (!task.dueAt) return Number.MAX_SAFE_INTEGER;
  const time = new Date(task.dueAt).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

/** Pick the next open instance for a repeat bucket; otherwise earliest due. */
export function pickInventoryRepresentative(
  bucket: InventoryTask[],
  nowMs = Date.now(),
): InventoryTask {
  if (bucket.length === 0) throw new Error("pickInventoryRepresentative: empty bucket");
  if (bucket.length === 1) return bucket[0]!;
  const open = bucket.filter((task) => !isDone(task.status));
  const pool = open.length > 0 ? open : bucket;
  const todayStart = new Date(nowMs);
  todayStart.setHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();
  const upcoming = pool.filter((task) => dueEpoch(task) >= todayMs);
  const sorted = [...(upcoming.length > 0 ? upcoming : pool)].sort(
    (left, right) => dueEpoch(left) - dueEpoch(right),
  );
  return sorted[0]!;
}

/**
 * All-view inventory: one row per repeat series / habit lineage.
 * Open series → next instance; done-only series kept when showCompleted.
 */
export function collapseForAllView<T extends InventoryTask>(
  tasks: T[],
  opts?: { showCompleted?: boolean; nowMs?: number },
): T[] {
  const showCompleted = opts?.showCompleted ?? true;
  const buckets = new Map<string, T[]>();
  for (const task of tasks) {
    const key = routineGroupingKey(task);
    const bucket = buckets.get(key) ?? [];
    bucket.push(task);
    buckets.set(key, bucket);
  }

  const out: T[] = [];
  for (const bucket of buckets.values()) {
    const open = bucket.filter((task) => !isDone(task.status));
    if (open.length > 0) {
      out.push(pickInventoryRepresentative(open, opts?.nowMs) as T);
      continue;
    }
    if (showCompleted) {
      out.push(pickInventoryRepresentative(bucket, opts?.nowMs) as T);
    }
  }
  return out;
}

/** Sidebar badge: unique open commitments with zero calendar sessions (series-aware). */
export function countUnscheduledTaskBadge(
  tasks: InventoryTask[],
  blocks: Array<{ type?: string; taskId?: string | null }>,
): number {
  const sessionTaskIds = new Set(
    blocks
      .filter((block) => block.type === "task" && block.taskId)
      .map((block) => block.taskId!),
  );

  const buckets = new Map<string, InventoryTask[]>();
  for (const task of tasks) {
    if (isDone(task.status)) continue;
    const key = routineGroupingKey(task);
    const bucket = buckets.get(key) ?? [];
    bucket.push(task);
    buckets.set(key, bucket);
  }

  let count = 0;
  for (const bucket of buckets.values()) {
    const anySession = bucket.some((task) => sessionTaskIds.has(task.id));
    if (!anySession) count += 1;
  }
  return count;
}
