import { inProductWeek, startOfProductWeek } from "./product-week.ts";

export type GoalStripTask = {
  id: string;
  title: string;
  status: string;
  projectId?: string | null;
  dueHorizon?: string | null;
  dueAt?: string | null;
};

export type GoalStripBlock = {
  id: string;
  type: string;
  taskId?: string | null;
  startAt?: string | null;
  duration: number;
  title?: string;
  color?: string;
};

export type GoalCalendarStripDay = {
  key: string;
  short: string;
  date: number;
  isToday: boolean;
  blocks: Array<{
    id: string;
    label: string;
    duration: string;
    color: string;
    external?: boolean;
  }>;
};

const DEFAULT_BLOCK_COLOR = "#059669";

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value.length <= 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function blockForTask(taskId: string, blocks: GoalStripBlock[]) {
  return blocks.find((block) => block.taskId === taskId && block.type === "task");
}

/**
 * Goal Detail calendar strip: only Personal OS Sessions linked to this Goal.
 * Unrelated Google Calendar commitments are omitted (availability belongs on main Calendar).
 */
export function buildGoalCalendarStrip(
  goalTasks: GoalStripTask[],
  blocks: GoalStripBlock[],
  now: Date,
): {
  days: GoalCalendarStripDay[];
  protectedMinutes: number;
  unscheduledCount: number;
  hasGoalSessions: boolean;
} {
  const weekStart = startOfProductWeek(now);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const goalTaskIds = new Set(goalTasks.map((t) => t.id));

  let protectedMinutes = 0;
  let sessionCount = 0;
  const days: GoalCalendarStripDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart.getTime() + index * 86_400_000);
    const next = new Date(date.getTime() + 86_400_000);
    const dayBlocks = blocks.filter((block) => {
      if (!block.startAt) return false;
      const at = new Date(block.startAt).getTime();
      if (at < date.getTime() || at >= next.getTime()) return false;
      // Goal execution only — never treat unrelated Google events as this Goal's work.
      if (block.type === "external") return false;
      return Boolean(block.taskId && goalTaskIds.has(block.taskId));
    });

    sessionCount += dayBlocks.length;
    for (const block of dayBlocks) {
      if (block.type === "task") protectedMinutes += block.duration;
    }

    const isToday = date.toDateString() === today.toDateString();
    return {
      key: date.toISOString(),
      short: date.toLocaleDateString("en-US", { weekday: "short" }),
      date: date.getDate(),
      isToday,
      blocks: dayBlocks.slice(0, 3).map((block) => {
        const task = block.taskId ? goalTasks.find((t) => t.id === block.taskId) : null;
        const hours = Math.round((block.duration / 60) * 10) / 10;
        return {
          id: block.id,
          label: block.title ?? task?.title ?? "Block",
          duration: `${hours}h`,
          color: block.color ?? DEFAULT_BLOCK_COLOR,
          external: false,
        };
      }),
    };
  });

  const unscheduledCount = goalTasks.filter((task) => {
    if (task.status === "done") return false;
    const inWeek = task.dueHorizon === "week"
      || (task.dueAt && inProductWeek(parseDate(task.dueAt)!, now));
    if (!inWeek) return false;
    return !blockForTask(task.id, blocks);
  }).length;

  return {
    days,
    protectedMinutes,
    unscheduledCount,
    hasGoalSessions: sessionCount > 0,
  };
}
