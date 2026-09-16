import { productDateFromEpoch } from "./daily-focus.ts";
import {
  resetSessionOutcomeForPaste,
  type SessionOutcome,
} from "./session-outcome.ts";

/** Timed occupancy on a week grid (day 0–6, minutes from midnight). */
export type WeekSlot = {
  day: number;
  start: number;
  duration: number;
};

export type WeekClipboardSession = WeekSlot & {
  taskId: string;
  title: string;
  notes: string;
  projectId: string | null;
  color: string;
  /** Source series, if any — used to rematch habit instances on the target week. */
  repeatSeriesId?: string | null;
  isDailyFocus?: boolean;
  /** Outcome template — actual / checklist progress reset on paste. */
  sessionOutcome?: SessionOutcome | null;
};

export type WeekScheduleClipboard = {
  sourceWeekStartMs: number;
  label: string;
  sessions: WeekClipboardSession[];
};

export type WeekPasteTask = {
  id: string;
  title: string;
  status: string;
  projectId: string | null;
  color?: string;
  dueAt?: string | null;
  repeatSeriesId?: string | null;
  projectType?: "STANDARD" | "HABIT" | null;
};

export type WeekPasteBlock = WeekSlot & {
  id: string;
  type: "task" | "external";
  allDay?: boolean;
  taskId?: string;
};

export type WeekPastePlanItem = WeekClipboardSession & {
  resolvedTaskId: string;
  reason?: undefined;
};

export type WeekPasteSkip = WeekClipboardSession & {
  reason: "conflict" | "missing-task";
  resolvedTaskId?: string;
};

export type WeekPastePlan = {
  create: WeekPastePlanItem[];
  skippedConflict: WeekPasteSkip[];
  skippedMissingTask: WeekPasteSkip[];
};

/** True when intervals share any minute (touching endpoints do not conflict). */
export function weekSlotsOverlap(left: WeekSlot, right: WeekSlot): boolean {
  if (left.day !== right.day) return false;
  if (left.duration <= 0 || right.duration <= 0) return false;
  const leftEnd = left.start + left.duration;
  const rightEnd = right.start + right.duration;
  return left.start < rightEnd && right.start < leftEnd;
}

/**
 * Occupied slots on the paste target: Personal OS sessions + timed Google events.
 * All-day externals are ignored (they are not timed grid blocks).
 */
export function occupiedSlotsForWeekPaste(blocks: WeekPasteBlock[]): WeekSlot[] {
  const out: WeekSlot[] = [];
  for (const block of blocks) {
    if (block.day < 0 || block.day > 6) continue;
    if (block.type === "external" && block.allDay) continue;
    if (block.duration <= 0) continue;
    // Pending optimistic rows still occupy time.
    out.push({ day: block.day, start: block.start, duration: block.duration });
  }
  return out;
}

export function slotConflictsWithOccupied(
  candidate: WeekSlot,
  occupied: WeekSlot[],
): boolean {
  return occupied.some((slot) => weekSlotsOverlap(candidate, slot));
}

function isDone(status: string) {
  return status === "done" || status === "DONE";
}

function dueProductDate(task: WeekPasteTask): string | null {
  if (!task.dueAt) return null;
  const time = new Date(task.dueAt).getTime();
  if (!Number.isFinite(time)) return null;
  return productDateFromEpoch(time);
}

/**
 * Map a copied session onto a live Task for the destination day.
 * - Finite tasks: same id, even if done (paste can reopen it).
 * - Habit series: prefer target-day instance; if that one is done, still use it so paste can reopen it.
 */
export function resolveTaskIdForWeekPaste(
  session: Pick<WeekClipboardSession, "taskId" | "repeatSeriesId">,
  targetDayDate: Date,
  tasks: WeekPasteTask[],
): string | null {
  const source = tasks.find((task) => task.id === session.taskId);
  const seriesId = session.repeatSeriesId ?? source?.repeatSeriesId ?? null;
  const targetKey = productDateFromEpoch(targetDayDate.getTime());

  if (seriesId) {
    const dueMatch = tasks.find(
      (task) =>
        task.repeatSeriesId === seriesId
        && dueProductDate(task) === targetKey,
    );
    if (dueMatch) return dueMatch.id;

    const openSeries = tasks.find(
      (task) => task.repeatSeriesId === seriesId && !isDone(task.status),
    );
    if (openSeries) return openSeries.id;
    const anySeries = tasks.find((task) => task.repeatSeriesId === seriesId);
    if (anySeries) return anySeries.id;
    return null;
  }

  return source?.id ?? null;
}

