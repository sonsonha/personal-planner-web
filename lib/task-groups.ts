import type {
  HorizonScope,
  TaskHorizon,
  TasksViewBlock,
  TasksViewTask,
} from "../components/planner/tasks/types.ts";
import { findDailyFocusSession, isSessionDailyFocusOnDate } from "./daily-focus.ts";

export type TaskGroup = {
  id: string;
  label: string;
  tasks: TasksViewTask[];
};

function blockForTask(taskId: string, blocks: TasksViewBlock[]) {
  return blocks.find((block) => block.taskId === taskId);
}

/** Group Tasks for Day/Week/Month lists — one row per Task, never per TimeBlock. */
export function groupTasks(
  horizon: HorizonScope,
  tasks: TasksViewTask[],
  blocks: TasksViewBlock[],
  getHorizon: (task: TasksViewTask) => TaskHorizon,
  isOverdue: (task: TasksViewTask) => boolean,
  opts?: { focusDate?: string | null; emphasizeDailyFocus?: boolean },
): TaskGroup[] {
  const buckets: Record<string, TasksViewTask[]> = {};
  const ensure = (id: string) => {
    if (!buckets[id]) buckets[id] = [];
    return buckets[id]!;
  };

  const focusDate = opts?.emphasizeDailyFocus ? opts.focusDate ?? null : null;
  const focusSession = focusDate ? findDailyFocusSession(blocks, focusDate) : null;
  const focusTaskId = focusSession?.taskId ?? null;

  for (const task of tasks) {
    if (task.status === "done") {
      ensure("completed").push(task);
      continue;
    }
    if (isOverdue(task)) {
      ensure("overdue").push(task);
      continue;
    }

    const taskHorizon = getHorizon(task);
    const block = blockForTask(task.id, blocks);
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
      } else if (taskHorizon === "day") {
        ensure(focusDate ? "supporting" : "day-due").push(task);
      } else if (block) {
        ensure(focusDate ? "supporting" : "scheduled").push(task);
      } else {
        ensure(focusDate ? "supporting" : "scheduled").push(task);
      }
      continue;
    }

    if (horizon === "week") {
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
      } else if (taskHorizon === "day") {
        ensure("days").push(task);
      } else {
        ensure("month").push(task);
      }
      continue;
    }

    if (taskHorizon === "day") ensure("day").push(task);
    else if (taskHorizon === "week") ensure("week").push(task);
    else if (taskHorizon === "month") ensure("month").push(task);
    else ensure("someday").push(task);
  }

  const order: Array<{ id: string; label: string }> =
    horizon === "day"
      ? focusDate
        ? [
            { id: "overdue", label: "Overdue" },
            { id: "daily-focus", label: "Daily Focus" },
            { id: "supporting", label: "Supporting" },
            { id: "completed", label: "Completed" },
          ]
        : [
            { id: "overdue", label: "Overdue" },
            { id: "day-due", label: "Day due" },
            { id: "scheduled", label: "Scheduled" },
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
              { id: "days", label: "Specific days" },
              { id: "completed", label: "Completed" },
            ]
          : [
              { id: "overdue", label: "Overdue" },
              { id: "day", label: "Day" },
              { id: "week", label: "Week" },
              { id: "month", label: "Month" },
              { id: "someday", label: "Someday" },
              { id: "completed", label: "Completed" },
            ];

  return order
    .map((meta) => ({
      id: meta.id,
      label: meta.label,
      tasks: buckets[meta.id] ?? [],
    }))
    .filter((group) => {
      if (group.id === "daily-focus") return true;
      return group.tasks.length > 0;
    });
}
