/**
 * Daily Focus is Session-scoped.
 * Local planning day = Asia/Ho_Chi_Minh YYYY-MM-DD from Session start.
 */

const PRODUCT_OFFSET_MS = 7 * 60 * 60 * 1000;

export function productDateFromEpoch(epochMs: number): string {
  const shifted = new Date(epochMs + PRODUCT_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function productDateString(now = Date.now()): string {
  return productDateFromEpoch(now);
}

/** @deprecated Prefer Session isDailyFocus. */
export function isDailyFocusForDate(
  task: { dailyFocusDate?: string | null },
  date: string,
): boolean {
  return Boolean(task.dailyFocusDate && task.dailyFocusDate === date);
}

export function isSessionDailyFocusOnDate(
  session: { isDailyFocus?: boolean | null; startAt?: string | null; startEpochMs?: number },
  date: string,
): boolean {
  if (!session.isDailyFocus) return false;
  const epoch = session.startEpochMs
    ?? (session.startAt ? new Date(session.startAt).getTime() : NaN);
  if (!Number.isFinite(epoch)) return false;
  return productDateFromEpoch(epoch) === date;
}

export function findDailyFocusSession<
  T extends { id: string; isDailyFocus?: boolean | null; startAt?: string | null; startEpochMs?: number },
>(sessions: T[], date: string): T | null {
  return sessions.find((session) => isSessionDailyFocusOnDate(session, date)) ?? null;
}

/** @deprecated Prefer findDailyFocusSession. */
export function findDailyFocusTask<T extends { id: string; dailyFocusDate?: string | null }>(
  tasks: T[],
  date: string,
): T | null {
  return tasks.find((task) => isDailyFocusForDate(task, date)) ?? null;
}

export function resolveSessionDailyFocusReplacement(input: {
  existingFocusSessionId: string | null;
  nextSessionId: string;
}): { clearSessionId: string | null; focusSessionId: string; needsConfirm: boolean } {
  if (!input.existingFocusSessionId || input.existingFocusSessionId === input.nextSessionId) {
    return { clearSessionId: null, focusSessionId: input.nextSessionId, needsConfirm: false };
  }
  return {
    clearSessionId: input.existingFocusSessionId,
    focusSessionId: input.nextSessionId,
    needsConfirm: true,
  };
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

export function resolveFocusOnSessionMove(input: {
  wasDailyFocus: boolean;
  sourceDate: string;
  destDate: string;
  destExistingFocusSessionId: string | null;
  movingSessionId: string;
}):
  | { action: "KEEP" }
  | { action: "KEEP_ON_EMPTY_DAY" }
  | { action: "CONFLICT"; existingFocusSessionId: string }
  | { action: "NONE" } {
  if (!input.wasDailyFocus) return { action: "NONE" };
  if (input.sourceDate === input.destDate) return { action: "KEEP" };
  if (
    !input.destExistingFocusSessionId
    || input.destExistingFocusSessionId === input.movingSessionId
  ) {
    return { action: "KEEP_ON_EMPTY_DAY" };
  }
  return {
    action: "CONFLICT",
    existingFocusSessionId: input.destExistingFocusSessionId,
  };
}

/** Day review verdict — Daily Focus Session completion matters more than supporting count. */
export function dailyFocusDayVerdict(input: {
  focusDone: boolean;
  supportingDone: number;
  supportingTotal: number;
}): "FOCUS_HIT" | "FOCUS_MISSED" | "NO_FOCUS" {
  if (input.focusDone) return "FOCUS_HIT";
  return "FOCUS_MISSED";
}
