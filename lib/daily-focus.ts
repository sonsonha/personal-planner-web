import { PRODUCT_TZ_OFFSET_MS } from "./product-week.ts";

/** Product planning day as YYYY-MM-DD in Asia/Ho_Chi_Minh. */
export function productDateString(value: Date = new Date()): string {
  const shifted = new Date(value.getTime() + PRODUCT_TZ_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isDailyFocusForDate(
  task: { dailyFocusDate?: string | null },
  date: string,
): boolean {
  return Boolean(task.dailyFocusDate && task.dailyFocusDate === date);
}

export function findDailyFocusTask<T extends { id: string; dailyFocusDate?: string | null }>(
  tasks: T[],
  date: string,
): T | null {
  return tasks.find((task) => isDailyFocusForDate(task, date)) ?? null;
}

export function resolveDailyFocusReplacement(input: {
  existingFocusTaskId: string | null;
  nextTaskId: string;
}): { clearTaskId: string | null; focusTaskId: string; needsConfirm: boolean } {
  if (!input.existingFocusTaskId || input.existingFocusTaskId === input.nextTaskId) {
    return { clearTaskId: null, focusTaskId: input.nextTaskId, needsConfirm: false };
  }
  return {
    clearTaskId: input.existingFocusTaskId,
    focusTaskId: input.nextTaskId,
    needsConfirm: true,
  };
}

/** Day review verdict — Daily Focus matters more than supporting count. */
export function dailyFocusDayVerdict(input: {
  focusDone: boolean | null;
  supportingDone: number;
  supportingTotal: number;
}): "core-achieved" | "core-missed" | "no-focus" {
  if (input.focusDone == null) return "no-focus";
  if (input.focusDone) return "core-achieved";
  return "core-missed";
}
