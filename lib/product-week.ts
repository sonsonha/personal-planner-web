/** Product day/week boundaries use Asia/Ho_Chi_Minh (UTC+7, no DST). */
export const PRODUCT_TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

export type ProductWeekTask = {
  id: string;
  title?: string;
  projectId: string | null;
  status: string;
  dueHorizon?: string | null;
  dueAt?: string | null;
  completedAt?: string | null;
};

function zonedUtcParts(value: Date) {
  const shifted = new Date(value.getTime() + PRODUCT_TZ_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  };
}

export function startOfProductWeek(value: Date) {
  const parts = zonedUtcParts(value);
  const diff = parts.weekday === 0 ? -6 : 1 - parts.weekday;
  return new Date(Date.UTC(parts.year, parts.month, parts.day + diff) - PRODUCT_TZ_OFFSET_MS);
}

export function inProductWeek(date: Date, now: Date) {
  const start = startOfProductWeek(now);
  const end = new Date(start.getTime() + 7 * 86_400_000);
  const time = date.getTime();
  return time >= start.getTime() && time < end.getTime();
}

export function parseProductInstant(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value.length <= 10 ? `${value}T00:00:00+07:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isDone(status: string) {
  return status === "done" || status === "DONE";
}

function dueHorizonOf(task: ProductWeekTask) {
  return (task.dueHorizon ?? "").toLowerCase();
}

export function weekOpenForProject(projectId: string, tasks: ProductWeekTask[], now: Date) {
  return tasks.filter((task) => {
    if (task.projectId !== projectId || isDone(task.status)) return false;
    const due = parseProductInstant(task.dueAt);
    return Boolean(due && inProductWeek(due, now));
  });
}

export function weekCompletedForProject(projectId: string, tasks: ProductWeekTask[], now: Date) {
  return tasks.filter((task) => {
    if (task.projectId !== projectId || !isDone(task.status)) return false;
    const completed = parseProductInstant(task.completedAt);
    return Boolean(completed && inProductWeek(completed, now));
  });
}

export function projectWeekSummary(projectId: string, tasks: ProductWeekTask[], now: Date) {
  const projectTasks = tasks.filter((task) => task.projectId === projectId);
  const weekOpen = weekOpenForProject(projectId, tasks, now);
  const weekDone = weekCompletedForProject(projectId, tasks, now);
  const lifetimeDone = projectTasks.filter((task) => isDone(task.status)).length;
  return {
    weekOpen,
    weekDone,
    weekTotal: weekOpen.length + weekDone.length,
    lifetimeDone,
    lifetimeTotal: projectTasks.length,
  };
}

export function thisWeekLabel(weekDone: number, weekOpen: number) {
  if (weekDone + weekOpen === 0) return "No work planned";
  return `${weekDone} / ${weekDone + weekOpen} completed`;
}

/** Overdue only for DAY-horizon work. WEEK Monday markers are not overdue. */
export function isDayOverdue(
  task: { dueHorizon?: string | null; dueAt?: string | null; status?: string },
  today: Date,
) {
  if (task.status && isDone(task.status)) return false;
  if (dueHorizonOf(task as ProductWeekTask) !== "day") return false;
  const due = parseProductInstant(task.dueAt);
  return Boolean(due && due.getTime() < today.getTime());
}
