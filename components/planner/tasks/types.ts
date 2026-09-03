export type TaskPriority = "p1" | "p2" | "p3" | "p4";
export type TaskStatus = "inbox" | "scheduled" | "done";
export type HorizonScope = "day" | "week" | "month" | "all";
export type TaskHorizon = "day" | "week" | "month" | null;

export type TasksViewTask = {
  id: string;
  title: string;
  notes: string;
  projectId: string | null;
  project: string;
  color: string;
  duration: number; // minutes
  priority: TaskPriority;
  status: TaskStatus;
  dueAt: string | null;
  due?: string;
  dueHorizon?: TaskHorizon;
  goalId?: string | null;
  goalProcessId?: string | null;
};

export type TasksViewBlock = {
  id: string;
  taskId?: string;
  startAt?: string;
  start?: number;
  duration: number;
  day?: number;
  syncStatus?: "PENDING" | "SYNCED" | "FAILED";
};

export type TasksProjectOption = {
  id: string | null;
  title: string;
  color: string;
  goalId?: string | null;
  defaultGoalProcessId?: string | null;
};

export type TasksGoalOption = {
  id: string;
  title: string;
  outcome?: string | null;
  status: string;
  processes: Array<{ id: string; name: string; active: boolean }>;
};

export const PRIORITY_META: Record<
  TaskPriority,
  { id: TaskPriority; label: string; hint: string; color: string }
> = {
  p1: { id: "p1", label: "Do now", hint: "Urgent · important", color: "#B33A22" },
  p2: { id: "p2", label: "Important", hint: "Worth protecting time for", color: "#2F86C7" },
  p3: { id: "p3", label: "Delegate", hint: "Urgent", color: "#3E8F3A" },
  p4: { id: "p4", label: "Drop", hint: "Neither", color: "#C99212" },
};

export function priorityMeta(priority: TaskPriority) {
  return PRIORITY_META[priority] ?? PRIORITY_META.p2;
}

export function formatTaskDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
