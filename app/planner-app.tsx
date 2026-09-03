"use client";

import {
  Bell,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Command,
  Flag,
  FileText,
  GripVertical,
  ListTodo,
  LockKeyhole,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PlannerSidebar, type SidebarGoogleState } from "@/components/planner/PlannerSidebar";
import {
  GoogleCalendarConnection,
  calendarErrorCopy,
  type CalendarUiState,
} from "@/components/planner/GoogleCalendarConnection";
import { AiContextEditor } from "@/components/planner/AiContextEditor";
import { completeOnboarding } from "@/lib/auth-api";
import {
  QuickAddView,
  TaskEditorView,
  TasksWorkspaceView,
} from "@/components/planner/tasks";
import {
  GoogleEventPopover,
  PersonalOsBlockPopover,
  overlapGeometry,
  resolveOverlapLayout,
} from "@/components/planner/calendar";
import {
  carryOverSession,
  completeSession,
  createTask as createPlannerTask,
  createTimeBlock as createPlannerTimeBlock,
  deleteTask as deletePlannerTask,
  deleteTimeBlock,
  fetchGoogleIntegration,
  fetchPlanner,
  fetchTaskRepeatSummary,
  fetchTaskTimeBlocks,
  getGoogleAuthUrl,
  PlannerApiError,
  repeatSession,
  repeatTask,
  updateTask,
  updateTaskRepeat,
  updateTimeBlock,
  syncGoogleCalendar,
  disconnectGoogleCalendar,
  type ApiSeriesScope,
  type ApiTaskRepeatSummary,
  type CalendarSyncSummary,
  type ApiExternalEvent,
  type ApiGoal,
  type ApiProject,
  type ApiTask,
  type ApiTimeBlock,
} from "@/lib/planner-api";
import { SeriesScopeModal } from "@/components/planner/SeriesScopeModal";
import { DestructiveConfirmModal } from "@/components/planner/DestructiveConfirmModal";
import { CalendarQuickCreatePopover } from "@/components/planner/CalendarQuickCreatePopover";
import { EditRepeatModal } from "@/components/planner/EditRepeatModal";
import {
  deriveTaskProgressFromSessions,
  directTaskCompletePolicy,
  formatSessionProgressLabel,
  isSessionDone,
} from "@/lib/session-evidence";
import { startOfProductWeek } from "@/lib/product-week";
import { GoalsWorkspace, ProgressWorkspace, ProjectsWorkspace, type HorizonScope } from "./planner-workspaces";
import { parsePlannerPath, plannerPath, type PlannerSection } from "./planner-routes";
import { aggregateTaskSchedule, formatScheduledMinutes, remainingSessionsAfterRemove } from "@/lib/task-schedule";

type TaskStatus = "inbox" | "scheduled" | "done";
type TaskPriority = "p1" | "p2" | "p3" | "p4";

type PlannerTask = {
  id: string;
  title: string;
  notes: string;
  projectId: string | null;
  goalId?: string | null;
  goalProcessId?: string | null;
  project: string;
  color: string;
  duration: number;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt: string | null;
  due?: string;
  dueHorizon?: "day" | "week" | "month" | null;
  completedAt?: string | null;
  updatedAt?: string | null;
  repeatSeriesId?: string | null;
  carryOverFromTaskId?: string | null;
  carryOverNote?: string | null;
};

type CalendarBlock = {
  id: string;
  title: string;
  day: number;
  start: number;
  duration: number;
  color: string;
  type: "task" | "external";
  taskId?: string;
  projectId?: string | null;
  meta?: string;
  syncStatus?: "PENDING" | "SYNCED" | "FAILED";
  startAt?: string;
  allDay?: boolean;
  notes?: string | null;
  status?: "PLANNED" | "DONE" | string | null;
  completedAt?: string | null;
  repeatSeriesId?: string | null;
};

type BlockClipboard = {
  taskId: string;
  title: string;
  duration: number;
  notes: string;
};

type ProjectOption = {
  id: string | null;
  title: string;
  color: string;
  goalId?: string | null;
  defaultGoalProcessId?: string | null;
};
type ConnectionState = "loading" | "syncing" | "live" | "demo" | "error";
type GoogleConnectionState =
  | "loading"
  | "connected"
  | "not-connected"
  | "syncing"
  | "error"
  | "reconnect-required";
type ActiveSection = PlannerSection;
type CalendarView = "week" | "day" | "month";
type ToastKind = "info" | "warning";
type SlotPicker = { day: number; start: number; duration: number; anchor: DOMRect };

type DragPayload =
  | { kind: "task"; taskId: string }
  | { kind: "block"; blockId: string };

function calendarSyncMessage(summary: CalendarSyncSummary): string {
  if (summary.retry.failed > 0) {
    return `Calendar checked · ${summary.retry.failed} block${summary.retry.failed === 1 ? "" : "s"} still need attention`;
  }
  if (summary.ownedRemoved > 0) {
    return `Calendar synced · ${summary.ownedRemoved} deleted Google event${summary.ownedRemoved === 1 ? "" : "s"} removed`;
  }
  if (summary.ownedUpdated > 0) {
    return `Calendar synced · ${summary.ownedUpdated} Personal OS block${summary.ownedUpdated === 1 ? "" : "s"} updated`;
  }
  if (summary.upserted > 0 || summary.removed > 0) {
    return `Calendar synced · ${summary.upserted} Google event${summary.upserted === 1 ? "" : "s"} visible`;
  }
  return "Google Calendar is up to date";
}

const START_HOUR = 7;
const END_HOUR = 22;
const MINUTES_VISIBLE = (END_HOUR - START_HOUR) * 60;
/** Fine snap for Google Calendar–like precision (visual drag is continuous; time snaps). */
const SNAP_MINUTES = 5;
const DRAG_THRESHOLD_PX = 4;
const AUTO_SYNC_INTERVAL_MS = 5 * 60_000;
const AUTO_SYNC_MIN_GAP_MS = 30_000;
const AUTO_SYNC_ERROR_BACKOFF_MS = 5 * 60_000;
const COLORS = {
  violet: "#705CF6",
  blue: "#3478F6",
  coral: "#FA5D73",
  cyan: "#11B8C7",
  amber: "#F3A712",
};

const PRIORITY_LEVELS = [
  { id: "p1" as const, label: "Do now", hint: "Urgent · important", color: "#B33A22", api: "HIGH" as const },
  { id: "p2" as const, label: "Important", hint: "Worth protecting time for", color: "#2F86C7", api: "NORMAL" as const },
  { id: "p3" as const, label: "Delegate", hint: "Urgent", color: "#3E8F3A", api: "LOW" as const },
  { id: "p4" as const, label: "Drop", hint: "Neither", color: "#C99212", api: "DROP" as const },
];

function priorityFromApi(value: string): TaskPriority {
  const normalized = value.toUpperCase();
  if (normalized === "P1" || normalized === "HIGH") return "p1";
  if (normalized === "P3" || normalized === "LOW") return "p3";
  if (normalized === "P4" || normalized === "DROP") return "p4";
  return "p2";
}

function priorityToApi(value: TaskPriority) {
  return PRIORITY_LEVELS.find((level) => level.id === value)?.api ?? "NORMAL";
}

function priorityMeta(value: TaskPriority) {
  return PRIORITY_LEVELS.find((level) => level.id === value) ?? PRIORITY_LEVELS[1];
}

function priorityColor(value: TaskPriority) {
  return priorityMeta(value).color;
}

function priorityRank(value: TaskPriority) {
  return PRIORITY_LEVELS.findIndex((level) => level.id === value);
}

const initialProjects: ProjectOption[] = [
  { id: "demo-personal-os", title: "Personal OS", color: COLORS.violet },
  { id: "demo-rover", title: "Landfill Rover", color: COLORS.coral },
  { id: "demo-career", title: "Career capital", color: COLORS.cyan },
  { id: "demo-life", title: "Life admin", color: COLORS.amber },
  { id: null, title: "Inbox", color: COLORS.violet },
];

const initialTasks: PlannerTask[] = [
  {
    id: "task-roadmap",
    title: "Finalize product roadmap",
    notes: "Turn the current product direction into a focused first milestone.",
    projectId: "demo-personal-os",
    project: "Personal OS",
    color: COLORS.violet,
    duration: 60,
    priority: "p1",
    status: "inbox",
    dueAt: new Date().toISOString(),
    due: "Today",
  },
  {
    id: "task-networking",
    title: "Study TCP reliability",
    notes: "",
    projectId: null,
    project: "Systems depth",
    color: COLORS.blue,
    duration: 45,
    priority: "p2",
    status: "scheduled",
    dueAt: null,
    due: "This week",
  },
  {
    id: "task-demo",
    title: "Record Rover demo walkthrough",
    notes: "Capture a short walkthrough of the latest inference flow.",
    projectId: "demo-rover",
    project: "Landfill Rover",
    color: COLORS.coral,
    duration: 90,
    priority: "p1",
    status: "inbox",
    dueAt: null,
    due: "Friday",
  },
  {
    id: "task-english",
    title: "English interview practice",
    notes: "",
    projectId: "demo-career",
    project: "Career capital",
    color: COLORS.cyan,
    duration: 30,
    priority: "p3",
    status: "inbox",
    dueAt: null,
  },
  {
    id: "task-expenses",
    title: "Review monthly expenses",
    notes: "",
    projectId: "demo-life",
    project: "Life admin",
    color: COLORS.amber,
    duration: 30,
    priority: "p4",
    status: "inbox",
    dueAt: null,
  },
  {
    id: "task-done-review",
    title: "Weekly review notes",
    notes: "",
    projectId: "demo-personal-os",
    project: "Personal OS",
    color: COLORS.violet,
    duration: 45,
    priority: "p2",
    status: "done",
    dueAt: null,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "task-done-english",
    title: "English shadowing session",
    notes: "",
    projectId: "demo-career",
    project: "Career capital",
    color: COLORS.cyan,
    duration: 30,
    priority: "p3",
    status: "done",
    dueAt: null,
    updatedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  },
];

const initialBlocks: CalendarBlock[] = [
  {
    id: "ext-standup",
    title: "Team stand-up",
    day: 0,
    start: 9 * 60,
    duration: 45,
    color: "#94A3B8",
    type: "external",
    meta: "Google Calendar",
  },
  {
    id: "block-networking",
    title: "Study TCP reliability",
    day: 0,
    start: 19 * 60,
    duration: 45,
    color: COLORS.blue,
    type: "task",
    taskId: "task-networking",
    meta: "Systems depth",
  },
  {
    id: "ext-design-review",
    title: "Design review",
    day: 1,
    start: 14 * 60,
    duration: 60,
    color: "#94A3B8",
    type: "external",
    meta: "Google Calendar",
  },
  {
    id: "block-rover",
    title: "Rover · inference profiling",
    day: 2,
    start: 19 * 60,
    duration: 90,
    color: COLORS.coral,
    type: "task",
    meta: "Landfill Rover",
  },
  {
    id: "ext-mentoring",
    title: "Mentoring call",
    day: 3,
    start: 20 * 60,
    duration: 60,
    color: "#94A3B8",
    type: "external",
    meta: "Google Calendar",
  },
  {
    id: "block-weekly-review",
    title: "Weekly review",
    day: 6,
    start: 18 * 60,
    duration: 45,
    color: COLORS.violet,
    type: "task",
    meta: "Personal OS",
  },
];

function startOfWeek(value: Date) {
  const date = new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, amount: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const twelve = hours % 12 || 12;
  return `${twelve}:${String(mins).padStart(2, "0")} ${suffix}`;
}