export function buildWeekScheduleClipboard(input: {
  weekStart: Date;
  label: string;
  blocks: Array<WeekPasteBlock & {
    taskId?: string;
    title?: string;
    notes?: string | null;
    projectId?: string | null;
    color?: string;
    repeatSeriesId?: string | null;
    isDailyFocus?: boolean;
    sessionOutcome?: SessionOutcome | null;
  }>;
  tasks: WeekPasteTask[];
}): WeekScheduleClipboard {
  const sessions: WeekClipboardSession[] = [];
  for (const block of input.blocks) {
    if (block.type !== "task") continue;
    if (!block.taskId) continue;
    if (block.id.startsWith("pending-")) continue;
    if (block.day < 0 || block.day > 6) continue;
    if (block.duration <= 0) continue;
    const task = input.tasks.find((item) => item.id === block.taskId);
    sessions.push({
      day: block.day,
      start: block.start,
      duration: block.duration,
      taskId: block.taskId,
      title: (block.title ?? task?.title ?? "Session").trim() || "Session",
      notes: block.notes?.trim() ?? "",
      projectId: block.projectId ?? task?.projectId ?? null,
      color: block.color ?? task?.color ?? "#3478F6",
      repeatSeriesId: block.repeatSeriesId ?? task?.repeatSeriesId ?? null,
      isDailyFocus: Boolean(block.isDailyFocus),
      sessionOutcome: block.sessionOutcome ?? null,
    });
  }

  sessions.sort((a, b) => a.day - b.day || a.start - b.start || a.taskId.localeCompare(b.taskId));

  return {
    sourceWeekStartMs: input.weekStart.getTime(),
    label: input.label,
    sessions,
  };
}

/**
 * Plan paste: keep every existing target slot; only accept copies that land in free time.
 * Accepted copies also reserve time so later copies cannot stack on each other incorrectly.
 */
export function planWeekSchedulePaste(input: {
  clipboard: WeekScheduleClipboard;
  targetWeekStart: Date;
  existingBlocks: WeekPasteBlock[];
  tasks: WeekPasteTask[];
  /** Build absolute Date for (weekStart, day, minutes). */
  slotDate: (weekStart: Date, day: number, minutes: number) => Date;
}): WeekPastePlan {
  const occupied = occupiedSlotsForWeekPaste(input.existingBlocks);
  const create: WeekPastePlanItem[] = [];
  const skippedConflict: WeekPasteSkip[] = [];
  const skippedMissingTask: WeekPasteSkip[] = [];

  for (const session of input.clipboard.sessions) {
    const targetDayDate = input.slotDate(input.targetWeekStart, session.day, session.start);
    const resolvedTaskId = resolveTaskIdForWeekPaste(session, targetDayDate, input.tasks);
    if (!resolvedTaskId) {
      skippedMissingTask.push({ ...session, reason: "missing-task" });
      continue;
    }

    const candidate: WeekSlot = {
      day: session.day,
      start: session.start,
      duration: session.duration,
    };
    if (slotConflictsWithOccupied(candidate, occupied)) {
      skippedConflict.push({ ...session, reason: "conflict", resolvedTaskId });
      continue;
    }

    occupied.push(candidate);
    create.push({ ...session, resolvedTaskId });
  }

  return { create, skippedConflict, skippedMissingTask };
}

/** Outcome payload for createTimeBlock — structure only, no prior-week progress. */
export function sessionOutcomeForWeekPaste(
  session: Pick<WeekClipboardSession, "sessionOutcome">,
): SessionOutcome | null {
  return resetSessionOutcomeForPaste(session.sessionOutcome);
}

export function formatWeekPasteToast(plan: WeekPastePlan): {
  message: string;
  kind: "info" | "warning";
} {
  const created = plan.create.length;
  const conflicts = plan.skippedConflict.length;
  const missing = plan.skippedMissingTask.length;
  const skipped = conflicts + missing;

  if (created === 0 && skipped === 0) {
    return { message: "Week clipboard is empty", kind: "warning" };
  }
  if (created === 0) {
    const bits = [
      conflicts > 0 ? `${conflicts} busy` : null,
      missing > 0 ? `${missing} missing task` : null,
    ].filter(Boolean);
    return {
      message: `Nothing pasted · kept target week (${bits.join(" · ")})`,
      kind: "warning",
    };
  }
  if (skipped === 0) {
    return {
      message: `Pasted ${created} session${created === 1 ? "" : "s"} into free time`,
      kind: "info",
    };
  }
  return {
    message: `Pasted ${created} · skipped ${skipped} (target week kept where busy/missing)`,
    kind: "warning",
  };
}