function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function slotDate(weekStart: Date, day: number, minutes: number) {
  const date = addDays(weekStart, day);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

function dayIndexFor(dateValue: string, weekStart: Date) {
  const date = new Date(dateValue);
  const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const localWeek = new Date(
    weekStart.getFullYear(),
    weekStart.getMonth(),
    weekStart.getDate(),
  );
  return Math.round((localDate.getTime() - localWeek.getTime()) / 86_400_000);
}

function dueHorizonFromApi(value?: string | null, dueAt?: string | null): "day" | "week" | "month" | null {
  if (value === "WEEK") return "week";
  if (value === "MONTH") return "month";
  if (value === "DAY") return "day";
  if (!dueAt) return null;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return null;
  const onTheHour = due.getMinutes() === 0;
  const midnightOrNoon = due.getHours() === 0 || due.getHours() === 12;
  if (onTheHour && midnightOrNoon && due.getDate() === 1) return "month";
  if (onTheHour && midnightOrNoon && due.getTime() === startOfWeek(due).getTime()) return "week";
  if (onTheHour && due.getHours() === 12 && due.getDay() === 1) return "week";
  return "day";
}

function dueHorizonToApi(value: "day" | "week" | "month" | null | undefined) {
  if (value === "week") return "WEEK" as const;
  if (value === "month") return "MONTH" as const;
  if (value === "day") return "DAY" as const;
  return null;
}

function duePeriodForDate(date: Date, horizon: "day" | "week" | "month") {
  if (horizon === "day") {
    const end = startOfDay(date);
    end.setHours(23, 59, 0, 0);
    return { dueAt: end.toISOString(), dueHorizon: "day" as const };
  }
  if (horizon === "week") {
    const start = startOfWeek(date);
    start.setHours(12, 0, 0, 0);
    return { dueAt: start.toISOString(), dueHorizon: "week" as const };
  }
  const start = startOfMonth(date);
  start.setHours(12, 0, 0, 0);
  return { dueAt: start.toISOString(), dueHorizon: "month" as const };
}

function duePeriodForScope(scope: HorizonScope | null, now: Date) {
  if (!scope || scope === "all") {
    return { dueAt: null as string | null, dueHorizon: null as "day" | "week" | "month" | null };
  }
  return duePeriodForDate(now, scope);
}

function captureHint(scope: HorizonScope | null, anchor: Date = new Date()) {
  if (scope === "day") {
    return sameDay(anchor, new Date())
      ? "Saved to today · no calendar time yet"
      : `Saved to ${anchor.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · no calendar time yet`;
  }
  if (scope === "week") {
    const start = startOfWeek(anchor);
    const current = start.getTime() === startOfWeek(new Date()).getTime();
    return current
      ? "Saved to this week · pick a day later if you want"
      : `Saved to week of ${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · pick a day later if you want`;
  }
  if (scope === "month") {
    const current = startOfMonth(anchor).getTime() === startOfMonth(new Date()).getTime();
    return current
      ? "Saved to this month · no calendar time yet"
      : `Saved to ${anchor.toLocaleDateString("en-US", { month: "long" })} · no calendar time yet`;
  }
  return "Saved to Inbox · drag it into your calendar next";
}

function horizonLabel(value: string | null, horizon?: "day" | "week" | "month" | null) {
  if (horizon === "week") {
    if (!value) return "This week";
    const start = startOfWeek(new Date(value));
    if (start.getTime() === startOfWeek(new Date()).getTime()) return "This week";
    return `Week of ${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
  if (horizon === "month") {
    if (!value) return "This month";
    return new Date(value).toLocaleDateString("en-US", { month: "long" });
  }
  return undefined;
}

function dueLabel(value: string | null, horizon?: "day" | "week" | "month" | null) {
  if (!value || horizon === "week" || horizon === "month") return undefined;
  const due = new Date(value);
  const today = new Date();
  if (due.toDateString() === today.toDateString()) return "Today";
  return due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function dateInputValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localDateInput(date: Date) {
  return dateInputValue(date.toISOString());
}

function monthInputValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseLocalDateInput(value: string) {
  return startOfDay(new Date(`${value}T12:00:00`));
}

function parseMonthInput(value: string) {
  const [year, month] = value.split("-").map(Number);
  return startOfDay(new Date(year, (month || 1) - 1, 1));
}

function timeInputValue(value: string) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function scheduleStart(dateValue: string, timeValue: string) {
  return new Date(`${dateValue}T${timeValue}:00`);
}

function defaultScheduleStart() {
  const date = new Date();
  date.setMinutes(date.getMinutes() < 30 ? 30 : 60, 0, 0);
  if (date.getHours() >= END_HOUR) {
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
  }
  return date;
}

function scheduleLabel(block?: CalendarBlock) {
  if (!block) return "Scheduled";
  return `${minutesToTime(block.start)} · ${block.duration < 60 ? `${block.duration}m` : durationLabel(block.duration)}`;
}

function projectOptions(projects: ApiProject[]): ProjectOption[] {
  return [
    ...projects
      .filter((project) => project.active)
      .map((project) => ({
        id: project.id,
        title: project.title,
        color: project.color,
        goalId: project.goalId,
        defaultGoalProcessId: project.defaultGoalProcessId ?? null,
      })),
    { id: null, title: "Inbox", color: COLORS.violet },
  ];
}

function taskFromApi(task: ApiTask, projects: ProjectOption[]): PlannerTask {
  const project = projects.find((item) => item.id === task.projectId) ?? projects.at(-1)!;
  return {
    id: task.id,
    title: task.title,
    notes: task.notes,
    projectId: task.projectId,
    goalId: task.goalId ?? project.goalId ?? null,
    goalProcessId: task.goalProcessId ?? null,
    project: project.title,
    color: project.color,
    duration: task.durationMinutes,
    priority: priorityFromApi(task.priority),
    status: task.status.toLowerCase() as TaskStatus,
    dueAt: task.dueAt,
    dueHorizon: dueHorizonFromApi(task.dueHorizon, task.dueAt),
    due: dueLabel(task.dueAt, dueHorizonFromApi(task.dueHorizon, task.dueAt)),
    completedAt: task.completedAt ?? null,
    updatedAt: task.updatedAt ?? null,
    repeatSeriesId: task.repeatSeriesId ?? null,
    carryOverFromTaskId: task.carryOverFromTaskId ?? null,
    carryOverNote: task.carryOverNote ?? null,
  };
}

function timeBlockFromApi(
  block: ApiTimeBlock,
  weekStart: Date,
  projects: ProjectOption[],
): CalendarBlock {
  const start = new Date(block.startAt);
  const end = new Date(block.endAt);
  const project = projects.find((item) => item.id === block.projectId);
  return {
    id: block.id,
    title: block.title,
    day: dayIndexFor(block.startAt, weekStart),
    start: start.getHours() * 60 + start.getMinutes(),
    duration: Math.max(15, Math.round((end.getTime() - start.getTime()) / 60_000)),
    color: block.color,
    type: "task",
    taskId: block.taskId ?? undefined,
    projectId: block.projectId,
    meta: project?.title ?? "Personal Planner",
    syncStatus: block.syncStatus,
    startAt: block.startAt,
    notes: block.notes ?? "",
    status: block.status ?? "PLANNED",
    completedAt: block.completedAt ?? null,
    repeatSeriesId: block.repeatSeriesId ?? null,
  };
}

function startOfMonth(value: Date) {
  const date = new Date(value);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysInMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();
}

function monthGridDays(anchor: Date) {
  const first = startOfMonth(anchor);
  const mondayOffset = first.getDay() === 0 ? -6 : 1 - first.getDay();
  const start = addDays(first, mondayOffset);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function horizonWindow(scope: HorizonScope, now: Date): { start: Date; end: Date } | null {
  if (scope === "all") return null;
  if (scope === "day") {
    const start = startOfDay(now);
    return { start, end: addDays(start, 1) };
  }
  if (scope === "week") {
    const start = startOfWeek(now);
    return { start, end: addDays(start, 7) };
  }
  const start = startOfMonth(now);
  return { start, end: addDays(start, daysInMonth(now)) };
}

function dateInHorizon(date: Date, scope: HorizonScope, now: Date) {
  const window = horizonWindow(scope, now);
  if (!window) return true;
  const time = date.getTime();
  return time >= window.start.getTime() && time < window.end.getTime();
}

function taskDueHorizon(task: PlannerTask): "day" | "week" | "month" | null {
  if (task.dueHorizon) return task.dueHorizon;
  return dueHorizonFromApi(null, task.dueAt);
}

function taskBelongsToHorizon(
  task: PlannerTask,
  horizon: HorizonScope,
  anchor: Date,
  blocks: CalendarBlock[],
  weekStart: Date,
  today: Date,
) {
  if (horizon === "all") return true;
  const hasBlockHere = blocks.some((block) =>
    block.type === "task"
    && block.taskId === task.id
    && dateInHorizon(blockInstant(block, weekStart), horizon, anchor),
  );
  // Only Day may surface execution scheduled for that day. Week/Month are
  // commitment views: TimeBlocks must not change a Task's planning horizon.
  if (horizon === "day" && hasBlockHere) return true;

  const due = parseDateValue(task.dueAt);
  const dueHorizon = taskDueHorizon(task);
  if (!due || !dueHorizon) return false;
  if (horizon === "day" && dueHorizon !== "day") return false;
  if (horizon === "week" && dueHorizon === "month") return false;
  if (dateInHorizon(due, horizon, anchor)) return true;
  if (task.status === "done") return false;

  const window = horizonWindow(horizon, anchor);
  if (!window || due.getTime() >= window.start.getTime()) return false;
  if (window.start.getTime() > startOfDay(today).getTime()) return false;
  if (horizon === "day") return dueHorizon === "day";
  if (horizon === "week") return dueHorizon === "day" || dueHorizon === "week";
  return true;
}

function parseDateValue(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value.length <= 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function blockInstant(block: CalendarBlock, weekStart: Date) {
  if (block.startAt) return new Date(block.startAt);
  return slotDate(weekStart, block.day, block.start);
}

function horizonCaption(scope: HorizonScope, now: Date) {
  if (scope === "day") {
    return now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  }
  if (scope === "week") {
    const start = startOfWeek(now);
    const end = addDays(start, 6);
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
  if (scope === "month") {
    return now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  return "Every horizon";
}

function blocksOverlap(left: CalendarBlock, right: CalendarBlock) {
  if (left.day !== right.day || left.type === "external" || right.type === "external") {
    return false;
  }
  const leftEnd = left.start + left.duration;
  const rightEnd = right.start + right.duration;
  return left.start < rightEnd && right.start < leftEnd;
}

function conflictingBlocks(
  candidate: CalendarBlock,
  allBlocks: CalendarBlock[],
  excludeId?: string,
) {
  return allBlocks.filter((block) =>
    block.type === "task"
    && block.id !== excludeId
    && block.id !== candidate.id
    && blocksOverlap(candidate, block),
  );
}

function slotMinutesFromClick(clientY: number, rect: DOMRect) {
  const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
  const minutesFromStart = Math.round((y / rect.height) * MINUTES_VISIBLE / SNAP_MINUTES) * SNAP_MINUTES;
  return Math.min(END_HOUR * 60 - SNAP_MINUTES, START_HOUR * 60 + minutesFromStart);
}

function externalBlockFromApi(event: ApiExternalEvent, weekStart: Date): CalendarBlock {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  const durationMinutes = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60_000));
  // All-day Google events are stored as local-midnight → next midnight (+07).
  const allDay = durationMinutes >= 20 * 60
    && start.getHours() === 0
    && start.getMinutes() === 0;
  return {
    id: `external-${event.id}`,
    title: event.title,
    day: dayIndexFor(event.startAt, weekStart),
    start: allDay ? 0 : start.getHours() * 60 + start.getMinutes(),
    duration: durationMinutes,
    color: "#94A3B8",
    type: "external",
    meta: event.location || "Google Calendar",
    startAt: event.startAt,
    allDay,
  };
}

function initials(displayName?: string) {
  if (!displayName) return "PO";
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function PlannerApp({
  viewer,
  onSignOut,
}: {
  viewer: { displayName: string; email: string; avatarUrl?: string | null } | null;
  onSignOut?: () => void | Promise<void>;
}) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { section: activeSection, entityId } = parsePlannerPath(pathname);
  const goTo = useCallback((section: ActiveSection, id?: string | null) => {
    const href = plannerPath(section, id);
    if (pathname === href) return;
    router.push(href);
  }, [pathname, router]);
  const [now] = useState(() => new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [view, setView] = useState<CalendarView>("week");
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()));
  const [activeDay, setActiveDay] = useState(() => {
    const day = new Date().getDay();
    return day === 0 ? 6 : day - 1;
  });
  const [tasks, setTasks] = useState(initialTasks);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [projects, setProjects] = useState<ProjectOption[]>(initialProjects);
  const [goals, setGoals] = useState<ApiGoal[]>([]);
  const [apiProjects, setApiProjects] = useState<ApiProject[]>([]);
  const [connection, setConnection] = useState<ConnectionState>("loading");
  const [googleConnection, setGoogleConnection] = useState<GoogleConnectionState>("loading");
  const [googleAccountEmail, setGoogleAccountEmail] = useState<string | null>(null);
  const [googleLastSyncAt, setGoogleLastSyncAt] = useState<string | null>(null);
  const [googleErrorCode, setGoogleErrorCode] = useState<string | null>(null);
  const [calendarUiOverride, setCalendarUiOverride] = useState<CalendarUiState | null>(null);
  const [hasGoogleIntegration, setHasGoogleIntegration] = useState(false);
  const [postConnectBanner, setPostConnectBanner] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [evidenceEpoch, setEvidenceEpoch] = useState(0);
  const [taskFilter, setTaskFilter] = useState<"inbox" | "today">("today");
  const [taskHorizon, setTaskHorizon] = useState<HorizonScope>("week");
  const [taskAnchor, setTaskAnchor] = useState(() => startOfDay(new Date()));
  const [captureScope, setCaptureScope] = useState<HorizonScope | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskPanelOpen, setTaskPanelOpen] = useState(true);
  const [slotPicker, setSlotPicker] = useState<SlotPicker | null>(null);
  const [blockPopover, setBlockPopover] = useState<{
    blockId: string;
    rect: DOMRect;
  } | null>(null);
  const [blockClipboard, setBlockClipboard] = useState<BlockClipboard | null>(null);
  const [pasteFocus, setPasteFocus] = useState<{ day: number; start: number } | null>(null);
  const [seriesScopePrompt, setSeriesScopePrompt] = useState<{
    kind: "task" | "session";
    id: string;
    payload: Record<string, unknown>;
    onCancel?: () => void;
  } | null>(null);
  const [sessionDeleteConfirm, setSessionDeleteConfirm] = useState<{
    blockId: string;
    title: string;
    repeated: boolean;
  } | null>(null);
  const [blockDragPreview, setBlockDragPreview] = useState<{
    id: string;
    day: number;
    start: number;
  } | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [aiContextOpen, setAiContextOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [toastKind, setToastKind] = useState<ToastKind>("info");
  const [search, setSearch] = useState("");
  const [showPlannerBlocks, setShowPlannerBlocks] = useState(true);
  const [showExternalEvents, setShowExternalEvents] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const tasksSearchRef = useRef<HTMLInputElement>(null);
  const savedScrollRef = useRef(0);
  const liveDataRef = useRef(false);
  const calendarSyncInFlightRef = useRef<Promise<void> | null>(null);
  const lastCalendarSyncAttemptRef = useRef(0);
  const calendarSyncBackoffUntilRef = useRef(0);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const visibleDays = view === "week" ? weekDays : [weekDays[activeDay]];
  const visibleIndexes = view === "week" ? weekDays.map((_, index) => index) : [activeDay];
  const currentWeekStart = startOfWeek(now).getTime();
  const isCurrentWeek = currentWeekStart === weekStart.getTime();
  const nowDay = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const nowMinute = now.getHours() * 60 + now.getMinutes();
  const editingTask = editingTaskId
    ? tasks.find((task) => task.id === editingTaskId) ?? null
    : null;

  const runCalendarSync = useCallback((options: {
    announce?: boolean;
    force?: boolean;
  } = {}) => {
    if (calendarSyncInFlightRef.current) return calendarSyncInFlightRef.current;
    const nowMs = Date.now();
    if (!options.force && nowMs < calendarSyncBackoffUntilRef.current) {
      return Promise.resolve();
    }
    if (!options.force
      && nowMs - lastCalendarSyncAttemptRef.current < AUTO_SYNC_MIN_GAP_MS) {
      return Promise.resolve();
    }

    lastCalendarSyncAttemptRef.current = nowMs;
    if (options.announce) setGoogleConnection("syncing");
    setCalendarUiOverride("SYNCING");

    const operation = syncGoogleCalendar()
      .then(({ summary }) => {
        calendarSyncBackoffUntilRef.current = 0;
        setHasGoogleIntegration(true);
        setGoogleLastSyncAt(new Date().toISOString());
        setGoogleErrorCode(summary.errorCode ?? null);
        if (summary.reconnectRequired) {
          setGoogleConnection("reconnect-required");
          setCalendarUiOverride("RECONNECT_REQUIRED");
          if (options.announce) {
            setToast("Google Calendar needs to be reconnected.");
          }
          return;
        }
        setGoogleConnection("connected");
        setCalendarUiOverride("SYNCED");
        setPostConnectBanner(null);
        setReloadKey((value) => value + 1);
        if (options.announce) setToast(calendarSyncMessage(summary));
      })
      .catch((error: unknown) => {
        calendarSyncBackoffUntilRef.current = Date.now() + AUTO_SYNC_ERROR_BACKOFF_MS;
        const code = error instanceof PlannerApiError ? error.code : "";
        setGoogleErrorCode(code || null);
        if (code === "GOOGLE_RECONNECT_REQUIRED" || code === "GOOGLE_NOT_CONNECTED") {
          setGoogleConnection("reconnect-required");
          setCalendarUiOverride("RECONNECT_REQUIRED");
          if (options.announce) {
            setToast(calendarErrorCopy(code));
          }
          return;
        }
        // Permission/upstream failures: stay connected so Sync retries — never start OAuth.
        setGoogleConnection("connected");
        setCalendarUiOverride("SYNC_FAILED");
        if (options.announce) {
          setToast(
            code === "GOOGLE_FORBIDDEN"
              ? calendarErrorCopy("GOOGLE_FORBIDDEN")
              : "Google Calendar connected. Sync needs attention.",
          );
        }
      })
      .finally(() => {
        calendarSyncInFlightRef.current = null;
      });

    calendarSyncInFlightRef.current = operation;
    return operation;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const needsWideRange = activeSection === "tasks"
      || activeSection === "goals"
      || activeSection === "progress";
    const taskRangeStart = taskHorizon === "month"
      ? startOfMonth(taskAnchor)
      : taskHorizon === "day"
        ? startOfDay(taskAnchor)
        : startOfWeek(taskAnchor);
    const taskRangeEnd = taskHorizon === "month"
      ? addDays(taskRangeStart, daysInMonth(taskRangeStart))
      : taskHorizon === "day"
        ? addDays(taskRangeStart, 1)
        : addDays(taskRangeStart, 7);
    const rangeStart = activeSection === "tasks"
      ? taskRangeStart
      : needsWideRange
        ? startOfWeek(addDays(now, -7))
      : view === "month" ? startOfMonth(monthAnchor) : weekStart;
    const rangeEnd = activeSection === "tasks"
      ? taskRangeEnd
      : needsWideRange
        ? addDays(startOfMonth(now), daysInMonth(now))
      : view === "month"
        ? addDays(startOfMonth(monthAnchor), daysInMonth(monthAnchor))
        : addDays(weekStart, 7);
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setConnection((current) => current === "live" ? "syncing" : "loading");
      }
    });

    fetchPlanner(rangeStart.toISOString(), rangeEnd.toISOString(), controller.signal)
      .then((data) => {
        const nextProjects = projectOptions(data.projects);
        setApiProjects(data.projects);
        setGoals(data.goals);
        setProjects(nextProjects);
        setTasks(data.tasks.map((task) => taskFromApi(task, nextProjects)));
        const referenceStart = view === "month" ? monthGridDays(monthAnchor)[0]! : weekStart;
        const maxDay = view === "month" ? 42 : 7;
        const keepAllBlocks = needsWideRange;
        setBlocks([
          ...data.timeBlocks.map((block) => timeBlockFromApi(block, referenceStart, nextProjects)),
          ...data.externalEvents.map((event) => externalBlockFromApi(event, referenceStart)),
        ].filter((block) => keepAllBlocks || (block.day >= 0 && block.day < maxDay)));
        liveDataRef.current = true;
        setConnection("live");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof PlannerApiError && error.code === "PLANNER_NOT_CONFIGURED") {
          liveDataRef.current = false;
          setConnection("demo");
          return;
        }
        setConnection("error");
        setToast("Could not refresh planner · keeping the current view");
      });

    return () => controller.abort();
  }, [reloadKey, weekStart, view, monthAnchor, activeSection, now, taskAnchor, taskHorizon]);

  const showToast = useCallback((message: string, kind: ToastKind = "info") => {
    setToastKind(kind);
    setToast(message);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchGoogleIntegration(controller.signal)
      .then((status) => {
        const connected = Boolean(status?.connected);
        setHasGoogleIntegration(connected);
        setGoogleAccountEmail(status?.googleAccountEmail ?? null);
        setGoogleLastSyncAt(status?.lastSyncAt ?? null);
        setGoogleErrorCode(status?.lastErrorCode ?? status?.lastError?.code ?? null);
        if (status?.reconnectRequired) {
          setGoogleConnection("reconnect-required");
          setCalendarUiOverride(null);
          calendarSyncBackoffUntilRef.current = Date.now() + AUTO_SYNC_ERROR_BACKOFF_MS;
          return;
        }
        setGoogleConnection(connected ? "connected" : "not-connected");
        if (!connected) setCalendarUiOverride(null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setGoogleConnection("error");
      });
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const google = url.searchParams.get("google");
    const reason = url.searchParams.get("reason");
    if (google !== "connected" && google !== "error") return;
    url.searchParams.delete("google");
    url.searchParams.delete("reason");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    if (google === "error") {
      if (reason === "account_mismatch") {
        setCalendarUiOverride("ACCOUNT_MISMATCH");
        setGoogleConnection("not-connected");
        setHasGoogleIntegration(false);
        setToast(calendarErrorCopy("account_mismatch"));
      } else if (reason === "identity_unavailable") {
        setCalendarUiOverride("SYNC_FAILED");
        setGoogleConnection("error");
        setToast(calendarErrorCopy("identity_unavailable"));
      } else if (reason === "missing_refresh_token") {
        setCalendarUiOverride("RECONNECT_REQUIRED");
        setGoogleConnection("reconnect-required");
        setHasGoogleIntegration(false);
        setToast(calendarErrorCopy("missing_refresh_token"));
      } else if (reason === "insufficient_scopes") {
        setCalendarUiOverride("SYNC_FAILED");
        setGoogleConnection("error");
        setGoogleErrorCode("GOOGLE_FORBIDDEN");
        setToast(calendarErrorCopy("GOOGLE_FORBIDDEN"));
      } else {
        setGoogleConnection("error");
        setCalendarUiOverride("SYNC_FAILED");
        setToast("Google Calendar connect failed.");
      }
      return;
    }
    setPostConnectBanner("Google Calendar connected");
    setCalendarUiOverride("CONNECTING");
    void completeOnboarding().catch(() => {
      // Non-blocking — onboarding may already be complete.
    });
    void (async () => {
      try {
        const status = await fetchGoogleIntegration();
        const connected = Boolean(status?.connected);
        const reconnect = Boolean(status?.reconnectRequired);
        setHasGoogleIntegration(connected);
        setGoogleAccountEmail(status?.googleAccountEmail ?? null);
        setGoogleLastSyncAt(status?.lastSyncAt ?? null);
        setGoogleErrorCode(status?.lastErrorCode ?? status?.lastError?.code ?? null);
        if (!connected || reconnect) {
          setGoogleConnection(reconnect ? "reconnect-required" : "not-connected");
          setCalendarUiOverride(reconnect ? "RECONNECT_REQUIRED" : "DISCONNECTED");
          setPostConnectBanner(null);
          setToast(
            reconnect
              ? calendarErrorCopy("GOOGLE_RECONNECT_REQUIRED")
              : "Google Calendar did not finish connecting.",
          );
          return;
        }
        setGoogleConnection("connected");
        setPostConnectBanner("Syncing your calendar…");
        await runCalendarSync({ announce: true, force: true });
      } catch {
        setGoogleConnection("error");
        setCalendarUiOverride("SYNC_FAILED");
        setPostConnectBanner(null);
        setToast("Google Calendar connected. Sync needs attention.");
      }
    })();
  }, [runCalendarSync]);

  useEffect(() => {
    if (connection !== "live" || !hasGoogleIntegration) return;
    if (googleConnection === "reconnect-required") return;

    const syncWhenActive = () => {
      if (document.visibilityState !== "visible") return;
      // Never bypass the min-gap / error backoff on focus — that caused sync spam.
      void runCalendarSync({ force: false });
    };
    const onWindowFocus = () => syncWhenActive();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") syncWhenActive();
    };

    const initialSync = window.setTimeout(() => syncWhenActive(), 0);
    const interval = window.setInterval(() => syncWhenActive(), AUTO_SYNC_INTERVAL_MS);
    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearTimeout(initialSync);
      window.clearInterval(interval);
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [connection, hasGoogleIntegration, googleConnection, runCalendarSync]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = savedScrollRef.current;
  }, [view, activeDay]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = Math.max(0, (now.getHours() - START_HOUR - 1) * 60);
  }, [now]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (activeSection !== "calendar") return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;

      if (event.key.toLowerCase() === "c") {
        const selected = blockPopover
          ? blocks.find((block) => block.id === blockPopover.blockId)
          : null;
        if (!selected || selected.type !== "task" || !selected.taskId) return;
        event.preventDefault();
        setBlockClipboard({
          taskId: selected.taskId,
          title: selected.title,
          duration: selected.duration,
          notes: selected.notes ?? "",
        });
        showToast("Session template copied");
        return;
      }

      if (event.key.toLowerCase() === "v") {
        if (!blockClipboard) return;
        event.preventDefault();
        const task = tasks.find((item) => item.id === blockClipboard.taskId);
        if (!task || task.status === "done") {
          showToast("Copied task is missing or already done", "warning");
          return;
        }
        const day = pasteFocus?.day
          ?? (view === "day" ? activeDay : (isCurrentWeek ? nowDay : 0));
        const start = pasteFocus?.start
          ?? Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - blockClipboard.duration, nowMinute));
        // Replace empty quick-create draft with an immediate Session paste.
        setSlotPicker(null);
        const pendingId = `pending-${crypto.randomUUID()}`;
        const block: CalendarBlock = {
          id: pendingId,
          title: blockClipboard.title || task.title,
          day,
          start,
          duration: blockClipboard.duration,
          color: priorityColor(task.priority),
          type: "task",
          taskId: task.id,
          projectId: task.projectId,
          meta: task.project,
          syncStatus: "PENDING",
          notes: blockClipboard.notes,
          status: "PLANNED",
        };
        setBlocks((current) => [...current, block]);
        setTasks((current) => current.map((item) =>
          item.id === task.id && item.status === "inbox"
            ? { ...item, status: "scheduled" }
            : item,
        ));
        showToast(liveDataRef.current ? "Pasting session…" : "Session pasted · demo mode");
        if (!liveDataRef.current) return;
        const startAt = slotDate(weekStart, day, start);
        const endAt = new Date(startAt.getTime() + blockClipboard.duration * 60_000);
        void (async () => {
          try {
            const saved = await createPlannerTimeBlock({
              taskId: task.id,
              projectId: task.projectId,
              title: blockClipboard.title || task.title,
              startAt: startAt.toISOString(),
              endAt: endAt.toISOString(),
              color: priorityColor(task.priority),
              notes: blockClipboard.notes || undefined,
            });
            const mapped = timeBlockFromApi(saved, weekStart, projects);
            setBlocks((current) => current.map((item) => item.id === pendingId ? mapped : item));
            showToast("Session pasted for the same task");
          } catch {
            setBlocks((current) => current.filter((item) => item.id !== pendingId));
            showToast("Could not paste session", "warning");
          }
        })();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activeSection,
    blockPopover,
    blocks,
    blockClipboard,
    pasteFocus,
    tasks,
    view,
    activeDay,
    isCurrentWeek,
    nowDay,
    nowMinute,
    weekStart,
    projects,
  ]);

  const rangeReferenceStart = view === "month" ? monthGridDays(monthAnchor)[0]! : weekStart;
  const isTaskBlockOnDate = (taskId: string, date: Date) =>
    blocks.some((block) =>
      block.type === "task"
      && block.taskId === taskId
      && sameDay(addDays(rangeReferenceStart, block.day), date),
    );

  const filteredTasks = tasks
    .filter((task) => {
      if (!task.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (taskFilter === "inbox") return task.status === "inbox";
      if (isTaskBlockOnDate(task.id, now)) return true;
      return task.status !== "done" && Boolean(task.dueAt && sameDay(new Date(task.dueAt), now));
    })
    .sort((left, right) => {
      if (left.status === "done" && right.status !== "done") return 1;
      if (left.status !== "done" && right.status === "done") return -1;
      const byPriority = priorityRank(left.priority) - priorityRank(right.priority);
      if (byPriority !== 0) return byPriority;
      const startOf = (taskId: string) =>
        blocks.find((block) =>
          block.type === "task"
          && block.taskId === taskId
          && sameDay(addDays(rangeReferenceStart, block.day), now),
        )?.start ?? Number.MAX_SAFE_INTEGER;
      return startOf(left.id) - startOf(right.id);
    });
  const doneTaskIds = new Set(tasks.filter((task) => task.status === "done").map((task) => task.id));

  const plannedMinutes = blocks
    .filter((block) => block.type === "task" && (view === "day" ? block.day === activeDay : true))
    .reduce((total, block) => total + block.duration, 0);
  const occupiedMinutes = blocks
    .filter((block) => (view === "day" ? block.day === activeDay : true))
    .reduce((total, block) => total + block.duration, 0);
  const openMinutes = Math.max(
    0,
    (view === "day" ? 1 : 7) * MINUTES_VISIBLE - occupiedMinutes,
  );

  const calendarBlocks = blocks
    .filter((block) => {
      if (block.type === "external" && !showExternalEvents) return false;
      if (block.type === "task" && !showPlannerBlocks) return false;
      return true;
    })
    .map((block) => {
      if (block.type !== "task" || !block.taskId) return block;
      const task = tasks.find((item) => item.id === block.taskId);
      return task ? { ...block, color: priorityColor(task.priority) } : block;
    });

  const changePeriod = useCallback((amount: number) => {
    if (view === "month") {
      setMonthAnchor((current) => {
        const next = new Date(current);
        next.setMonth(next.getMonth() + amount);
        return startOfMonth(next);
      });
      return;
    }
    setWeekStart((current) => addDays(current, amount * 7));
  }, [view]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable=true]");
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCaptureScope(activeSection === "tasks" ? taskHorizon : null);
        setQuickAddOpen(true);
        return;
      }
      if (event.key === "Escape") {
        setQuickAddOpen(false);
        setSlotPicker(null);
        setEditingTaskId(null);
        setBlockPopover(null);
        return;
      }
      if (typing) return;
      if (event.key === "/") {
        event.preventDefault();
        if (activeSection === "tasks") {
          tasksSearchRef.current?.focus();
          return;
        }
        searchRef.current?.focus();
        return;
      }
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setCaptureScope(activeSection === "tasks" ? taskHorizon : null);
        setQuickAddOpen(true);
        return;
      }
      if (event.key === "1") { goTo("calendar"); return; }
      if (event.key === "2") { goTo("tasks"); return; }
      if (event.key === "3") { goTo("projects"); return; }
      if (event.key === "4") { goTo("goals"); return; }
      if (event.key === "5") { goTo("progress"); return; }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        changePeriod(-1);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        changePeriod(1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeSection, changePeriod, goTo, taskHorizon]);

  const goToday = () => {
    setWeekStart(startOfWeek(new Date()));
    setMonthAnchor(startOfMonth(new Date()));
    setActiveDay(nowDay);
  };

  const warnIfConflict = (candidate: CalendarBlock, excludeId?: string) => {
    const overlaps = conflictingBlocks(candidate, blocks, excludeId);
    if (overlaps.length > 0) {
      showToast(`Overlaps with “${overlaps[0]!.title}” · saved anyway`, "warning");
      return true;
    }
    return false;
  };

  const onResizeBlock = async (blockId: string, nextDuration: number) => {
    const previous = blocks.find((block) => block.id === blockId);
    if (!previous || previous.type === "external") return;
    const duration = Math.max(SNAP_MINUTES, nextDuration);
    const candidate = { ...previous, duration };
    setBlocks((current) =>
      current.map((block) => (block.id === blockId ? candidate : block)),
    );
    warnIfConflict(candidate, blockId);

    const startAt = slotDate(weekStart, previous.day, previous.start);
    const endAt = new Date(startAt.getTime() + duration * 60_000);
    const payload = { endAt: endAt.toISOString() };

    if (previous.repeatSeriesId) {
      setSeriesScopePrompt({
        kind: "session",
        id: previous.id,
        payload,
        onCancel: () => {
          setBlocks((current) => current.map((block) =>
            block.id === previous.id ? previous : block,
          ));
        },
      });
      return;
    }

    showToast(liveDataRef.current ? "Updating block length…" : "Block resized · demo mode");
    if (!liveDataRef.current) return;
    try {
      const saved = await updateTimeBlock(previous.id, payload);
      const mapped = timeBlockFromApi(saved, weekStart, projects);
      setBlocks((current) => current.map((block) => block.id === saved.id ? mapped : block));
      if (saved.syncStatus === "FAILED") {
        showToast("Block saved · Google sync needs attention", "warning");
      } else {
        showToast("Block length updated · calendar synced");
      }
      setEvidenceEpoch((value) => value + 1);
    } catch {
      setBlocks((current) => current.map((block) => (block.id === blockId ? previous : block)));
      showToast("Could not resize block · changes rolled back", "warning");
    }
  };

  const commitBlockMove = async (
    previous: CalendarBlock,
    day: number,
    start: number,
  ) => {
    const candidate = { ...previous, day, start };
    setBlocks((current) =>
      current.map((block) => (block.id === previous.id ? candidate : block)),
    );
    warnIfConflict(candidate, previous.id);
    const startAt = slotDate(weekStart, day, start);
    const endAt = new Date(startAt.getTime() + previous.duration * 60_000);
    const sourceWeek = previous.startAt
      ? startOfProductWeek(new Date(previous.startAt)).getTime()
      : startOfProductWeek(slotDate(weekStart, previous.day, previous.start)).getTime();
    const targetWeek = startOfProductWeek(startAt).getTime();
    const crossWeek = sourceWeek !== targetWeek;
    const shouldCarryOver = crossWeek
      && !previous.repeatSeriesId
      && !isSessionDone(previous.status)
      && Boolean(previous.taskId);

    if (shouldCarryOver) {
      if (!liveDataRef.current) {
        showToast("Session carried over · demo mode");
        return;
      }
      try {
        await carryOverSession(previous.id, startAt.toISOString());
        setReloadKey((value) => value + 1);
        setToast("Session carried over to a new task for that week");
      } catch {
        setBlocks((current) => current.map((block) =>
          block.id === previous.id ? previous : block,
        ));
        setToast("Could not carry over session");
      }
      return;
    }

    const payload = {
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    };

    if (previous.repeatSeriesId) {
      setSeriesScopePrompt({
        kind: "session",
        id: previous.id,
        payload,
        onCancel: () => {
          setBlocks((current) => current.map((block) =>
            block.id === previous.id ? previous : block,
          ));
        },
      });
      return;
    }

    showToast(liveDataRef.current ? "Moving time block…" : "Time block moved · demo mode");
    if (!liveDataRef.current) return;
    try {
      const saved = await updateTimeBlock(previous.id, payload);
      const mapped = timeBlockFromApi(saved, weekStart, projects);
      setBlocks((current) => current.map((block) => block.id === saved.id ? mapped : block));
      setToast(saved.syncStatus === "FAILED"
        ? "Block saved · Google sync needs attention"
        : "Time block moved · calendar synced");
    } catch {
      setBlocks((current) => current.map((block) =>
        block.id === previous.id ? previous : block,
      ));
      showToast("Could not move block · changes rolled back", "warning");
    }
  };

  const scheduleTaskAtSlot = async (
    task: PlannerTask,
    day: number,
    start: number,
    pendingId: string,
    opts?: { duration?: number; notes?: string },
  ) => {
    const duration = Math.max(SNAP_MINUTES, opts?.duration ?? task.duration);
    const notes = opts?.notes?.trim() || undefined;
    const block: CalendarBlock = {
      id: pendingId,
      title: task.title,
      day,
      start,
      duration,
      color: priorityColor(task.priority),
      type: "task",
      taskId: task.id,
      projectId: task.projectId,
      meta: task.project,
      syncStatus: "PENDING",
      notes: notes ?? "",
      status: "PLANNED",
    };
    warnIfConflict(block);
    const startAt = slotDate(weekStart, day, start);
    setBlocks((current) => [...current, block]);
    setTasks((current) =>
      current.map((item) => (item.id === task.id ? {
        ...item,
        status: "scheduled",
        // Scheduling must NEVER mutate Task horizon (WEEK/MONTH stay WEEK/MONTH).
      } : item)),
    );
    if (isCurrentWeek && day === nowDay) {
      setTaskFilter("today");
      setTaskPanelOpen(true);
    }
    showToast(liveDataRef.current ? "Scheduling session…" : "Session scheduled · demo mode");
    if (!liveDataRef.current) return;

    const endAt = new Date(startAt.getTime() + duration * 60_000);
    try {
      const saved = await createPlannerTimeBlock({
        taskId: task.id,
        projectId: task.projectId,
        title: task.title,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        color: priorityColor(task.priority),
        notes,
      });
      const mapped = timeBlockFromApi(saved, weekStart, projects);
      setBlocks((current) => current.map((item) => item.id === pendingId ? mapped : item));
      showToast(saved.syncStatus === "FAILED"
        ? "Session scheduled · Google sync needs attention"
        : "Session scheduled · calendar synced");
    } catch {
      setBlocks((current) => current.filter((item) => item.id !== pendingId));
      setTasks((current) => current.map((item) =>
        item.id === task.id ? { ...item, status: "inbox" } : item,
      ));
      setConnection("error");
      showToast("Could not schedule session · changes rolled back", "warning");
    }
  };

  const toggleSessionDone = async (blockId: string, done: boolean) => {
    if (!liveDataRef.current) {
      setBlocks((current) => current.map((block) =>
        block.id === blockId
          ? { ...block, status: done ? "DONE" : "PLANNED", completedAt: done ? new Date().toISOString() : null }
          : block,
      ));
      showToast(done ? "Session marked done · demo mode" : "Session reopened · demo mode");
      return;
    }
    try {
      const saved = await completeSession(blockId, done);
      const mapped = timeBlockFromApi(saved, weekStart, projects);
      setBlocks((current) => current.map((block) => block.id === saved.id ? mapped : block));
      setEvidenceEpoch((value) => value + 1);
      setReloadKey((value) => value + 1);
      showToast(done ? "Session marked done" : "Session marked incomplete");
    } catch {
      showToast("Could not update session", "warning");
    }
  };

  const completeTask = async (taskId: string) => {
    const previousTasks = tasks;
    const taskBlocks = blocks.filter((block) => block.type === "task" && block.taskId === taskId);
    const policy = directTaskCompletePolicy(
      taskBlocks.map((block) => ({ id: block.id, status: block.status ?? "PLANNED" })),
    );
    if (!policy.allow) {
      showToast(
        policy.reason === "ZERO_SESSIONS"
          ? "Schedule a session before marking this task done"
          : "Mark each session done on the Calendar",
        "warning",
      );
      return;
    }
    setTasks((current) =>
      current.map((task) => (task.id === taskId ? {
        ...task,
        status: "done",
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } : task)),
    );
    setBlocks((current) =>
      current.map((block) =>
        block.type === "task" && block.taskId === taskId
          ? { ...block, status: "DONE", completedAt: new Date().toISOString() }
          : block,
      ),
    );
    setTaskFilter("today");
    setToast(liveDataRef.current ? "Marking task done…" : "Task done · demo mode");
    if (!liveDataRef.current) return;

    try {
      await updateTask(taskId, { status: "DONE" });
      setToast("Task marked done");
      setEvidenceEpoch((value) => value + 1);
    } catch {
      setTasks(previousTasks);
      setConnection("error");
      setToast("Could not complete task · changes rolled back");
    }
  };

  const restoreTask = async (taskId: string) => {
    const previousTasks = tasks;
    const hasBlock = blocks.some((block) => block.type === "task" && block.taskId === taskId);
    const nextStatus: TaskStatus = hasBlock ? "scheduled" : "inbox";
    setTasks((current) => current.map((task) =>
      task.id === taskId ? { ...task, status: nextStatus, completedAt: null } : task,
    ));
    setToast(liveDataRef.current ? "Restoring task…" : "Task restored · demo mode");
    if (!liveDataRef.current) return;
    try {
      await updateTask(taskId, { status: hasBlock ? "SCHEDULED" : "INBOX" });
      setToast(hasBlock ? "Task restored on calendar" : "Task restored to Inbox");
      setEvidenceEpoch((value) => value + 1);
    } catch {
      setTasks(previousTasks);
      setToast("Could not restore task · changes rolled back");
    }
  };

  const onDragStart = (event: React.DragEvent, payload: DragPayload) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-personal-os", JSON.stringify(payload));
  };

  const parseDragPayload = (event: React.DragEvent): DragPayload | null => {
    const raw = event.dataTransfer.getData("application/x-personal-os");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DragPayload;
    } catch {
      return null;
    }
  };

  const unscheduleBlock = async (blockId: string) => {
    const block = blocks.find((item) => item.id === blockId);
    if (!block || block.type === "external") return;
    if (!block.taskId) {
      const previousBlocks = blocks;
      setBlocks((current) => current.filter((item) => item.id !== blockId));
      showToast(liveDataRef.current ? "Removing time block…" : "Block removed · demo mode");
      if (!liveDataRef.current) return;
      try {
        await deleteTimeBlock(block.id);
        showToast("Time block removed from calendar");
      } catch {
        setBlocks(previousBlocks);
        setConnection("error");
        showToast("Could not remove block · changes rolled back", "warning");
      }
      return;
    }

    const taskId = block.taskId;
    const remainingSessions = remainingSessionsAfterRemove(taskId, blockId, blocks);
    const dropToInbox = remainingSessions === 0;
    const previousTasks = tasks;
    const previousBlocks = blocks;
    setBlocks((current) => current.filter((item) => item.id !== blockId));
    if (dropToInbox) {
      setTasks((current) =>
        current.map((task) => (task.id === taskId ? { ...task, status: "inbox" } : task)),
      );
      setTaskFilter("inbox");
      setTaskPanelOpen(true);
    }
    showToast(
      liveDataRef.current
        ? "Removing session…"
        : dropToInbox
          ? "Removed from Calendar · demo mode"
          : "Session removed · task still scheduled · demo mode",
    );
    if (!liveDataRef.current) return;

    try {
      await deleteTimeBlock(block.id);
      if (dropToInbox) {
        await updateTask(taskId, { status: "INBOX" });
        showToast("Removed from Calendar — task kept");
      } else {
        showToast("Session removed — other work sessions kept");
      }
    } catch {
      setTasks(previousTasks);
      setBlocks(previousBlocks);
      setConnection("error");
      showToast("Could not unschedule task · changes rolled back", "warning");
    }
  };

  const onTaskPanelDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    const payload = parseDragPayload(event);
    if (!payload || payload.kind !== "block") return;
    await unscheduleBlock(payload.blockId);
  };

  const onCalendarDrop = async (event: React.DragEvent, day: number) => {
    event.preventDefault();
    const payload = parseDragPayload(event);
    if (!payload) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const minutesFromStart = Math.round((y / rect.height) * MINUTES_VISIBLE / SNAP_MINUTES) * SNAP_MINUTES;
    const start = Math.min(END_HOUR * 60 - SNAP_MINUTES, START_HOUR * 60 + minutesFromStart);

    if (payload.kind === "block") {
      const previous = blocks.find((block) => block.id === payload.blockId);
      if (!previous || previous.type === "external") return;
      await commitBlockMove(previous, day, start);
      return;
    }

    const task = tasks.find((item) => item.id === payload.taskId);
    if (!task || task.status === "done") return;
    const existing = blocks.find((item) => item.type === "task" && item.taskId === task.id);
    if (existing) {
      await commitBlockMove(existing, day, start);
      if (isCurrentWeek && day === nowDay) {
        setTaskFilter("today");
        setTaskPanelOpen(true);
      }
      return;
    }

    const block: CalendarBlock = {
      id: `pending-${crypto.randomUUID()}`,
      title: task.title,
      day,
      start,
      duration: task.duration,
      color: priorityColor(task.priority),
      type: "task",
      taskId: task.id,
      projectId: task.projectId,
      meta: task.project,
      syncStatus: "PENDING",
    };
    warnIfConflict(block);
    const startAt = slotDate(weekStart, day, start);
    setBlocks((current) => [...current, block]);
    setTasks((current) =>
      current.map((item) => (item.id === task.id ? {
        ...item,
        status: "scheduled",
        // Scheduling must NEVER mutate Task horizon.
      } : item)),
    );
    if (isCurrentWeek && day === nowDay) {
      setTaskFilter("today");
      setTaskPanelOpen(true);
    }
    showToast(liveDataRef.current ? "Scheduling task…" : "Task scheduled · demo mode");
    if (!liveDataRef.current) return;

    const endAt = new Date(startAt.getTime() + task.duration * 60_000);
    try {
      const saved = await createPlannerTimeBlock({
        taskId: task.id,
        projectId: task.projectId,
        title: task.title,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        color: priorityColor(task.priority),
      });
      const mapped = timeBlockFromApi(saved, weekStart, projects);
      setBlocks((current) => current.map((item) => item.id === block.id ? mapped : item));
      setToast(saved.syncStatus === "FAILED"
        ? "Task scheduled · Google sync needs attention"
        : "Task scheduled · calendar synced");
    } catch {
      setBlocks((current) => current.filter((item) => item.id !== block.id));
      setTasks((current) => current.map((item) =>
        item.id === task.id ? { ...item, status: "inbox" } : item,
      ));
      setConnection("error");
      setToast("Could not schedule task · changes rolled back");
    }
  };

  const openQuickAdd = (scope: HorizonScope | null = activeSection === "tasks" ? taskHorizon : null) => {
    setCaptureScope(scope);
    setQuickAddOpen(true);
  };

  const addTask = async (
    title: string,
    duration: number,
    projectId: string | null,
    priority: TaskPriority = "p2",
    scope: HorizonScope | null = captureScope,
    when: Date = taskAnchor,
    repeatWeeks: number | null = null,
  ): Promise<PlannerTask | null> => {
    const project = projects.find((item) => item.id === projectId) ?? projects.at(-1)!;
    const inheritedGoalId = project.goalId ?? null;
    const inheritedGoalProcessId = project.defaultGoalProcessId ?? null;
    const resolvedScope = scope && scope !== "all" ? scope : "day";
    const periodAnchor = startOfDay(when);
    const period = duePeriodForScope(resolvedScope, periodAnchor);
    const task: PlannerTask = {
      id: `pending-${crypto.randomUUID()}`,
      title,
      notes: "",
      projectId,
      goalId: inheritedGoalId,
      goalProcessId: inheritedGoalProcessId,
      project: project.title,
      color: project.color,
      duration,
      priority,
      status: "inbox",
      dueAt: period.dueAt,
      dueHorizon: period.dueHorizon,
      due: dueLabel(period.dueAt, period.dueHorizon),
    };
    setTasks((current) => [task, ...current]);
    setQuickAddOpen(false);
    const savedWhere = period.dueHorizon === "week"
      ? (startOfWeek(periodAnchor).getTime() === startOfWeek(now).getTime()
        ? "this week"
        : `week of ${startOfWeek(periodAnchor).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`)
      : period.dueHorizon === "month"
        ? (startOfMonth(periodAnchor).getTime() === startOfMonth(now).getTime()
          ? "this month"
          : periodAnchor.toLocaleDateString("en-US", { month: "long" }))
        : period.dueHorizon === "day"
          ? (sameDay(periodAnchor, now)
            ? "today"
            : periodAnchor.toLocaleDateString("en-US", { month: "short", day: "numeric" }))
          : "Inbox";
    setToast(liveDataRef.current ? "Saving task…" : `Task added to ${savedWhere} · demo mode`);
    if (!liveDataRef.current) return task;

    try {
      const saved = await createPlannerTask({
        title,
        projectId,
        goalId: inheritedGoalId,
        goalProcessId: inheritedGoalProcessId,
        durationMinutes: duration,
        priority: priorityToApi(priority),
        dueAt: period.dueAt,
        dueHorizon: dueHorizonToApi(period.dueHorizon),
      });
      const mapped = taskFromApi(saved, projects);
      const dueHorizon = period.dueHorizon ?? mapped.dueHorizon;
      setTasks((current) => current.map((item) => item.id === task.id ? {
        ...mapped,
        dueHorizon,
        due: dueLabel(mapped.dueAt, dueHorizon),
      } : item));
      if (repeatWeeks && period.dueHorizon === "week") {
        try {
          await repeatTask(saved.id, { weeks: repeatWeeks });
          setReloadKey((value) => value + 1);
          setToast(`Task saved to ${savedWhere} · repeated ${repeatWeeks} weeks`);
        } catch {
          setToast(`Task saved to ${savedWhere} · repeat failed`);
        }
      } else {
        setToast(`Task saved to ${savedWhere}`);
      }
      return mapped;
    } catch {
      setTasks((current) => current.filter((item) => item.id !== task.id));
      setConnection("error");
      setToast("Could not save task · changes rolled back");
      return null;
    }
  };

  const setTaskPriority = async (taskId: string, priority: TaskPriority) => {
    const previousTasks = tasks;
    const previousBlocks = blocks;
    const color = priorityColor(priority);
    const linked = blocks.filter((block) => block.type === "task" && block.taskId === taskId);
    setTasks((current) =>
      current.map((task) => (task.id === taskId ? { ...task, priority } : task)),
    );
    setBlocks((current) =>
      current.map((block) => (block.taskId === taskId && block.type === "task"
        ? { ...block, color }
        : block)),
    );
    if (!liveDataRef.current) return;
    try {
      await updateTask(taskId, { priority: priorityToApi(priority) });
      await Promise.all(
        linked
          .filter((block) => !block.id.startsWith("pending-"))
          .map((block) => updateTimeBlock(block.id, { color })),
      );
    } catch {
      setTasks(previousTasks);
      setBlocks(previousBlocks);
      showToast("Could not update priority · changes rolled back", "warning");
    }
  };

  const dataConnectionLabel = {
    loading: "Connecting…",
    syncing: "Refreshing…",
    live: "Synced",
    demo: "Demo data",
    error: "Offline",
  }[connection];

  const failedSyncCount = blocks.filter(
    (block) => block.type === "task" && block.syncStatus === "FAILED",
  ).length;

  const syncDisplay = connection !== "live"
    ? { state: connection, label: dataConnectionLabel }
    : googleConnection === "connected" && failedSyncCount > 0
      ? { state: "error", label: `${failedSyncCount} failed` }
    : googleConnection === "connected"
      ? { state: "live", label: "Synced" }
      : googleConnection === "not-connected" || googleConnection === "reconnect-required"
        ? {
          state: "demo",
          label: googleConnection === "reconnect-required" ? "Reconnect" : "Connect",
        }
        : googleConnection === "syncing" || googleConnection === "loading"
          ? { state: "syncing", label: googleConnection === "syncing" ? "Syncing…" : "Checking…" }
          : { state: "error", label: "Retry" };

  const handleCalendarConnect = async () => {
    if (connection !== "live") {
      setReloadKey((value) => value + 1);
      return;
    }
    try {
      setGoogleConnection("loading");
      setCalendarUiOverride("CONNECTING");
      const result = await getGoogleAuthUrl();
      if (!result.url) throw new Error("OAuth is unavailable");
      window.location.assign(result.url);
    } catch {
      setGoogleConnection("error");
      setCalendarUiOverride("SYNC_FAILED");
      setToast("Could not start Google Calendar connection");
    }
  };

  const handleCalendarReconnect = async () => {
    try {
      setCalendarUiOverride("CONNECTING");
      const result = await getGoogleAuthUrl();
      if (!result.url) throw new Error("OAuth unavailable");
      window.location.assign(result.url);
    } catch {
      setToast("Could not start reconnect");
    }
  };

  /** Sync now — never starts OAuth. */
  const handleSyncNow = async () => {
    if (connection !== "live") {
      setReloadKey((value) => value + 1);
      return;
    }
    if (googleConnection === "reconnect-required" || !hasGoogleIntegration) {
      return;
    }
    calendarSyncBackoffUntilRef.current = 0;
    await runCalendarSync({ announce: true, force: true });
  };

  const handleSyncChipClick = () => {
    if (connection !== "live") {
      setReloadKey((value) => value + 1);
      return;
    }
    if (googleConnection === "reconnect-required") {
      void handleCalendarReconnect();
      return;
    }
    if (!hasGoogleIntegration || googleConnection === "not-connected") {
      void handleCalendarConnect();
      return;
    }
    void handleSyncNow();
  };

  const handleCalendarDisconnect = async () => {
    try {
      await disconnectGoogleCalendar();
      setHasGoogleIntegration(false);
      setGoogleAccountEmail(null);
      setGoogleLastSyncAt(null);
      setGoogleErrorCode(null);
      setCalendarUiOverride(null);
      setGoogleConnection("not-connected");
      setPostConnectBanner(null);
      setToast("Google Calendar disconnected");
      setReloadKey((value) => value + 1);
    } catch {
      setToast("Could not disconnect Google Calendar");
    }
  };

  const calendarUiState: CalendarUiState = calendarUiOverride
    ?? (googleConnection === "reconnect-required"
      ? "RECONNECT_REQUIRED"
      : googleConnection === "syncing"
        ? "SYNCING"
        : googleConnection === "loading"
          ? "CONNECTING"
          : googleConnection === "error"
            ? "SYNC_FAILED"
            : googleConnection === "not-connected"
              ? "DISCONNECTED"
              : googleConnection === "connected"
                ? (googleLastSyncAt ? "SYNCED" : "CONNECTED")
                : "DISCONNECTED");

  const taskCountByProject = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of tasks) {
      if (!task.projectId || task.status === "done") continue;
      counts.set(task.projectId, (counts.get(task.projectId) ?? 0) + 1);
    }
    return counts;
  }, [tasks]);

  const calendarReferenceStart = view === "month" ? monthGridDays(monthAnchor)[0]! : weekStart;
  const monthCells = useMemo(() => monthGridDays(monthAnchor), [monthAnchor]);

  const openDayFromMonth = (date: Date) => {
    const monday = startOfWeek(date);
    setWeekStart(monday);
    const dayIndex = dayIndexFor(date.toISOString(), monday);
    setActiveDay(Math.max(0, Math.min(6, dayIndex)));
    setView("day");
  };

  const sectionTitle = {
    calendar: "Calendar planner",
    tasks: "Task workspace",
    projects: "Projects",
    goals: "Goals",
    progress: "Progress",
  }[activeSection];

  return (
    <div className="app-shell">
      <PlannerSidebar
        inboxCount={tasks.filter((task) => task.status === "inbox").length}
        activeSection={activeSection}
        showPlannerBlocks={showPlannerBlocks}
        showExternalEvents={showExternalEvents}
        hasGoogleIntegration={hasGoogleIntegration}
        showCalendarLayers={activeSection === "calendar"}
        googleState={
          (connection !== "live"
            ? connection === "error" ? "error" : connection === "loading" || connection === "syncing" ? "loading" : "demo"
            : googleConnection === "connected" && failedSyncCount > 0 ? "error"
              : googleConnection === "connected" ? "live"
                : googleConnection === "not-connected" || googleConnection === "reconnect-required" ? "demo"
                  : googleConnection === "syncing" || googleConnection === "loading" ? "syncing"
                    : "error") as SidebarGoogleState
        }
        googleLabel={
          connection !== "live" ? (connection === "demo" ? "Demo mode" : connection === "error" ? "Retry connection" : "Checking…")
            : googleConnection === "connected" && failedSyncCount > 0 ? `${failedSyncCount} failed · tap to retry`
              : googleConnection === "connected" ? "Synced"
                : googleConnection === "reconnect-required" ? "Reconnect"
                : googleConnection === "not-connected" ? "Connect"
                  : googleConnection === "syncing" ? "Syncing…"
                    : googleConnection === "loading" ? "Checking…"
                      : "Retry"
        }
        onTogglePlannerBlocks={() => setShowPlannerBlocks((value) => !value)}
        onToggleExternalEvents={() => setShowExternalEvents((value) => !value)}
        onGoToday={() => {
          goTo("calendar");
          goToday();
        }}
        onGoogleClick={() => {
          void handleSyncChipClick();
        }}
      />

      <main className={`workspace ${activeSection !== "calendar" ? "tasks-mode" : ""}${activeSection === "goals" && entityId ? " goal-detail-mode" : ""}`}>
        {!(activeSection === "goals" && entityId) && (
        <header className="topbar">
          <div className="mobile-brand">
            <div className="brand-mark">P</div>
            <strong>Personal OS</strong>
          </div>
          <div className="calendar-title-block">
            <div className="eyebrow">{sectionTitle}</div>
            {activeSection === "calendar" ? (
              <h1>
                {(view === "month" ? monthAnchor : weekStart).toLocaleDateString("en-US", { month: "long" })}{" "}
                <span>{(view === "month" ? monthAnchor : weekStart).getFullYear()}</span>
              </h1>
            ) : activeSection === "tasks" ? (
              <h1>Tasks <span>{tasks.filter((task) => task.status !== "done").length} active</span></h1>
            ) : activeSection === "projects" ? (
              <h1>Projects <span>{apiProjects.filter((project) => project.active).length} active</span></h1>
            ) : activeSection === "goals" ? (
              <h1>Goals <span>{goals.filter((goal) => goal.status === "ACTIVE").length} active</span></h1>
            ) : (
              <h1>Progress</h1>
            )}
          </div>

          <div className="topbar-actions">
            {postConnectBanner ? (
              <p className="pos-gcal-banner" role="status" aria-live="polite">
                {postConnectBanner}
              </p>
            ) : null}
            <button
              className={`sync-status ${syncDisplay.state}`}
              title={hasGoogleIntegration
                ? failedSyncCount > 0
                  ? `${failedSyncCount} Personal OS block${failedSyncCount === 1 ? "" : "s"} failed to sync; click to retry`
                  : googleAccountEmail
                    ? `Connected as ${googleAccountEmail} · click to sync now`
                    : "Google Calendar auto-syncs while this tab is active; click to sync now"
                : "Connect Google Calendar"}
              onClick={handleSyncChipClick}
              aria-live="polite"
            >
              <span className="sync-dot" />
              Google Calendar
              <span>
                {hasGoogleIntegration && googleAccountEmail
                  ? `${syncDisplay.label} · ${googleAccountEmail}`
                  : syncDisplay.label}
              </span>
            </button>
            <button className="icon-button" aria-label="Notifications">
              <Bell size={18} />
              <span className="notification-dot" />
            </button>
            <div className="pos-account">
              <button
                type="button"
                className="avatar"
                aria-label="Open account menu"
                aria-expanded={accountMenuOpen}
                title={viewer?.email}
                onClick={() => {
                  setAccountMenuOpen((value) => !value);
                }}
              >
                {viewer?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={viewer.avatarUrl}
                    alt={viewer.displayName ? `${viewer.displayName} avatar` : "Account avatar"}
                    className="pos-account-avatar-img"
                  />
                ) : (
                  initials(viewer?.displayName)
                )}
              </button>
              {accountMenuOpen ? (
                <div className="pos-account-menu pos-account-menu-wide" role="menu">
                  <div className="pos-account-meta">
                    <strong>{viewer?.displayName ?? "Signed in"}</strong>
                    <span>{viewer?.email}</span>
                  </div>
                  <div className="pos-account-divider" role="separator" />
                  <GoogleCalendarConnection
                    compact
                    state={calendarUiState}
                    email={googleAccountEmail}
                    lastSyncAt={googleLastSyncAt}
                    errorCode={googleErrorCode}
                    syncDisabled={Boolean(calendarSyncInFlightRef.current)}
                    onConnect={() => {
                      setAccountMenuOpen(false);
                      void handleCalendarConnect();
                    }}
                    onSync={() => {
                      setAccountMenuOpen(false);
                      void handleSyncNow();
                    }}
                    onReconnect={() => {
                      setAccountMenuOpen(false);
                      void handleCalendarReconnect();
                    }}
                    onDisconnect={() => {
                      setAccountMenuOpen(false);
                      void handleCalendarDisconnect();
                    }}
                  />
                  <div className="pos-account-divider" role="separator" />
                  <button
                    type="button"
                    role="menuitem"
                    className="pos-account-signout"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      setAiContextOpen(true);
                    }}
                  >
                    AI Context
                  </button>
                  <div className="pos-account-divider" role="separator" />
                  <button
                    type="button"
                    role="menuitem"
                    className="pos-account-signout"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      void onSignOut?.();
                    }}
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        )}

        {activeSection === "calendar" ? <>
        <section className="calendar-toolbar pos-cal-toolbar" aria-label="Calendar controls">
          <div className="toolbar-cluster">
            <button className="today-button" onClick={goToday}>Today</button>
            <div className="pager">
              <button aria-label={view === "month" ? "Previous month" : "Previous week"} onClick={() => changePeriod(-1)}>
                <ChevronLeft size={18} />
              </button>
              <button aria-label={view === "month" ? "Next month" : "Next week"} onClick={() => changePeriod(1)}>
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="week-range pos-mono">
              {view === "month" ? (
                monthAnchor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
              ) : (
                <>
                  {weekDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  <span>—</span>
                  {weekDays[6].toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </>
              )}
            </div>
          </div>

          <div className="toolbar-cluster toolbar-right">
            <div className="capacity-summary">
              <span><strong className="pos-mono">{durationLabel(plannedMinutes)}</strong> planned</span>
              <i />
              <span><strong className="pos-mono">{durationLabel(openMinutes)}</strong> open</span>
              {view === "day" && <small>Day capacity</small>}
            </div>
            <div className="view-switcher" aria-label="Calendar view">
              <button className={view === "day" ? "active" : ""} onClick={() => {
                if (scrollRef.current) savedScrollRef.current = scrollRef.current.scrollTop;
                setView("day");
              }}>Day</button>
              <button className={view === "week" ? "active" : ""} onClick={() => {
                if (scrollRef.current) savedScrollRef.current = scrollRef.current.scrollTop;
                setView("week");
              }}>Week</button>
              <button className={view === "month" ? "active" : ""} onClick={() => setView("month")}>Month</button>
            </div>
            <button
              className={`tasks-toggle ${taskPanelOpen ? "active" : ""}`}
              onClick={() => setTaskPanelOpen((open) => !open)}
            >
              <ListTodo size={17} /> {taskFilter === "inbox" ? "Inbox" : "Today"}
            </button>
          </div>
        </section>

        <div className={`planner-layout ${taskPanelOpen && view !== "month" ? "with-panel" : ""}`}>
          <section
            className="calendar-card pos-cal"
            aria-label={view === "month" ? "Monthly calendar" : "Weekly calendar"}
            aria-busy={connection === "loading" || connection === "syncing"}
          >
            {view === "month" ? (
              <MonthCalendar
                cells={monthCells}
                anchor={monthAnchor}
                blocks={calendarBlocks}
                referenceStart={calendarReferenceStart}
                onOpenDay={openDayFromMonth}
              />
            ) : <>
            <div className="calendar-days" style={{ "--day-count": visibleDays.length } as React.CSSProperties}>
              <div className="timezone">GMT+7</div>
              {visibleDays.map((date, index) => {
                const realIndex = visibleIndexes[index];
                const isToday = isCurrentWeek && realIndex === nowDay;
                return (
                  <button
                    key={date.toISOString()}
                    className={`day-heading ${isToday ? "today" : ""}`}
                    onClick={() => {
                      setActiveDay(realIndex);
                      setView("day");
                    }}
                  >
                    <span>{date.toLocaleDateString("en-US", { weekday: "short" })}</span>
                    <strong>{date.getDate()}</strong>
                    {isToday && <i />}
                  </button>
                );
              })}
            </div>

            <div className="all-day-row" style={{ "--day-count": visibleDays.length } as React.CSSProperties}>
              <div className="all-day-label">All day</div>
              {visibleIndexes.map((dayIndex) => {
                const dayAllDay = calendarBlocks.filter(
                  (block) => block.day === dayIndex && block.allDay && (block.type !== "external" || showExternalEvents),
                );
                return (
                  <div className="all-day-cell" key={`allday-${dayIndex}`}>
                    {dayAllDay.map((block) => (
                      <button
                        type="button"
                        key={block.id}
                        className="all-day-chip"
                        title={block.title}
                        disabled={block.type === "external"}
                      >
                        {block.title}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
            <div className="calendar-scroll" ref={scrollRef}>
              <div className="calendar-grid" style={{ "--day-count": visibleDays.length } as React.CSSProperties}>
                <div className="time-rail">
                  {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => (
                    <span key={index} style={{ top: index * 60 - 7 }}>
                      {index === END_HOUR - START_HOUR ? "" : minutesToTime((START_HOUR + index) * 60).replace(":00", "")}
                    </span>
                  ))}
                </div>

                {visibleIndexes.map((dayIndex) => {
                  const dayBlocks = calendarBlocks
                    .map((block) => {
                      if (blockDragPreview?.id === block.id) {
                        return { ...block, day: blockDragPreview.day, start: blockDragPreview.start };
                      }
                      return block;
                    })
                    .filter((block) => block.day === dayIndex && !block.allDay);
                  const laidOut = resolveOverlapLayout(dayBlocks);
                  return (
                  <div
                    className={`day-track${isCurrentWeek && dayIndex === nowDay ? " today" : ""}`}
                    key={dayIndex}
                    data-day-index={dayIndex}
                    role="presentation"
                    onMouseDown={(event) => {
                      if ((event.target as HTMLElement).closest(".calendar-event")) return;
                      if (event.button !== 0) return;
                      const rect = event.currentTarget.getBoundingClientRect();
                      const start = slotMinutesFromClick(event.clientY, rect);
                      const slotTop =
                        ((start - START_HOUR * 60) / MINUTES_VISIBLE) * rect.height;
                      const anchor = new DOMRect(
                        rect.left + Math.min(rect.width * 0.35, 80),
                        rect.top + slotTop,
                        Math.max(40, rect.width * 0.45),
                        30,
                      );
                      setPasteFocus({ day: dayIndex, start });
                      setSlotPicker({ day: dayIndex, start, duration: 30, anchor });
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => onCalendarDrop(event, dayIndex)}
                  >
                    {isCurrentWeek && dayIndex === nowDay && nowMinute >= START_HOUR * 60 && nowMinute <= END_HOUR * 60 && (
                      <div className="now-line" style={{ top: nowMinute - START_HOUR * 60 }}>
                        <span className="pos-mono">{minutesToTime(nowMinute)}</span>
                      </div>
                    )}
                    {laidOut.map((block) => {
                      const geometry = overlapGeometry(block.col, block.numCols);
                      const sessionDone = isSessionDone(block.status);
                      const taskDone = Boolean(block.taskId && doneTaskIds.has(block.taskId));
                      return (
                        <CalendarEvent
                          key={block.id}
                          block={block}
                          done={sessionDone || taskDone}
                          sessionDone={sessionDone}
                          layout={geometry}
                          selected={blockPopover?.blockId === block.id}
                          onOpenTask={setEditingTaskId}
                          onResize={onResizeBlock}
                          onMovePreview={setBlockDragPreview}
                          onMoveCommit={(blockId, day, start) => {
                            const previous = blocks.find((item) => item.id === blockId);
                            if (!previous || previous.type === "external") return;
                            void commitBlockMove(previous, day, start);
                          }}
                          onSelect={(rect) => {
                            setPasteFocus({ day: block.day, start: block.start });
                            setBlockPopover({ blockId: block.id, rect });
                          }}
                          onToggleSessionDone={(done) => {
                            void toggleSessionDone(block.id, done);
                          }}
                        />
                      );
                    })}
                  </div>
                  );
                })}
              </div>
            </div>
            </>}
          </section>

          {taskPanelOpen && view !== "month" && (
            <TaskPanel
              tasks={filteredTasks}
              count={filteredTasks.filter((task) => task.status !== "done").length}
              filter={taskFilter}
              search={search}
              searchRef={searchRef}
              onSearch={setSearch}
              onFilter={setTaskFilter}
              onClose={() => setTaskPanelOpen(false)}
              onQuickAdd={() => {
                setCaptureScope(null);
                setQuickAddOpen(true);
              }}
              onDragStart={onDragStart}
              onComplete={completeTask}
              onRestore={restoreTask}
              onPriorityChange={setTaskPriority}
              onOpenTask={setEditingTaskId}
              onDropBlock={onTaskPanelDrop}
            />
          )}
        </div>
        </> : activeSection === "tasks" ? (
          <TasksWorkspace
            tasks={tasks}
            blocks={blocks}
            projects={projects}
            weekStart={weekStart}
            now={now}
            horizon={taskHorizon}
            anchor={taskAnchor}
            selectedTaskId={editingTaskId}
            searchInputRef={tasksSearchRef}
            onHorizonChange={setTaskHorizon}
            onAnchorChange={setTaskAnchor}
            onQuickAdd={() => openQuickAdd(taskHorizon)}
            onOpenTask={setEditingTaskId}
            onComplete={completeTask}
            onRestore={restoreTask}
          />
        ) : activeSection === "projects" ? (
          <ProjectsWorkspace
            projects={apiProjects}
            goals={goals}
            tasks={tasks}
            blocks={blocks}
            now={now}
            live={connection === "live"}
            initialDetailId={entityId}
            onDetailClose={() => goTo("projects")}
            onOpenDetail={(projectId) => goTo("projects", projectId)}
            onChanged={(message) => {
              setReloadKey((value) => value + 1);
              showToast(message);
            }}
            onOpenTask={setEditingTaskId}
            onGoCalendar={() => goTo("calendar")}
            onOpenGoal={(goalId) => goTo("goals", goalId)}
            evidenceEpoch={evidenceEpoch}
          />
        ) : activeSection === "goals" ? (
          <GoalsWorkspace
            goals={goals}
            projects={apiProjects}
            tasks={tasks}
            blocks={blocks}
            now={now}
            live={connection === "live"}
            onChanged={(message) => {
              setReloadKey((value) => value + 1);
              showToast(message);
            }}
            onOpenTask={setEditingTaskId}
            onGoCalendar={() => goTo("calendar")}
            onOpenProject={(projectId) => goTo("projects", projectId)}
            onViewFullProgress={(goalId) => goTo("progress", goalId)}
            initialDetailId={entityId}
            onOpenGoal={(goalId) => goTo("goals", goalId)}
            onDetailClose={() => goTo("goals")}
            evidenceEpoch={evidenceEpoch}
            onAddWeekTask={(projectId, title) => {
              void addTask(title, 60, projectId, "p2", "week", startOfWeek(now));
            }}
          />
        ) : (
          <ProgressWorkspace
            tasks={tasks}
            blocks={blocks}
            projects={apiProjects}
            goals={goals}
            now={now}
            weekStart={weekStart}
            evidenceEpoch={evidenceEpoch}
            live={connection === "live"}
            initialGoalId={entityId}
            onClearGoal={() => goTo("progress")}
            onOpenGoal={(goalId) => goTo("progress", goalId)}
            onOpenTask={setEditingTaskId}
            onOpenProject={(projectId) => goTo("projects", projectId)}
            onChanged={(message) => {
              setReloadKey((value) => value + 1);
              showToast(message);
            }}
          />
        )}
      </main>

      <button className="quick-add-fab" onClick={() => openQuickAdd()} aria-label="Quick add">
        <Plus size={22} />
      </button>

      {quickAddOpen && (
        <QuickAdd
          projects={projects}
          scope={captureScope}
          anchor={taskAnchor}
          onClose={() => setQuickAddOpen(false)}
          onAdd={addTask}
        />
      )}

      {editingTask && (
        <TaskEditor
          key={editingTask.id}
          task={editingTask}
          projects={projects}
          goals={goals}
          live={connection === "live"}
          onClose={() => setEditingTaskId(null)}
          onComplete={() => completeTask(editingTask.id)}
          onRestore={() => restoreTask(editingTask.id)}
          onChanged={(message) => {
            setEditingTaskId(null);
            setReloadKey((value) => value + 1);
            setToast(message);
          }}
        />
      )}

      {slotPicker && (() => {
        const slotDateValue = slotDate(weekStart, slotPicker.day, slotPicker.start);
        const end = slotPicker.start + slotPicker.duration;
        const slotLabel = `${slotDateValue.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })} · ${minutesToTime(slotPicker.start)}–${minutesToTime(end)}`;
        return (
          <CalendarQuickCreatePopover
            day={slotPicker.day}
            start={slotPicker.start}
            duration={slotPicker.duration}
            slotLabel={slotLabel}
            anchor={slotPicker.anchor}
            live={connection === "live"}
            tasks={tasks.map((task) => ({
              id: task.id,
              title: task.title,
              projectId: task.projectId,
              project: task.project,
              color: task.color,
              duration: task.duration,
              status: task.status,
              dueHorizon: task.dueHorizon,
            }))}
            projects={projects.map((project) => ({ id: project.id, title: project.title }))}
            onClose={() => setSlotPicker(null)}
            onPasteSession={async () => {
              if (!blockClipboard) {
                showToast("Nothing copied yet", "warning");
                return;
              }
              const day = slotPicker.day;
              const start = slotPicker.start;
              setSlotPicker(null);
              const task = tasks.find((item) => item.id === blockClipboard.taskId);
              if (!task || task.status === "done") {
                showToast("Copied task is missing or already done", "warning");
                return;
              }
              const pendingId = `pending-${crypto.randomUUID()}`;
              const block: CalendarBlock = {
                id: pendingId,
                title: blockClipboard.title || task.title,
                day,
                start,
                duration: blockClipboard.duration,
                color: priorityColor(task.priority),
                type: "task",
                taskId: task.id,
                projectId: task.projectId,
                meta: task.project,
                syncStatus: "PENDING",
                notes: blockClipboard.notes,
                status: "PLANNED",
              };
              setBlocks((current) => [...current, block]);
              setTasks((current) => current.map((item) =>
                item.id === task.id && item.status === "inbox"
                  ? { ...item, status: "scheduled" }
                  : item,
              ));
              showToast(liveDataRef.current ? "Pasting session…" : "Session pasted · demo mode");
              if (!liveDataRef.current) return;
              const startAt = slotDate(weekStart, day, start);
              const endAt = new Date(startAt.getTime() + blockClipboard.duration * 60_000);
              try {
                const saved = await createPlannerTimeBlock({
                  taskId: task.id,
                  projectId: task.projectId,
                  title: blockClipboard.title || task.title,
                  startAt: startAt.toISOString(),
                  endAt: endAt.toISOString(),
                  color: priorityColor(task.priority),
                  notes: blockClipboard.notes || undefined,
                });
                const mapped = timeBlockFromApi(saved, weekStart, projects);
                setBlocks((current) => current.map((item) => item.id === pendingId ? mapped : item));
                showToast("Session pasted for the same task");
              } catch {
                setBlocks((current) => current.filter((item) => item.id !== pendingId));
                showToast("Could not paste session", "warning");
              }
            }}
            onSaveExisting={async (taskId, note, duration) => {
              const task = tasks.find((item) => item.id === taskId);
              if (!task) return;
              const pendingId = `pending-${crypto.randomUUID()}`;
              const day = slotPicker.day;
              const start = slotPicker.start;
              setSlotPicker(null);
              await scheduleTaskAtSlot(task, day, start, pendingId, {
                duration,
                notes: note,
              });
            }}
            onSaveNew={async ({ title, projectId, duration, note }) => {
              const day = slotPicker.day;
              const start = slotPicker.start;
              const created = await addTask(title, duration, projectId);
              const pendingId = `pending-${crypto.randomUUID()}`;
              setSlotPicker(null);
              if (created) {
                await scheduleTaskAtSlot(created, day, start, pendingId, {
                  duration,
                  notes: note,
                });
              }
            }}
          />
        );
      })()}

      {blockPopover && (() => {
        const popBlock = blocks.find((block) => block.id === blockPopover.blockId);
        if (!popBlock) return null;
        const sessionDone = isSessionDone(popBlock.status);
        const taskDone = Boolean(popBlock.taskId && doneTaskIds.has(popBlock.taskId));
        if (popBlock.type === "external") {
          return (
            <GoogleEventPopover
              block={popBlock}
              anchor={blockPopover.rect}
              onClose={() => setBlockPopover(null)}
            />
          );
        }
        return (
          <PersonalOsBlockPopover
            block={popBlock}
            sessionDone={sessionDone}
            taskDone={taskDone}
            anchor={blockPopover.rect}
            onClose={() => setBlockPopover(null)}
            onToggleSessionDone={(done) => {
              void toggleSessionDone(popBlock.id, done);
            }}
            onSaveNotes={(notes) => {
              void (async () => {
                setBlocks((current) => current.map((block) =>
                  block.id === popBlock.id ? { ...block, notes } : block,
                ));
                if (!liveDataRef.current) return;
                if (popBlock.repeatSeriesId) {
                  setSeriesScopePrompt({
                    kind: "session",
                    id: popBlock.id,
                    payload: { notes },
                  });
                  return;
                }
                try {
                  const saved = await updateTimeBlock(popBlock.id, { notes });
                  const mapped = timeBlockFromApi(saved, weekStart, projects);
                  setBlocks((current) => current.map((block) => block.id === saved.id ? mapped : block));
                } catch {
                  showToast("Could not save session note", "warning");
                }
              })();
            }}
            onRepeatSession={popBlock.repeatSeriesId ? undefined : (weeks) => {
              void (async () => {
                if (!liveDataRef.current) {
                  showToast(`Repeat session · ${weeks} weeks · demo mode`);
                  return;
                }
                try {
                  await repeatSession(popBlock.id, { weeks });
                  setReloadKey((value) => value + 1);
                  showToast(`Session repeated for ${weeks} weeks`);
                } catch {
                  showToast("Could not repeat session", "warning");
                }
              })();
            }}
            onOpenTask={() => {
              if (popBlock.taskId) setEditingTaskId(popBlock.taskId);
            }}
            onUnschedule={() => {
              if (popBlock.repeatSeriesId) {
                setSessionDeleteConfirm({
                  blockId: popBlock.id,
                  title: popBlock.title,
                  repeated: true,
                });
                setBlockPopover(null);
                return;
              }
              void unscheduleBlock(popBlock.id);
              setBlockPopover(null);
            }}
            onRetrySync={
              popBlock.syncStatus === "FAILED"
                ? () => { void handleSyncNow(); }
                : undefined
            }
          />
        );
      })()}

      {sessionDeleteConfirm && (
        <DestructiveConfirmModal
          title={sessionDeleteConfirm.repeated ? "Remove repeated session" : "Remove session"}
          body={
            sessionDeleteConfirm.repeated
              ? `Remove “${sessionDeleteConfirm.title}” from the calendar.`
              : `Remove “${sessionDeleteConfirm.title}”?`
          }
          confirmLabel="Remove"
          showSeriesScope={sessionDeleteConfirm.repeated}
          onClose={() => setSessionDeleteConfirm(null)}
          onConfirm={async (scope) => {
            const target = sessionDeleteConfirm;
            setSessionDeleteConfirm(null);
            if (!liveDataRef.current) {
              setBlocks((current) => current.filter((block) => block.id !== target.blockId));
              showToast("Session removed · demo mode");
              return;
            }
            try {
              if (target.repeated && scope) {
                await deleteTimeBlock(target.blockId, { seriesScope: scope });
                setReloadKey((value) => value + 1);
                showToast(
                  scope === "THIS_AND_FUTURE"
                    ? "Removed this and future sessions"
                    : "Removed this session only",
                );
              } else {
                await unscheduleBlock(target.blockId);
              }
            } catch {
              showToast("Could not remove session", "warning");
            }
          }}
        />
      )}

      {seriesScopePrompt && (
        <SeriesScopeModal
          entityLabel={seriesScopePrompt.kind === "task" ? "task" : "session"}
          onClose={() => {
            seriesScopePrompt.onCancel?.();
            setSeriesScopePrompt(null);
          }}
          onChoose={(scope: ApiSeriesScope) => {
            const prompt = seriesScopePrompt;
            setSeriesScopePrompt(null);
            void (async () => {
              if (!liveDataRef.current) {
                showToast("Series edit · demo mode");
                return;
              }
              try {
                if (prompt.kind === "task") {
                  await updateTask(prompt.id, { ...prompt.payload, seriesScope: scope });
                } else {
                  await updateTimeBlock(prompt.id, { ...prompt.payload, seriesScope: scope });
                }
                setReloadKey((value) => value + 1);
                showToast(scope === "THIS_AND_FUTURE" ? "Updated this and future" : "Updated this instance only");
              } catch {
                prompt.onCancel?.();
                showToast("Could not apply series edit", "warning");
              }
            })();
          }}
        />
      )}

      {toast && (
        <div className={`toast ${toastKind === "warning" ? "warning" : ""}`} role="status">
          <CheckCircle2 size={18} /> {toast}
        </div>
      )}
      <AiContextEditor
        open={aiContextOpen}
        onClose={() => setAiContextOpen(false)}
        onSaved={(message) => setToast(message)}
      />
    </div>
  );
}

function CalendarEvent({
  block,
  done,
  sessionDone,
  layout,
  selected = false,
  onOpenTask,
  onResize,
  onSelect,
  onMoveCommit,
  onMovePreview,
  onToggleSessionDone,
}: {
  block: CalendarBlock;
  done: boolean;
  sessionDone: boolean;
  layout: { left: string; right: string };
  selected?: boolean;
  onOpenTask: (taskId: string) => void;
  onResize: (blockId: string, duration: number) => void;
  onSelect: (rect: DOMRect) => void;
  onMoveCommit: (blockId: string, day: number, start: number) => void;
  onMovePreview: (preview: { id: string; day: number; start: number } | null) => void;
  onToggleSessionDone?: (done: boolean) => void;
}) {
  const resizeStartRef = useRef<{ y: number; duration: number } | null>(null);
  const previewRef = useRef<number | null>(null);
  const [previewDuration, setPreviewDuration] = useState<number | null>(null);
  const moveRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originDay: number;
    originStart: number;
    duration: number;
    dragging: boolean;
    day: number;
    start: number;
  } | null>(null);
  const displayDuration = previewDuration ?? block.duration;
  const isExternal = block.type === "external";
  const isFailed = block.syncStatus === "FAILED";
  const isPending = block.syncStatus === "PENDING";
  const isTiny = displayDuration <= 20;
  const isCompact = displayDuration <= 35;
  const showTime = displayDuration >= 25;
  const showMeta = displayDuration >= 45;

  const snapStart = (raw: number) => {
    const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
    return Math.max(
      START_HOUR * 60,
      Math.min(END_HOUR * 60 - SNAP_MINUTES, snapped),
    );
  };

  const dayFromPoint = (clientX: number, clientY: number) => {
    const el = document.elementFromPoint(clientX, clientY);
    const track = el?.closest?.("[data-day-index]") as HTMLElement | null;
    if (!track) return null;
    const day = Number(track.dataset.dayIndex);
    return Number.isFinite(day) ? day : null;
  };

  const onResizePointerDown = (event: React.PointerEvent) => {
    if (block.type !== "task") return;
    event.stopPropagation();
    event.preventDefault();
    resizeStartRef.current = { y: event.clientY, duration: block.duration };

    const onMove = (moveEvent: PointerEvent) => {
      if (!resizeStartRef.current) return;
      const delta = moveEvent.clientY - resizeStartRef.current.y;
      const deltaMinutes = Math.round((delta / 60) / SNAP_MINUTES) * SNAP_MINUTES;
      const nextDuration = Math.max(
        SNAP_MINUTES,
        Math.min(MINUTES_VISIBLE, resizeStartRef.current.duration + deltaMinutes),
      );
      previewRef.current = nextDuration;
      setPreviewDuration(nextDuration);
    };
    const onUp = () => {
      const start = resizeStartRef.current;
      const finalDuration = previewRef.current;
      resizeStartRef.current = null;
      previewRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (start && finalDuration && finalDuration !== block.duration) {
        onResize(block.id, finalDuration);
      }
      setPreviewDuration(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onMovePointerDown = (event: React.PointerEvent) => {
    if (block.type !== "task" || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest(".event-complete")) return;
    if (target.closest(".event-resize-handle")) return;
    event.stopPropagation();
    moveRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originDay: block.day,
      originStart: block.start,
      duration: block.duration,
      dragging: false,
      day: block.day,
      start: block.start,
    };

    const onMove = (moveEvent: PointerEvent) => {
      const state = moveRef.current;
      if (!state || moveEvent.pointerId !== state.pointerId) return;
      // Completed sessions stay selectable but are not draggable.
      if (done) return;
      const dx = moveEvent.clientX - state.startX;
      const dy = moveEvent.clientY - state.startY;
      if (!state.dragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        state.dragging = true;
      }
      moveEvent.preventDefault();
      const day = dayFromPoint(moveEvent.clientX, moveEvent.clientY) ?? state.day;
      const track = document.querySelector(`[data-day-index="${day}"]`) as HTMLElement | null;
      const rect = track?.getBoundingClientRect();
      let nextStart = state.originStart;
      if (rect && rect.height > 0) {
        // Pointer-delta from original block top, not absolute cell Y under cursor.
        const originTopPx = ((state.originStart - START_HOUR * 60) / MINUTES_VISIBLE) * rect.height;
        const newTopPx = originTopPx + dy;
        const rawMinutes = START_HOUR * 60 + (newTopPx / rect.height) * MINUTES_VISIBLE;
        nextStart = snapStart(rawMinutes);
        // Keep end within day.
        nextStart = Math.min(nextStart, END_HOUR * 60 - state.duration);
        nextStart = Math.max(START_HOUR * 60, nextStart);
        nextStart = snapStart(nextStart);
      }
      state.day = day;
      state.start = nextStart;
      onMovePreview({ id: block.id, day, start: nextStart });
    };

    const onUp = (upEvent: PointerEvent) => {
      const state = moveRef.current;
      if (!state || upEvent.pointerId !== state.pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      moveRef.current = null;
      onMovePreview(null);
      if (!state.dragging) {
        const upTarget = upEvent.target as HTMLElement | null;
        if (upTarget?.closest?.(".event-complete")) return;
        const article = upTarget?.closest?.("article.calendar-event") as HTMLElement | null;
        if (article) onSelect(article.getBoundingClientRect());
        return;
      }
      if (state.day !== state.originDay || state.start !== state.originStart) {
        onMoveCommit(block.id, state.day, state.start);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <article
      className={[
        "calendar-event",
        block.type,
        done ? "done" : "",
        isFailed ? "sync-failed" : "",
        isPending ? "sync-pending" : "",
        selected ? "selected" : "",
        isTiny ? "tiny" : isCompact ? "compact" : "",
      ].filter(Boolean).join(" ")}
      data-sync={block.syncStatus?.toLowerCase()}
      role="button"
      tabIndex={0}
      aria-label={
        isExternal
          ? `${block.title}, Google Calendar, read-only`
          : done
            ? `${block.title}, completed`
            : block.title
      }
      title={
        isExternal
          ? "Google Calendar · read-only"
          : isFailed
            ? "Saved in Personal OS; Google Calendar sync failed"
            : undefined
      }
      style={{
        top: block.start - START_HOUR * 60 + 1,
        height: Math.max(isTiny ? 18 : 28, displayDuration - 2),
        left: layout.left,
        right: layout.right,
        "--event-color": block.color,
        touchAction: "none",
      } as React.CSSProperties}
      onPointerDown={onMovePointerDown}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          onSelect(event.currentTarget.getBoundingClientRect());
        }
      }}
      onDoubleClick={() => {
        if (block.taskId) onOpenTask(block.taskId);
      }}
    >
      <div className={`event-title-row${isTiny ? " inline" : ""}`}>
        {!isExternal && onToggleSessionDone && (
          <button
            type="button"
            className={`event-complete${sessionDone ? " checked" : ""}`}
            aria-label={sessionDone ? `Mark ${block.title} incomplete` : `Mark ${block.title} done`}
            onPointerDown={(event) => {
              event.stopPropagation();
              event.preventDefault();
            }}
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
              onToggleSessionDone(!sessionDone);
            }}
          >
            {sessionDone ? <CheckCircle2 size={10} aria-hidden="true" /> : null}
          </button>
        )}
        {isExternal && <LockKeyhole size={10} aria-hidden="true" />}
        {isFailed && <em className="sync-warning" aria-label="Sync failed">!</em>}
        <strong>{block.title}</strong>
      </div>
      {showTime && (
        <span className="event-time pos-mono">
          {isCompact
            ? minutesToTime(block.start)
            : `${minutesToTime(block.start)} · ${durationLabel(displayDuration)}`}
        </span>
      )}
      {showMeta && block.meta && <span className="event-meta">{block.meta}</span>}
      {isFailed && displayDuration >= 60 && (
        <span className="event-sync-note">Saved locally · sync failed</span>
      )}
      {block.type === "task" && !done && (
        <button
          type="button"
          className="event-resize-handle"
          aria-label={`Resize ${block.title}`}
          onPointerDown={onResizePointerDown}
        />
      )}
    </article>
  );
}

function MonthCalendar({
  cells,
  anchor,
  blocks,
  referenceStart,
  onOpenDay,
}: {
  cells: Date[];
  anchor: Date;
  blocks: CalendarBlock[];
  referenceStart: Date;
  onOpenDay: (date: Date) => void;
}) {
  const today = new Date();
  return (
    <div className="month-calendar pos-cal-month" aria-label="Month view">
      <div className="month-weekdays">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="month-grid">
        {cells.map((date) => {
          const dayIndex = dayIndexFor(date.toISOString(), referenceStart);
          const dayBlocks = blocks.filter((block) => block.day === dayIndex);
          const personal = dayBlocks.filter((block) => block.type === "task");
          const google = dayBlocks.filter((block) => block.type === "external");
          const inMonth = date.getMonth() === anchor.getMonth();
          const isToday = sameDay(date, today);
          const labels = personal.slice(0, 2);
          return (
            <button
              key={date.toISOString()}
              className={`month-cell ${inMonth ? "" : "muted"} ${isToday ? "today" : ""}`}
              onClick={() => onOpenDay(date)}
            >
              <div className="month-cell-head">
                <strong>{date.getDate()}</strong>
                <span className="month-density" aria-hidden="true">
                  {personal.length > 0 && <i className="os" />}
                  {google.length > 0 && <i className="gcal" />}
                </span>
              </div>
              <div className="month-events">
                {labels.map((block) => (
                  <span key={block.id} className="month-event-chip os" title={block.title}>
                    {block.title}
                  </span>
                ))}
                {google.length > 0 && labels.length === 0 && (
                  <span className="month-event-chip gcal">
                    {google.length} Google
                  </span>
                )}
                {dayBlocks.length > labels.length + (labels.length === 0 && google.length > 0 ? 1 : 0) && (
                  <small>+{dayBlocks.length - Math.max(labels.length, labels.length === 0 && google.length > 0 ? 1 : 0)} more</small>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div className="month-legend">
        <span><i className="os" /> Personal OS</span>
        <span><i className="gcal" /> Google Calendar</span>
        <em>Click a day to open Day view</em>
      </div>
    </div>
  );
}

function TaskPanel({
  tasks,
  count,
  filter,
  search,
  searchRef,
  onSearch,
  onFilter,
  onClose,
  onQuickAdd,
  onDragStart,
  onComplete,
  onRestore,
  onPriorityChange: _onPriorityChange,
  onOpenTask,
  onDropBlock,
}: {
  tasks: PlannerTask[];
  count: number;
  filter: "inbox" | "today";
  search: string;
  searchRef: React.RefObject<HTMLInputElement | null>;
  onSearch: (value: string) => void;
  onFilter: (value: "inbox" | "today") => void;
  onClose: () => void;
  onQuickAdd: () => void;
  onDragStart: (event: React.DragEvent, payload: DragPayload) => void;
  onComplete: (taskId: string) => void;
  onRestore: (taskId: string) => void;
  onPriorityChange: (taskId: string, priority: TaskPriority) => void;
  onOpenTask: (taskId: string) => void;
  onDropBlock: (event: React.DragEvent) => void;
}) {
  const [dropActive, setDropActive] = useState(false);

  const onDragOver = (event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes("application/x-personal-os")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropActive(true);
  };

  const onDragLeave = (event: React.DragEvent) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDropActive(false);
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDropActive(false);
    onDropBlock(event);
  };

  return (
    <aside
      className={`task-panel pos-cal-side ${dropActive ? "drop-target" : ""}`}
      aria-label={filter === "today" ? "Today's work" : "Unscheduled work"}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dropActive && (
        <div className="pos-cal-unschedule-banner" role="status">
          <strong>Remove from Calendar</strong>
          <span>Task will remain in Tasks</span>
        </div>
      )}
      <div className="task-panel-header">
        <div className="task-tabs" role="tablist" aria-label="Calendar side panel">
          <button
            type="button"
            role="tab"
            aria-selected={filter === "today"}
            className={filter === "today" ? "active" : ""}
            onClick={() => onFilter("today")}
          >
            Today
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "inbox"}
            className={filter === "inbox" ? "active" : ""}
            onClick={() => onFilter("inbox")}
          >
            Inbox
            {count > 0 && <span className="pos-mono pos-cal-side-count">{count}</span>}
          </button>
        </div>
        <button className="icon-button" aria-label="Close task panel" onClick={onClose}><X size={16} /></button>
      </div>

      <button className="quick-capture" onClick={onQuickAdd}>
        <span><Plus size={15} /> Add task</span>
        <kbd>⌘ K</kbd>
      </button>

      <label className="task-search">
        <Search size={14} />
        <input ref={searchRef} value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search tasks" />
      </label>

      <div className="drag-hint">
        <GripVertical size={14} />
        {filter === "today"
          ? "Drag onto free time to schedule"
          : "Drag onto the grid to schedule · drop here to unschedule"}
      </div>

      <div className="task-list">
        {tasks.map((task) => {
          const priority = priorityMeta(task.priority);
          return (
          <article
            className={`task-card${task.status === "done" ? " done" : ""}`}
            key={task.id}
            draggable={task.status !== "done"}
            onDragStart={(event) => onDragStart(event, { kind: "task", taskId: task.id })}
            style={{ "--priority-color": priority.color } as React.CSSProperties}
          >
            <button
              className="task-check"
              onClick={() => task.status === "done" ? onRestore(task.id) : onComplete(task.id)}
              aria-label={task.status === "done" ? `Restore ${task.title}` : `Complete ${task.title}`}
            >
              {task.status === "done" ? <CheckCircle2 size={16} /> : <Circle size={16} />}
            </button>
            <div className="task-content">
              <button className="task-title-button" type="button" onClick={() => onOpenTask(task.id)}>
                {task.title}
              </button>
              <div className="task-meta">
                <span className="task-project"><i style={{ background: task.color }} />{task.project}</span>
                <span className="pos-mono">Est. effort {durationLabel(task.duration)}</span>
              </div>
            </div>
            {task.status !== "done" && <GripVertical className="drag-handle" size={15} />}
          </article>
          );
        })}

        {tasks.length === 0 && (
          <div className="empty-tasks">
            <strong>{filter === "today" ? "Nothing for today yet" : "Inbox is clear"}</strong>
            <span>
              {filter === "today"
                ? "Drag from Inbox or add a task to protect time."
                : "Capture something new or enjoy the open time."}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}

function WeekRangeField({
  labelClass,
  rangeText,
  value,
  onChange,
}: {
  labelClass?: string;
  rangeText: string;
  value: Date;
  onChange: (value: Date) => void;
}) {
  const selectedStart = startOfWeek(value);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(value));
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const weeks = useMemo(() => {
    const days = monthGridDays(month);
    return Array.from({ length: 6 }, (_, index) => days.slice(index * 7, index * 7 + 7));
  }, [month]);

  useEffect(() => {
    if (!open) return;
    setMonth(startOfMonth(value));
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const height = 312;
      const top = rect.bottom + height > window.innerHeight - 12
        ? Math.max(12, rect.top - height - 6)
        : rect.bottom + 6;
      const left = Math.min(rect.left, window.innerWidth - 268);
      setCoords({ top, left: Math.max(12, left) });
    };
    place();
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", place);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", place);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, value]);

  const pickWeek = (day: Date) => {
    onChange(startOfWeek(day));
    setOpen(false);
  };

  return (
    <div className="week-range-field" ref={rootRef}>
      <span className={labelClass}>Week</span>
      <button
        ref={buttonRef}
        type="button"
        className={`week-range-control${open ? " open" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Week ${rangeText}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="week-range-display">{rangeText}</span>
      </button>
      {open && (
        <div className="week-picker" role="dialog" aria-label="Choose a week" style={{ top: coords.top, left: coords.left }}>
          <div className="week-picker-header">
            <strong>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong>
            <div className="pager">
              <button type="button" aria-label="Previous month" onClick={() => setMonth(startOfMonth(addDays(month, -1)))}>
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => {
                  const next = new Date(month);
                  next.setMonth(next.getMonth() + 1);
                  setMonth(startOfMonth(next));
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="week-picker-weekdays" aria-hidden="true">
            {["M", "T", "W", "T", "F", "S", "S"].map((label, index) => (
              <span key={`${label}-${index}`}>{label}</span>
            ))}
          </div>
          <div className="week-picker-grid">
            {weeks.map((week) => {
              const start = week[0]!;
              const selected = start.getTime() === selectedStart.getTime();
              const isCurrent = start.getTime() === startOfWeek(new Date()).getTime();
              return (
                <button
                  key={start.toISOString()}
                  type="button"
                  className={`week-picker-row${selected ? " selected" : ""}${isCurrent ? " current" : ""}`}
                  onClick={() => pickWeek(start)}
                >
                  {week.map((day) => (
                    <span
                      key={day.toISOString()}
                      className={`week-picker-day${day.getMonth() !== month.getMonth() ? " muted" : ""}${sameDay(day, new Date()) ? " today" : ""}`}
                    >
                      {day.getDate()}
                    </span>
                  ))}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="week-picker-this"
            onClick={() => pickWeek(new Date())}
          >
            This week
          </button>
        </div>
      )}
    </div>
  );
}

function PeriodFields({
  horizon,
  value,
  onChange,
  compact = false,
}: {
  horizon: "day" | "week" | "month";
  value: Date;
  onChange: (value: Date) => void;
  compact?: boolean;
}) {
  const weekStart = startOfWeek(value);
  const weekEnd = addDays(weekStart, 6);
  const labelClass = compact ? "sr-only" : undefined;

  if (horizon === "month") {
    return (
      <label>
        <span className={labelClass}>Month</span>
        <input
          type="month"
          value={monthInputValue(value)}
          onChange={(event) => {
            if (!event.target.value) return;
            onChange(parseMonthInput(event.target.value));
          }}
        />
      </label>
    );
  }

  if (horizon === "week") {
    const rangeText = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
    return (
      <WeekRangeField
        labelClass={labelClass}
        rangeText={rangeText}
        value={weekStart}
        onChange={onChange}
      />
    );
  }

  return (
    <label>
      <span className={labelClass}>Date</span>
      <input
        type="date"
        value={localDateInput(value)}
        onChange={(event) => {
          if (!event.target.value) return;
          onChange(parseLocalDateInput(event.target.value));
        }}
      />
    </label>
  );
}

function TasksWorkspace({
  tasks,
  blocks,
  projects,
  weekStart,
  now,
  horizon,
  anchor,
  selectedTaskId = null,
  searchInputRef,
  onHorizonChange,
  onAnchorChange,
  onQuickAdd,
  onOpenTask,
  onComplete,
  onRestore,
}: {
  tasks: PlannerTask[];
  blocks: CalendarBlock[];
  projects: ProjectOption[];
  weekStart: Date;
  now: Date;
  horizon: HorizonScope;
  anchor: Date;
  selectedTaskId?: string | null;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  onHorizonChange: (value: HorizonScope) => void;
  onAnchorChange: (value: Date) => void;
  onQuickAdd: () => void;
  onOpenTask: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  onRestore: (taskId: string) => void;
}) {
  const [showCompleted, setShowCompleted] = useState(false);
  const [projectFilterId, setProjectFilterId] = useState<string | "all">("all");
  const [query, setQuery] = useState("");
  const today = startOfDay(now);
  const viewingToday = sameDay(anchor, now);
  const viewingThisWeek = startOfWeek(anchor).getTime() === startOfWeek(now).getTime();
  const viewingThisMonth = startOfMonth(anchor).getTime() === startOfMonth(now).getTime();
  const normalizedQuery = query.trim().toLowerCase();

  const scoped = tasks.filter((task) => taskBelongsToHorizon(task, horizon, anchor, blocks, weekStart, now));
  const visible = scoped
    .filter((task) => {
      if (!showCompleted && task.status === "done") return false;
      if (projectFilterId !== "all") {
        if (projectFilterId === "inbox") {
          if (task.projectId !== null) return false;
        } else if (task.projectId !== projectFilterId) {
          return false;
        }
      }
      if (!normalizedQuery) return true;
      return `${task.title} ${task.notes} ${task.project}`.toLowerCase().includes(normalizedQuery);
    })
    .sort((left, right) => {
      const byDone = Number(left.status === "done") - Number(right.status === "done");
      if (byDone !== 0) return byDone;
      const byPriority = priorityRank(left.priority) - priorityRank(right.priority);
      if (byPriority !== 0) return byPriority;
      return (left.dueAt ? new Date(left.dueAt).getTime() : Number.MAX_SAFE_INTEGER)
        - (right.dueAt ? new Date(right.dueAt).getTime() : Number.MAX_SAFE_INTEGER);
    });

  const scheduleCopy = (task: PlannerTask, block?: CalendarBlock) => {
    if (task.status === "done") {
      return block ? scheduleLabel(block) : "Done";
    }
    const taskBlocks = blocks.filter((candidate) => candidate.type === "task" && candidate.taskId === task.id);
    if ((horizon === "week" || horizon === "month") && taskBlocks.length > 0) {
      const progress = deriveTaskProgressFromSessions(
        taskBlocks.map((item) => ({ id: item.id, status: item.status ?? "PLANNED" })),
      );
      return formatSessionProgressLabel(progress);
    }
    const aggregate = aggregateTaskSchedule(task.id, blocks.filter((candidate) => candidate.type === "task"));
    if ((horizon === "week" || horizon === "month") && aggregate.sessionCount > 0) {
      return `${aggregate.sessionCount} session${aggregate.sessionCount === 1 ? "" : "s"} · ${formatScheduledMinutes(aggregate.totalScheduledMinutes)} scheduled`;
    }
    if (block) return scheduleLabel(block);
    if (task.status === "scheduled") return "Scheduled";
    return "";
  };

  const periodLabelForTask = (task: PlannerTask) => {
    const dueHorizon = taskDueHorizon(task);
    const overdue = Boolean(
      task.dueAt
      && dueHorizon === "day"
      && new Date(task.dueAt) < today
      && task.status !== "done",
    );
    if (overdue) {
      return `Overdue${task.due ? ` · ${task.due}` : ""}`;
    }
    if (dueHorizon === "day") {
      return task.due ? `Due ${task.due}` : (dueLabel(task.dueAt, "day") ?? "Day");
    }
    if (dueHorizon === "week") {
      return horizonLabel(task.dueAt, "week") ?? "This week";
    }
    if (dueHorizon === "month") {
      const month = horizonLabel(task.dueAt, "month") ?? "This month";
      return `${month} · No specific day`;
    }
    return null;
  };

  const shiftAnchor = (amount: number) => {
    if (horizon === "week") {
      onAnchorChange(addDays(anchor, amount * 7));
      return;
    }
    if (horizon === "month") {
      const next = new Date(anchor);
      next.setMonth(next.getMonth() + amount);
      onAnchorChange(startOfDay(next));
      return;
    }
    onAnchorChange(addDays(anchor, amount));
  };

  const canJumpCurrent = horizon !== "all" && !(
    horizon === "day" ? viewingToday : horizon === "week" ? viewingThisWeek : viewingThisMonth
  );

  const footerHint = horizon === "week"
    ? "WEEK tasks belong to this week — no specific day until scheduled. DAY tasks have a real due date. Unscheduled ≠ deleted."
    : horizon === "month"
      ? "MONTH tasks are planning inventory — not due on the 1st. Assign week or calendar time when ready."
      : horizon === "day"
        ? "Showing DAY tasks for this date and calendar blocks on this day. WEEK tasks appear only when scheduled here."
        : undefined;

  return (
    <div className="tasks-workspace" data-task-project-filter="task-project-filter">
      <TasksWorkspaceView
        horizon={horizon}
        periodCaption={horizon === "all" ? "All tasks" : horizonCaption(horizon, anchor)}
        onHorizonChange={onHorizonChange}
        tasks={visible}
        blocks={blocks}
        projects={projects}
        showCompleted={showCompleted}
        onShowCompleted={setShowCompleted}
        query={query}
        onQuery={setQuery}
        searchInputRef={searchInputRef}
        projectFilterId={projectFilterId}
        onProjectFilter={setProjectFilterId}
        selectedTaskId={selectedTaskId}
        onAdd={onQuickAdd}
        onOpenTask={onOpenTask}
        onComplete={onComplete}
        onRestore={onRestore}
        onPrevPeriod={horizon === "all" ? undefined : () => shiftAnchor(-1)}
        onNextPeriod={horizon === "all" ? undefined : () => shiftAnchor(1)}
        onJumpCurrent={canJumpCurrent ? () => onAnchorChange(startOfDay(now)) : undefined}
        canJumpCurrent={canJumpCurrent}
        jumpCurrentLabel={horizon === "week" ? "This week" : horizon === "month" ? "This month" : "Today"}
        periodControl={horizon === "all" ? undefined : (
          <PeriodFields horizon={horizon} value={anchor} onChange={onAnchorChange} compact />
        )}
        footerHint={footerHint}
        today={today}
        getHorizon={(task) => taskDueHorizon(task as PlannerTask)}
        getScheduleLabel={(task, block) => scheduleCopy(task as PlannerTask, block as CalendarBlock | undefined)}
        getHorizonLabel={(task) => periodLabelForTask(task as PlannerTask)}
        isOverdue={(task) => Boolean(
          task.dueAt
          && taskDueHorizon(task as PlannerTask) === "day"
          && new Date(task.dueAt) < today
          && task.status !== "done",
        )}
      />
    </div>
  );
}

function TaskEditor({
  task,
  projects,
  goals,
  live,
  onClose,
  onComplete,
  onRestore,
  onChanged,
}: {
  task: PlannerTask;
  projects: ProjectOption[];
  goals: ApiGoal[];
  live: boolean;
  onClose: () => void;
  onComplete?: () => void;
  onRestore?: () => void;
  onChanged: (message: string) => void;
}) {
  const suggestedStart = defaultScheduleStart();
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [projectId, setProjectId] = useState<string | null>(task.projectId);
  const [goalId, setGoalId] = useState<string | null>(task.goalId ?? null);
  const [goalProcessId, setGoalProcessId] = useState<string | null>(task.goalProcessId ?? null);
  const [dueDate, setDueDate] = useState(dateInputValue(task.dueAt));
  const [dueScope, setDueScope] = useState<"none" | "day" | "week" | "month">(task.dueHorizon ?? "none");
  const [duration, setDuration] = useState(task.duration);
  const [sessionDuration, setSessionDuration] = useState(30);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [taskBlocks, setTaskBlocks] = useState<ApiTimeBlock[]>([]);
  const [scheduleDate, setScheduleDate] = useState(dateInputValue(suggestedStart.toISOString()));
  const [scheduleTime, setScheduleTime] = useState(timeInputValue(suggestedStart.toISOString()));
  const [loadingSchedule, setLoadingSchedule] = useState(live);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [repeatWeeks, setRepeatWeeks] = useState("8");
  const [pendingSeriesSave, setPendingSeriesSave] = useState<{ schedule: boolean } | null>(null);
  const [repeatSummary, setRepeatSummary] = useState<ApiTaskRepeatSummary | null>(null);
  const [editRepeatOpen, setEditRepeatOpen] = useState(false);
  const [editRepeatSaving, setEditRepeatSaving] = useState(false);
  const [editRepeatError, setEditRepeatError] = useState<string | null>(null);
  const scheduledBlock = taskBlocks[0];
  const sessionProgress = deriveTaskProgressFromSessions(
    taskBlocks.map((block) => ({ id: block.id, status: block.status ?? "PLANNED" })),
  );
  const completePolicyRaw = directTaskCompletePolicy(
    taskBlocks.map((block) => ({ id: block.id, status: block.status ?? "PLANNED" })),
  );
  const completePolicy = completePolicyRaw.allow
    ? "allow" as const
    : completePolicyRaw.reason === "ZERO_SESSIONS"
      ? "zero" as const
      : "multi" as const;
  const selectedProject = projects.find((project) => project.id === projectId);
  const effectiveGoalId = goalId ?? selectedProject?.goalId ?? null;
  const selectedGoal = goals.find((goal) => goal.id === effectiveGoalId);
  const goalProcesses = (selectedGoal?.processes ?? []).filter((process) => process.active);
  const inherited = Boolean(
    goalProcessId
    && selectedProject?.defaultGoalProcessId
    && goalProcessId === selectedProject.defaultGoalProcessId,
  );
  const inheritedProcess = goalProcesses.find((process) => process.id === goalProcessId);

  useEffect(() => {
    if (!live) {
      queueMicrotask(() => setLoadingSchedule(false));
      return;
    }
    const controller = new AbortController();
    fetchTaskTimeBlocks(task.id, controller.signal)
      .then((items) => {
        setTaskBlocks(items);
        if (items[0]) {
          setScheduleDate(dateInputValue(items[0].startAt));
          setScheduleTime(timeInputValue(items[0].startAt));
          setSessionDuration(Math.max(5, Math.round((new Date(items[0].endAt).getTime() - new Date(items[0].startAt).getTime()) / 60_000)));
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("Could not load this task's schedule.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingSchedule(false);
      });
    return () => controller.abort();
  }, [live, task.id]);

  useEffect(() => {
    if (!live || !task.repeatSeriesId) {
      setRepeatSummary(null);
      return;
    }
    let cancelled = false;
    fetchTaskRepeatSummary(task.id)
      .then((summary) => {
        if (!cancelled) setRepeatSummary(summary);
      })
      .catch(() => {
        if (!cancelled) setRepeatSummary(null);
      });
    return () => { cancelled = true; };
  }, [live, task.id, task.repeatSeriesId]);

  const duePayload = (pinDate?: Date) => {
    if (pinDate) {
      const period = duePeriodForDate(pinDate, "day");
      return { dueAt: period.dueAt, dueHorizon: dueHorizonToApi(period.dueHorizon) };
    }
    if (dueScope === "none" || !dueDate) {
      return { dueAt: null as string | null, dueHorizon: null };
    }
    const period = duePeriodForDate(new Date(`${dueDate}T12:00:00`), dueScope);
    return { dueAt: period.dueAt, dueHorizon: dueHorizonToApi(period.dueHorizon) };
  };

  const taskPayload = (pinDate?: Date) => ({
    title: title.trim(),
    notes: notes.trim(),
    projectId,
    goalId: effectiveGoalId,
    goalProcessId,
    ...duePayload(pinDate),
    durationMinutes: duration,
    priority: priorityToApi(priority),
  });

  const persistTask = async (schedule: boolean, seriesScope?: ApiSeriesScope) => {
    setSaving(true);
    setError(null);
    if (!live) {
      onChanged(schedule ? "Task scheduled · demo mode" : "Task updated · demo mode");
      return;
    }
    try {
      const startAt = schedule ? scheduleStart(scheduleDate, scheduleTime) : undefined;
      const payload = {
        ...taskPayload(),
        ...(seriesScope ? { seriesScope } : {}),
      };
      await updateTask(task.id, payload);
      if (startAt) {
        const endAt = new Date(startAt.getTime() + sessionDuration * 60_000);
        await createPlannerTimeBlock({
          taskId: task.id,
          projectId,
          title: title.trim(),
          color: priorityColor(priority),
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          ...(seriesScope ? { seriesScope } : {}),
        });
      }
      onChanged(schedule
        ? "Task saved and synced to Google Calendar"
        : "Task details updated");
    } catch {
      setSaving(false);
      setError("Could not save these changes. Please try again.");
    }
  };

  const saveTask = async (schedule: boolean) => {
    if (!title.trim()) {
      setError("Task title cannot be empty.");
      return;
    }
    if (schedule && (!scheduleDate || !scheduleTime)) {
      setError("Choose a date and time before scheduling.");
      return;
    }
    if (task.repeatSeriesId) {
      setPendingSeriesSave({ schedule });
      return;
    }
    await persistTask(schedule);
  };

  const runRepeatTask = async () => {
    const weeks = Math.max(1, Math.min(52, Number(repeatWeeks) || 8));
    setSaving(true);
    setError(null);
    if (!live) {
      onChanged(`Repeat task · ${weeks} weeks · demo mode`);
      return;
    }
    try {
      await repeatTask(task.id, { weeks });
      onChanged(`Task repeated for ${weeks} weeks`);
    } catch {
      setSaving(false);
      setError("Could not repeat this task.");
    }
  };

  const unscheduleTask = async () => {
    setSaving(true);
    setError(null);
    if (!live) {
      onChanged("Unschedule · demo mode");
      return;
    }
    try {
      await Promise.all(taskBlocks.map((block) => deleteTimeBlock(block.id)));
      await updateTask(task.id, { status: "INBOX" });
      onChanged("Unschedule complete — planning period kept");
    } catch {
      setSaving(false);
      setError("Could not remove this task from the calendar.");
    }
  };

  const removeTask = async (scope: ApiSeriesScope | null) => {
    setDeleteSaving(true);
    setError(null);
    if (!live) {
      setConfirmDeleteOpen(false);
      onChanged("Task deleted · demo mode");
      return;
    }
    try {
      await deletePlannerTask(
        task.id,
        scope ? { seriesScope: scope } : undefined,
      );
      setConfirmDeleteOpen(false);
      onChanged(
        scope === "THIS_AND_FUTURE"
          ? "This and future tasks deleted"
          : "Task and its calendar blocks deleted",
      );
    } catch {
      setDeleteSaving(false);
      setError("Could not delete this task. Please try again.");
    }
  };

  const scheduleDisplay = scheduledBlock
    ? (() => {
      const start = new Date(scheduledBlock.startAt);
      const end = new Date(scheduledBlock.endAt);
      const day = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const fmt = (date: Date) => date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      return `${day} · ${fmt(start)}–${fmt(end)}`;
    })()
    : null;

  const goalOptions = goals.map((goal) => ({
    id: goal.id,
    title: goal.title,
    outcome: goal.outcome,
    status: goal.status,
    processes: (goal.processes ?? []).map((process) => ({
      id: process.id,
      name: process.name,
      active: process.active,
    })),
  }));

  return (
    <>
    <TaskEditorView
      title={title}
      onTitleChange={setTitle}
      notes={notes}
      onNotesChange={setNotes}
      status={task.status}
      scheduled={taskBlocks.length > 0}
      scheduleDisplay={scheduleDisplay}
      workSessions={taskBlocks}
      sessionProgressLabel={formatSessionProgressLabel(sessionProgress)}
      completePolicy={completePolicy}
      showRepeatTask={!task.repeatSeriesId}
      repeatWeeks={repeatWeeks}
      onRepeatWeeksChange={setRepeatWeeks}
      onRepeatTask={() => { void runRepeatTask(); }}
      repeatSummaryLabel={repeatSummary
        ? `Weekly · ${repeatSummary.weekCount} weeks${
          repeatSummary.startsAt && repeatSummary.endsAt
            ? ` · ${new Date(repeatSummary.startsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(repeatSummary.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
            : ""
        }`
        : task.repeatSeriesId
          ? "Weekly series"
          : null}
      onEditRepeat={task.repeatSeriesId ? () => setEditRepeatOpen(true) : undefined}
      projectId={projectId}
      onProjectChange={(nextProjectId) => {
        const nextProject = projects.find((project) => project.id === nextProjectId);
        setProjectId(nextProjectId);
        setGoalId(nextProject?.goalId ?? null);
        setGoalProcessId(nextProject?.defaultGoalProcessId ?? null);
      }}
      projects={projects}
      goalId={effectiveGoalId}
      onGoalChange={(nextGoalId) => {
        setGoalId(nextGoalId);
        setGoalProcessId(null);
      }}
      goals={goalOptions}
      goalProcessId={goalProcessId}
      onGoalProcessChange={setGoalProcessId}
      inherited={inherited}
      inheritedProcessLabel={inheritedProcess?.name ?? null}
      inheritedFromProjectTitle={selectedProject?.title ?? null}
      forScope={dueScope}
      onForScopeChange={(scope) => {
        setDueScope(scope);
        if (scope !== "none" && !dueDate) setDueDate(dateInputValue(new Date().toISOString()));
      }}
      forDate={dueDate}
      onForDateChange={setDueDate}
      priority={priority}
      onPriorityChange={setPriority}
      duration={duration}
      onDurationChange={setDuration}
      sessionDuration={sessionDuration}
      onSessionDurationChange={setSessionDuration}
      scheduleDate={scheduleDate}
      onScheduleDateChange={setScheduleDate}
      scheduleTime={scheduleTime}
      onScheduleTimeChange={setScheduleTime}
      syncStatus={scheduledBlock?.syncStatus ?? null}
      syncMessage={
        scheduledBlock?.syncStatus === "FAILED"
          ? "Google Calendar sync failed for this block."
          : scheduledBlock?.syncStatus === "PENDING"
            ? "Waiting to sync with Google Calendar."
            : null
      }
      loadingSchedule={loadingSchedule}
      saving={saving}
      error={error}
      onComplete={completePolicy === "allow" ? onComplete : undefined}
      onRestore={onRestore}
      onUnschedule={scheduledBlock ? unscheduleTask : undefined}
      onDelete={() => setConfirmDeleteOpen(true)}
      onSaveDetails={() => saveTask(false)}
      onSchedule={() => saveTask(true)}
      onClose={onClose}
    />
    {confirmDeleteOpen && (
      <DestructiveConfirmModal
        title={task.repeatSeriesId ? "Delete repeated task" : "Delete task"}
        body={
          task.repeatSeriesId
            ? `Delete “${title.trim() || task.title}” from this series.`
            : `Delete “${title.trim() || task.title}”?`
        }
        confirmLabel="Delete"
        showSeriesScope={Boolean(task.repeatSeriesId)}
        saving={deleteSaving}
        onClose={() => {
          if (!deleteSaving) setConfirmDeleteOpen(false);
        }}
        onConfirm={(scope) => {
          void removeTask(scope);
        }}
      />
    )}
    {pendingSeriesSave && (
      <SeriesScopeModal
        entityLabel="task"
        saving={saving}
        onClose={() => setPendingSeriesSave(null)}
        onChoose={(scope) => {
          const pending = pendingSeriesSave;
          setPendingSeriesSave(null);
          void persistTask(pending.schedule, scope);
        }}
      />
    )}
    {editRepeatOpen && (
      <EditRepeatModal
        weekCount={repeatSummary?.weekCount ?? (Number(repeatWeeks) || 8)}
        rangeLabel={
          repeatSummary?.startsAt && repeatSummary?.endsAt
            ? `${new Date(repeatSummary.startsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(repeatSummary.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
            : "Current series"
        }
        saving={editRepeatSaving}
        error={editRepeatError}
        onClose={() => { if (!editRepeatSaving) setEditRepeatOpen(false); }}
        onSave={async (weeks) => {
          setEditRepeatSaving(true);
          setEditRepeatError(null);
          try {
            if (!live) {
              onChanged(`Repeat updated · ${weeks} weeks · demo mode`);
              setEditRepeatOpen(false);
              return;
            }
            await updateTaskRepeat(task.id, { weeks });
            const summary = await fetchTaskRepeatSummary(task.id);
            setRepeatSummary(summary);
            setEditRepeatOpen(false);
            onChanged("Repeat series updated");
          } catch {
            setEditRepeatError("Could not update this repeat series.");
          } finally {
            setEditRepeatSaving(false);
          }
        }}
        onStopAfterThis={async () => {
          setEditRepeatSaving(true);
          setEditRepeatError(null);
          try {
            if (!live) {
              onChanged("Stopped repeating after this instance · demo mode");
              setEditRepeatOpen(false);
              return;
            }
            await updateTaskRepeat(task.id, { stopAfterThis: true });
            setRepeatSummary(null);
            setEditRepeatOpen(false);
            onChanged("Stopped repeating after this instance");
          } catch {
            setEditRepeatError("Could not stop this repeat series.");
          } finally {
            setEditRepeatSaving(false);
          }
        }}
      />
    )}
    </>
  );
}

function QuickAdd({
  projects,
  scope,
  anchor,
  onClose,
  onAdd,
}: {
  projects: ProjectOption[];
  scope: HorizonScope | null;
  anchor: Date;
  onClose: () => void;
  onAdd: (
    title: string,
    duration: number,
    projectId: string | null,
    priority: TaskPriority,
    scope: HorizonScope | null,
    when: Date,
    repeatWeeks?: number | null,
  ) => void;
}) {
  const defaultHorizon: Exclude<HorizonScope, "all"> =
    scope === "week" || scope === "month" || scope === "day" ? scope : "day";
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(30);
  const [projectId, setProjectId] = useState<string | null>(projects[0]?.id ?? null);
  const [priority, setPriority] = useState<TaskPriority>("p2");
  const [horizon, setHorizon] = useState<Exclude<HorizonScope, "all">>(defaultHorizon);
  const [when, setWhen] = useState(() => startOfDay(anchor));
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [repeatWeeks, setRepeatWeeks] = useState("8");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError(null);
    const weeks = horizon === "week" && repeatWeekly
      ? Math.max(1, Math.min(52, Number(repeatWeeks) || 8))
      : null;
    onAdd(title.trim(), duration, projectId, priority, horizon, when, weeks);
  };

  return (
    <QuickAddView
      title={title}
      onTitleChange={setTitle}
      projectId={projectId}
      onProjectChange={setProjectId}
      projects={projects}
      forHorizon={horizon}
      onForHorizonChange={setHorizon}
      duration={duration}
      onDurationChange={setDuration}
      priority={priority}
      onPriorityChange={setPriority}
      periodControl={<PeriodFields horizon={horizon} value={when} onChange={setWhen} />}
      contextHint={captureHint(horizon, when)}
      repeatWeekly={repeatWeekly}
      onRepeatWeeklyChange={setRepeatWeekly}
      repeatWeeks={repeatWeeks}
      onRepeatWeeksChange={setRepeatWeeks}
      saving={saving}
      error={error}
      onSubmit={submit}
      onClose={onClose}
    />
  );
}

function PriorityPicker({
  value,
  onChange,
  compact = false,
}: {
  value: TaskPriority;
  onChange: (value: TaskPriority) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`priority-picker${compact ? " compact" : ""}`}
      role="group"
      aria-label="Priority"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {PRIORITY_LEVELS.map((level) => (
        <button
          key={level.id}
          type="button"
          className={value === level.id ? "active" : ""}
          style={{ "--priority-color": level.color } as React.CSSProperties}
          aria-label={`${level.label}: ${level.hint}`}
          title={`${level.label} · ${level.hint}`}
          onClick={(event) => {
            event.stopPropagation();
            onChange(level.id);
          }}
        >
          <i />
          {!compact && (
            <span>
              <strong>{level.label}</strong>
              <small>{level.hint}</small>
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
