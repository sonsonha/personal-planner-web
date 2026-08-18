"use client";

import {
  Bell,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Command,
  Crosshair,
  Flag,
  FileText,
  FolderKanban,
  GripVertical,
  ListTodo,
  LockKeyhole,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Save,
  Search,
  Settings,
  Sparkles,
  Target,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createTask as createPlannerTask,
  createTimeBlock as createPlannerTimeBlock,
  deleteTask as deletePlannerTask,
  deleteTimeBlock,
  fetchGoogleIntegration,
  fetchPlanner,
  fetchTaskTimeBlocks,
  getGoogleAuthUrl,
  PlannerApiError,
  updateTask,
  updateTimeBlock,
  syncGoogleCalendar,
  type CalendarSyncSummary,
  type ApiExternalEvent,
  type ApiGoal,
  type ApiProject,
  type ApiTask,
  type ApiTimeBlock,
} from "@/lib/planner-api";
import { GoalsWorkspace, ProjectsWorkspace } from "./planner-workspaces";

type TaskStatus = "inbox" | "scheduled" | "done";

type PlannerTask = {
  id: string;
  title: string;
  notes: string;
  projectId: string | null;
  project: string;
  color: string;
  duration: number;
  priority: "high" | "normal" | "low";
  status: TaskStatus;
  dueAt: string | null;
  due?: string;
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
};

type ProjectOption = { id: string | null; title: string; color: string };
type ConnectionState = "loading" | "syncing" | "live" | "demo" | "error";
type GoogleConnectionState = "loading" | "connected" | "not-connected" | "syncing" | "error";
type ActiveSection = "calendar" | "tasks" | "projects" | "goals";
type CalendarView = "week" | "day" | "month";
type ToastKind = "info" | "warning";
type SlotPicker = { day: number; start: number };

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
const SNAP_MINUTES = 15;
const AUTO_SYNC_INTERVAL_MS = 5 * 60_000;
const AUTO_SYNC_MIN_GAP_MS = 30_000;
const COLORS = {
  violet: "#705CF6",
  blue: "#3478F6",
  coral: "#FA5D73",
  cyan: "#11B8C7",
  amber: "#F3A712",
};

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
    priority: "high",
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
    priority: "normal",
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
    priority: "high",
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
    priority: "normal",
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
    priority: "normal",
    status: "inbox",
    dueAt: null,
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

function dueLabel(value: string | null) {
  if (!value) return undefined;
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
      .map((project) => ({ id: project.id, title: project.title, color: project.color })),
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
    project: project.title,
    color: project.color,
    duration: task.durationMinutes,
    priority: task.priority === "HIGH" ? "high" : task.priority === "LOW" ? "low" : "normal",
    status: task.status.toLowerCase() as TaskStatus,
    dueAt: task.dueAt,
    due: dueLabel(task.dueAt),
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
  return {
    id: `external-${event.id}`,
    title: event.title,
    day: dayIndexFor(event.startAt, weekStart),
    start: start.getHours() * 60 + start.getMinutes(),
    duration: Math.max(15, Math.round((end.getTime() - start.getTime()) / 60_000)),
    color: "#94A3B8",
    type: "external",
    meta: event.location || "Google Calendar",
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
}: {
  viewer: { displayName: string; email: string } | null;
}) {
  const [now] = useState(() => new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [activeSection, setActiveSection] = useState<ActiveSection>("calendar");
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
  const [hasGoogleIntegration, setHasGoogleIntegration] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [taskFilter, setTaskFilter] = useState<"inbox" | "today">("inbox");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskPanelOpen, setTaskPanelOpen] = useState(true);
  const [slotPicker, setSlotPicker] = useState<SlotPicker | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastKind, setToastKind] = useState<ToastKind>("info");
  const [search, setSearch] = useState("");
  const [showPlannerBlocks, setShowPlannerBlocks] = useState(true);
  const [showExternalEvents, setShowExternalEvents] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const savedScrollRef = useRef(0);
  const liveDataRef = useRef(false);
  const calendarSyncInFlightRef = useRef<Promise<void> | null>(null);
  const lastCalendarSyncAttemptRef = useRef(0);

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
    if (!options.force
      && Date.now() - lastCalendarSyncAttemptRef.current < AUTO_SYNC_MIN_GAP_MS) {
      return Promise.resolve();
    }

    lastCalendarSyncAttemptRef.current = Date.now();
    if (options.announce) setGoogleConnection("syncing");

    const operation = syncGoogleCalendar()
      .then(({ summary }) => {
        setHasGoogleIntegration(true);
        setGoogleConnection("connected");
        setReloadKey((value) => value + 1);
        if (options.announce) setToast(calendarSyncMessage(summary));
      })
      .catch(() => {
        setGoogleConnection("error");
        if (options.announce) {
          setToast("Google Calendar sync failed · tap Retry");
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
    const rangeStart = view === "month" ? startOfMonth(monthAnchor) : weekStart;
    const rangeEnd = view === "month"
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
        setBlocks([
          ...data.timeBlocks.map((block) => timeBlockFromApi(block, referenceStart, nextProjects)),
          ...data.externalEvents.map((event) => externalBlockFromApi(event, referenceStart)),
        ].filter((block) => block.day >= 0 && block.day < maxDay));
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
  }, [reloadKey, weekStart, view, monthAnchor]);

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
        setGoogleConnection(connected ? "connected" : "not-connected");
      })
      .catch(() => {
        if (!controller.signal.aborted) setGoogleConnection("error");
      });
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("google") !== "connected") return;
    url.searchParams.delete("google");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    queueMicrotask(() => void runCalendarSync({ announce: true, force: true }));
  }, [runCalendarSync]);

  useEffect(() => {
    if (connection !== "live" || !hasGoogleIntegration) return;

    const syncWhenActive = (force = false) => {
      if (document.visibilityState !== "visible") return;
      void runCalendarSync({ force });
    };
    const onWindowFocus = () => syncWhenActive(true);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") syncWhenActive(true);
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
  }, [connection, hasGoogleIntegration, runCalendarSync]);

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

  const filteredTasks = tasks.filter((task) => {
    if (task.status === "done") return false;
    if (taskFilter === "inbox" && task.status === "scheduled") return false;
    if (taskFilter === "today") {
      if (!blocks.some((block) => block.taskId === task.id && block.day === nowDay)) {
        return false;
      }
    }
    return task.title.toLowerCase().includes(search.toLowerCase());
  });

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

  const weekOccupiedMinutes = blocks
    .filter((block) => block.day >= 0 && block.day < 7)
    .reduce((total, block) => total + block.duration, 0);
  const weekPlannedPercent = Math.min(
    100,
    Math.round((weekOccupiedMinutes / (7 * MINUTES_VISIBLE)) * 100),
  );
  const weekScoreCaption = weekPlannedPercent >= 85
    ? "Full week"
    : weekPlannedPercent >= 60
      ? "Healthy buffer"
      : "Room to protect";

  const calendarBlocks = blocks.filter((block) => {
    if (block.type === "external" && !showExternalEvents) return false;
    if (block.type === "task" && !showPlannerBlocks) return false;
    return true;
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
        setQuickAddOpen(true);
        return;
      }
      if (event.key === "Escape") {
        setQuickAddOpen(false);
        setSlotPicker(null);
        setEditingTaskId(null);
        return;
      }
      if (typing) return;
      if (event.key === "/") {
        event.preventDefault();
        if (activeSection === "tasks") return;
        searchRef.current?.focus();
        return;
      }
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setQuickAddOpen(true);
        return;
      }
      if (event.key === "1") { setActiveSection("calendar"); return; }
      if (event.key === "2") { setActiveSection("tasks"); return; }
      if (event.key === "3") { setActiveSection("projects"); return; }
      if (event.key === "4") { setActiveSection("goals"); return; }
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
  }, [activeSection, changePeriod]);

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
    showToast(liveDataRef.current ? "Updating block length…" : "Block resized · demo mode");
    if (!liveDataRef.current) return;

    const startAt = slotDate(weekStart, previous.day, previous.start);
    const endAt = new Date(startAt.getTime() + duration * 60_000);
    try {
      const saved = await updateTimeBlock(previous.id, { endAt: endAt.toISOString() });
      const mapped = timeBlockFromApi(saved, weekStart, projects);
      setBlocks((current) => current.map((block) => block.id === saved.id ? mapped : block));
      if (saved.syncStatus === "FAILED") {
        showToast("Block saved · Google sync needs attention", "warning");
      } else {
        showToast("Block length updated · calendar synced");
      }
    } catch {
      setBlocks((current) => current.map((block) => block.id === previous.id ? previous : block));
      setConnection("error");
      showToast("Could not resize block · changes rolled back", "warning");
    }
  };

  const scheduleTaskAtSlot = async (
    task: PlannerTask,
    day: number,
    start: number,
    pendingId: string,
  ) => {
    const block: CalendarBlock = {
      id: pendingId,
      title: task.title,
      day,
      start,
      duration: task.duration,
      color: task.color,
      type: "task",
      taskId: task.id,
      projectId: task.projectId,
      meta: task.project,
      syncStatus: "PENDING",
    };
    warnIfConflict(block);
    setBlocks((current) => [...current, block]);
    setTasks((current) =>
      current.map((item) => (item.id === task.id ? { ...item, status: "scheduled" } : item)),
    );
    showToast(liveDataRef.current ? "Scheduling task…" : "Task scheduled · demo mode");
    if (!liveDataRef.current) return;

    const startAt = slotDate(weekStart, day, start);
    const endAt = new Date(startAt.getTime() + task.duration * 60_000);
    try {
      const saved = await createPlannerTimeBlock({
        taskId: task.id,
        projectId: task.projectId,
        title: task.title,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        color: task.color,
      });
      const mapped = timeBlockFromApi(saved, weekStart, projects);
      setBlocks((current) => current.map((item) => item.id === pendingId ? mapped : item));
      showToast(saved.syncStatus === "FAILED"
        ? "Task scheduled · Google sync needs attention"
        : "Task scheduled · calendar synced");
    } catch {
      setBlocks((current) => current.filter((item) => item.id !== pendingId));
      setTasks((current) => current.map((item) =>
        item.id === task.id ? { ...item, status: "inbox" } : item,
      ));
      setConnection("error");
      showToast("Could not schedule task · changes rolled back", "warning");
    }
  };

  const completeTask = async (taskId: string) => {
    const previousTasks = tasks;
    const previousBlocks = blocks;
    setTasks((current) =>
      current.map((task) => (task.id === taskId ? { ...task, status: "done" } : task)),
    );
    setBlocks((current) => current.filter((block) => block.taskId !== taskId));
    setToast(liveDataRef.current ? "Completing task…" : "Task completed · demo mode");
    if (!liveDataRef.current) return;

    try {
      const linkedBlocks = await fetchTaskTimeBlocks(taskId);
      await Promise.all(linkedBlocks.map((block) => deleteTimeBlock(block.id)));
      await updateTask(taskId, { status: "DONE" });
      setToast("Task completed · calendar updated");
      setReloadKey((value) => value + 1);
    } catch {
      setTasks(previousTasks);
      setBlocks(previousBlocks);
      setConnection("error");
      setToast("Could not complete task · changes rolled back");
    }
  };

  const restoreTask = async (taskId: string) => {
    const previousTasks = tasks;
    setTasks((current) => current.map((task) =>
      task.id === taskId ? { ...task, status: "inbox" } : task,
    ));
    setToast(liveDataRef.current ? "Restoring task…" : "Task restored · demo mode");
    if (!liveDataRef.current) return;
    try {
      await updateTask(taskId, { status: "INBOX" });
      setToast("Task restored to Inbox");
      setReloadKey((value) => value + 1);
    } catch {
      setTasks(previousTasks);
      setToast("Could not restore task · changes rolled back");
    }
  };

  const onDragStart = (event: React.DragEvent, payload: DragPayload) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-personal-os", JSON.stringify(payload));
  };

  const onCalendarDrop = async (event: React.DragEvent, day: number) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData("application/x-personal-os");
    if (!raw) return;
    let payload: DragPayload;
    try {
      payload = JSON.parse(raw) as DragPayload;
    } catch {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const minutesFromStart = Math.round((y / rect.height) * MINUTES_VISIBLE / SNAP_MINUTES) * SNAP_MINUTES;
    const start = Math.min(END_HOUR * 60 - SNAP_MINUTES, START_HOUR * 60 + minutesFromStart);

    if (payload.kind === "block") {
      const previous = blocks.find((block) => block.id === payload.blockId);
      if (!previous || previous.type === "external") return;
      const candidate = { ...previous, day, start };
      setBlocks((current) =>
        current.map((block) => (block.id === payload.blockId ? candidate : block)),
      );
      warnIfConflict(candidate, previous.id);
      showToast(liveDataRef.current ? "Moving time block…" : "Time block moved · demo mode");
      if (!liveDataRef.current) return;
      const startAt = slotDate(weekStart, day, start);
      const endAt = new Date(startAt.getTime() + previous.duration * 60_000);
      try {
        const saved = await updateTimeBlock(previous.id, {
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
        });
        const mapped = timeBlockFromApi(saved, weekStart, projects);
        setBlocks((current) => current.map((block) => block.id === saved.id ? mapped : block));
        setToast(saved.syncStatus === "FAILED"
          ? "Block saved · Google sync needs attention"
          : "Time block moved · calendar synced");
      } catch {
        setBlocks((current) => current.map((block) =>
          block.id === previous.id ? previous : block,
        ));
        setConnection("error");
        setToast("Could not move block · changes rolled back");
      }
      return;
    }

    const task = tasks.find((item) => item.id === payload.taskId);
    if (!task) return;
    const block: CalendarBlock = {
      id: `pending-${crypto.randomUUID()}`,
      title: task.title,
      day,
      start,
      duration: task.duration,
      color: task.color,
      type: "task",
      taskId: task.id,
      projectId: task.projectId,
      meta: task.project,
      syncStatus: "PENDING",
    };
    warnIfConflict(block);
    setBlocks((current) => [...current, block]);
    setTasks((current) =>
      current.map((item) => (item.id === task.id ? { ...item, status: "scheduled" } : item)),
    );
    showToast(liveDataRef.current ? "Scheduling task…" : "Task scheduled · demo mode");
    if (!liveDataRef.current) return;

    const startAt = slotDate(weekStart, day, start);
    const endAt = new Date(startAt.getTime() + task.duration * 60_000);
    try {
      const saved = await createPlannerTimeBlock({
        taskId: task.id,
        projectId: task.projectId,
        title: task.title,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        color: task.color,
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

  const addTask = async (title: string, duration: number, projectId: string | null): Promise<PlannerTask | null> => {
    const project = projects.find((item) => item.id === projectId) ?? projects.at(-1)!;
    const task: PlannerTask = {
      id: `pending-${crypto.randomUUID()}`,
      title,
      notes: "",
      projectId,
      project: project.title,
      color: project.color,
      duration,
      priority: "normal",
      status: "inbox",
      dueAt: null,
      due: "Today",
    };
    setTasks((current) => [task, ...current]);
    setTaskFilter("inbox");
    setTaskPanelOpen(true);
    setQuickAddOpen(false);
    setToast(liveDataRef.current ? "Saving task…" : "Task added · demo mode");
    if (!liveDataRef.current) return task;

    try {
      const saved = await createPlannerTask({
        title,
        projectId,
        durationMinutes: duration,
        priority: "NORMAL",
      });
      const mapped = taskFromApi(saved, projects);
      setTasks((current) => current.map((item) => item.id === task.id ? mapped : item));
      setToast("Task saved to Inbox");
      return mapped;
    } catch {
      setTasks((current) => current.filter((item) => item.id !== task.id));
      setConnection("error");
      setToast("Could not save task · changes rolled back");
      return null;
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
      : googleConnection === "not-connected"
        ? { state: "demo", label: "Connect" }
        : googleConnection === "syncing" || googleConnection === "loading"
          ? { state: "syncing", label: googleConnection === "syncing" ? "Syncing…" : "Checking…" }
          : { state: "error", label: "Retry" };

  const handleCalendarConnection = async () => {
    if (connection !== "live") {
      setReloadKey((value) => value + 1);
      return;
    }
    if (hasGoogleIntegration) {
      await runCalendarSync({ announce: true, force: true });
      return;
    }
    try {
      setGoogleConnection("loading");
      const result = await getGoogleAuthUrl();
      if (!result.url) throw new Error("OAuth is unavailable");
      window.location.assign(result.url);
    } catch {
      setGoogleConnection("error");
      setToast("Could not start Google Calendar connection");
    }
  };

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
  }[activeSection];

  return (
    <div className="app-shell">
      <Sidebar
        inboxCount={tasks.filter((task) => task.status === "inbox").length}
        activeSection={activeSection}
        weekPlannedPercent={weekPlannedPercent}
        weekScoreCaption={weekScoreCaption}
        showPlannerBlocks={showPlannerBlocks}
        showExternalEvents={showExternalEvents}
        hasGoogleIntegration={hasGoogleIntegration}
        onTogglePlannerBlocks={() => setShowPlannerBlocks((value) => !value)}
        onToggleExternalEvents={() => setShowExternalEvents((value) => !value)}
        onNavigate={(section) => {
          setActiveSection(section);
          if (section === "calendar") goToday();
        }}
      />

      <main className={`workspace ${activeSection !== "calendar" ? "tasks-mode" : ""}`}>
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
            ) : (
              <h1>Goals <span>{goals.filter((goal) => goal.status === "ACTIVE").length} active</span></h1>
            )}
          </div>

          <div className="topbar-actions">
            <button
              className={`sync-status ${syncDisplay.state}`}
              title={hasGoogleIntegration
                ? failedSyncCount > 0
                  ? `${failedSyncCount} Personal OS block${failedSyncCount === 1 ? "" : "s"} failed to sync; click to retry`
                  : "Google Calendar auto-syncs while this tab is active; click to sync now"
                : "Connect Google Calendar"}
              onClick={handleCalendarConnection}
              aria-live="polite"
            >
              <span className="sync-dot" />
              Google Calendar
              <span>{syncDisplay.label}</span>
            </button>
            <button className="icon-button" aria-label="Notifications">
              <Bell size={18} />
              <span className="notification-dot" />
            </button>
            <button className="avatar" aria-label="Open profile menu" title={viewer?.email}>
              {initials(viewer?.displayName)}
            </button>
          </div>
        </header>

        {activeSection === "calendar" ? <>
        <section className="calendar-toolbar" aria-label="Calendar controls">
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
            <div className="week-range">
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
              <span><strong>{durationLabel(plannedMinutes)}</strong> planned</span>
              <i />
              <span><strong>{durationLabel(openMinutes)}</strong> open</span>
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
              <ListTodo size={17} /> Tasks
            </button>
          </div>
        </section>

        <div className={`planner-layout ${taskPanelOpen && view !== "month" ? "with-panel" : ""}`}>
          <section
            className="calendar-card"
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
              {visibleDays.map((date) => (
                <div className="all-day-cell" key={date.toISOString()} />
              ))}
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

                {visibleIndexes.map((dayIndex) => (
                  <div
                    className="day-track"
                    key={dayIndex}
                    role="presentation"
                    onMouseDown={(event) => {
                      if ((event.target as HTMLElement).closest(".calendar-event")) return;
                      if (event.button !== 0) return;
                      const rect = event.currentTarget.getBoundingClientRect();
                      const start = slotMinutesFromClick(event.clientY, rect);
                      setSlotPicker({ day: dayIndex, start });
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => onCalendarDrop(event, dayIndex)}
                  >
                    {isCurrentWeek && dayIndex === nowDay && nowMinute >= START_HOUR * 60 && nowMinute <= END_HOUR * 60 && (
                      <div className="now-line" style={{ top: nowMinute - START_HOUR * 60 }}>
                        <span>{minutesToTime(nowMinute)}</span>
                      </div>
                    )}
                    {calendarBlocks
                      .filter((block) => block.day === dayIndex)
                      .map((block) => (
                        <CalendarEvent
                          key={block.id}
                          block={block}
                          onDragStart={onDragStart}
                          onComplete={completeTask}
                          onOpenTask={setEditingTaskId}
                          onResize={onResizeBlock}
                        />
                      ))}
                  </div>
                ))}
              </div>
            </div>
            </>}
          </section>

          {taskPanelOpen && view !== "month" && (
            <TaskPanel
              tasks={filteredTasks}
              count={tasks.filter((task) => task.status !== "done").length}
              filter={taskFilter}
              search={search}
              searchRef={searchRef}
              onSearch={setSearch}
              onFilter={setTaskFilter}
              onClose={() => setTaskPanelOpen(false)}
              onQuickAdd={() => setQuickAddOpen(true)}
              onDragStart={onDragStart}
              onComplete={completeTask}
              onOpenTask={setEditingTaskId}
            />
          )}
        </div>
        </> : activeSection === "tasks" ? (
          <TasksWorkspace
            tasks={tasks}
            blocks={blocks}
            projects={projects}
            onQuickAdd={() => setQuickAddOpen(true)}
            onOpenTask={setEditingTaskId}
            onComplete={completeTask}
            onRestore={restoreTask}
          />
        ) : activeSection === "projects" ? (
          <ProjectsWorkspace
            projects={apiProjects}
            goals={goals}
            taskCountByProject={taskCountByProject}
            live={connection === "live"}
            onChanged={(message) => {
              setReloadKey((value) => value + 1);
              showToast(message);
            }}
          />
        ) : (
          <GoalsWorkspace
            goals={goals}
            projects={apiProjects}
            live={connection === "live"}
            onChanged={(message) => {
              setReloadKey((value) => value + 1);
              showToast(message);
            }}
          />
        )}
      </main>

      <button className="quick-add-fab" onClick={() => setQuickAddOpen(true)} aria-label="Quick add">
        <Plus size={22} />
      </button>

      {quickAddOpen && (
        <QuickAdd
          projects={projects}
          onClose={() => setQuickAddOpen(false)}
          onAdd={addTask}
        />
      )}

      {editingTask && (
        <TaskEditor
          key={editingTask.id}
          task={editingTask}
          projects={projects}
          live={connection === "live"}
          onClose={() => setEditingTaskId(null)}
          onChanged={(message) => {
            setEditingTaskId(null);
            setReloadKey((value) => value + 1);
            setToast(message);
          }}
        />
      )}

      {slotPicker && (
        <SlotScheduleModal
          slot={slotPicker}
          tasks={tasks.filter((task) => task.status !== "done")}
          projects={projects}
          live={connection === "live"}
          weekStart={weekStart}
          onClose={() => setSlotPicker(null)}
          onPickTask={(task) => {
            const pendingId = `pending-${crypto.randomUUID()}`;
            setSlotPicker(null);
            void scheduleTaskAtSlot(task, slotPicker.day, slotPicker.start, pendingId);
          }}
          onCreateTask={async (title, duration, projectId) => {
            const created = await addTask(title, duration, projectId);
            const pendingId = `pending-${crypto.randomUUID()}`;
            setSlotPicker(null);
            if (created) {
              void scheduleTaskAtSlot(created, slotPicker.day, slotPicker.start, pendingId);
            }
          }}
        />
      )}

      {toast && (
        <div className={`toast ${toastKind === "warning" ? "warning" : ""}`} role="status">
          <CheckCircle2 size={18} /> {toast}
        </div>
      )}
    </div>
  );
}

function Sidebar({
  inboxCount,
  activeSection,
  weekPlannedPercent,
  weekScoreCaption,
  showPlannerBlocks,
  showExternalEvents,
  hasGoogleIntegration,
  onTogglePlannerBlocks,
  onToggleExternalEvents,
  onNavigate,
}: {
  inboxCount: number;
  activeSection: ActiveSection;
  weekPlannedPercent: number;
  weekScoreCaption: string;
  showPlannerBlocks: boolean;
  showExternalEvents: boolean;
  hasGoogleIntegration: boolean;
  onTogglePlannerBlocks: () => void;
  onToggleExternalEvents: () => void;
  onNavigate: (section: ActiveSection) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">P</div>
        <div>
          <strong>Personal OS</strong>
          <span>Your time, aligned</span>
        </div>
      </div>

      <nav className="primary-nav" aria-label="Primary navigation">
        <button onClick={() => onNavigate("calendar")}><Crosshair size={19} /><span>Today</span></button>
        <button className={activeSection === "calendar" ? "active" : ""} onClick={() => onNavigate("calendar")}>
          <CalendarDays size={19} /><span>Calendar</span>
        </button>
        <button className={activeSection === "tasks" ? "active" : ""} onClick={() => onNavigate("tasks")}>
          <ListTodo size={19} /><span>Tasks</span><em>{inboxCount}</em>
        </button>
        <button className={activeSection === "projects" ? "active" : ""} onClick={() => onNavigate("projects")}>
          <FolderKanban size={19} /><span>Projects</span>
        </button>
        <button className={activeSection === "goals" ? "active" : ""} onClick={() => onNavigate("goals")}>
          <Target size={19} /><span>Goals</span></button>
      </nav>

      <div className="sidebar-section">
        <div className="sidebar-label">Calendars</div>
        <button
          type="button"
          className={`calendar-source ${showPlannerBlocks ? "active" : ""}`}
          onClick={onTogglePlannerBlocks}
          aria-pressed={showPlannerBlocks}
        >
          <i className="source-dot personal" />
          <span>Personal OS blocks</span>
          {showPlannerBlocks && <Check size={14} />}
        </button>
        <button
          type="button"
          className={`calendar-source ${showExternalEvents ? "active" : ""}`}
          onClick={onToggleExternalEvents}
          aria-pressed={showExternalEvents}
          disabled={!hasGoogleIntegration}
          title={hasGoogleIntegration ? "Toggle Google Calendar events" : "Connect Google Calendar first"}
        >
          <i className="source-dot work" />
          <span>Google Calendar</span>
          {showExternalEvents && hasGoogleIntegration && <Check size={14} />}
        </button>
      </div>

      <div className="sidebar-bottom">
        <div className="week-score">
          <div className="score-icon"><Zap size={17} /></div>
          <div><strong>{weekPlannedPercent}% planned</strong><span>{weekScoreCaption}</span></div>
          <ChevronRight size={16} />
        </div>
        <button><Settings size={18} /><span>Settings</span></button>
      </div>
    </aside>
  );
}

function CalendarEvent({
  block,
  onDragStart,
  onComplete,
  onOpenTask,
  onResize,
}: {
  block: CalendarBlock;
  onDragStart: (event: React.DragEvent, payload: DragPayload) => void;
  onComplete: (taskId: string) => void;
  onOpenTask: (taskId: string) => void;
  onResize: (blockId: string, duration: number) => void;
}) {
  const resizeStartRef = useRef<{ y: number; duration: number } | null>(null);
  const previewRef = useRef<number | null>(null);
  const [previewDuration, setPreviewDuration] = useState<number | null>(null);
  const displayDuration = previewDuration ?? block.duration;

  const onResizePointerDown = (event: React.PointerEvent) => {
    if (block.type !== "task") return;
    event.stopPropagation();
    event.preventDefault();
    resizeStartRef.current = { y: event.clientY, duration: block.duration };

    const onMove = (moveEvent: PointerEvent) => {
      if (!resizeStartRef.current) return;
      const delta = moveEvent.clientY - resizeStartRef.current.y;
      const deltaMinutes = Math.round((delta / 900) * MINUTES_VISIBLE / SNAP_MINUTES) * SNAP_MINUTES;
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

  return (
    <article
      className={`calendar-event ${block.type}`}
      data-sync={block.syncStatus?.toLowerCase()}
      title={block.syncStatus === "FAILED" ? "Saved in Personal OS; Google Calendar sync failed" : undefined}
      style={{
        top: block.start - START_HOUR * 60 + 3,
        height: Math.max(28, displayDuration - 6),
        "--event-color": block.color,
      } as React.CSSProperties}
      draggable={block.type === "task"}
      onDragStart={(event) => onDragStart(event, { kind: "block", blockId: block.id })}
      onDoubleClick={() => {
        if (block.taskId) onOpenTask(block.taskId);
      }}
    >
      <div className="event-title-row">
        {block.type === "external" && <LockKeyhole size={11} />}
        <strong>{block.title}</strong>
        {block.taskId && (
          <button
            className="event-complete"
            aria-label={`Complete ${block.title}`}
            onClick={(event) => {
              event.stopPropagation();
              onComplete(block.taskId!);
            }}
          >
            <Check size={11} />
          </button>
        )}
        {block.syncStatus === "FAILED" && <em className="sync-warning">!</em>}
      </div>
      {block.duration >= 45 && <span>{minutesToTime(block.start)} · {block.meta}</span>}
      {block.type === "task" && (
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
    <div className="month-calendar" aria-label="Month view">
      <div className="month-weekdays">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="month-grid">
        {cells.map((date) => {
          const dayIndex = dayIndexFor(date.toISOString(), referenceStart);
          const dayBlocks = blocks.filter((block) => block.day === dayIndex);
          const inMonth = date.getMonth() === anchor.getMonth();
          const isToday = sameDay(date, today);
          return (
            <button
              key={date.toISOString()}
              className={`month-cell ${inMonth ? "" : "muted"} ${isToday ? "today" : ""}`}
              onClick={() => onOpenDay(date)}
            >
              <strong>{date.getDate()}</strong>
              <div className="month-events">
                {dayBlocks.slice(0, 3).map((block) => (
                  <i key={block.id} style={{ background: block.color }} title={block.title} />
                ))}
                {dayBlocks.length > 3 && <small>+{dayBlocks.length - 3}</small>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SlotScheduleModal({
  slot,
  tasks,
  projects,
  live,
  weekStart,
  onClose,
  onPickTask,
  onCreateTask,
}: {
  slot: SlotPicker;
  tasks: PlannerTask[];
  projects: ProjectOption[];
  live: boolean;
  weekStart: Date;
  onClose: () => void;
  onPickTask: (task: PlannerTask) => void;
  onCreateTask: (title: string, duration: number, projectId: string | null) => Promise<void>;
}) {
  const [mode, setMode] = useState<"pick" | "create">("pick");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(30);
  const [projectId, setProjectId] = useState<string | null>(projects[0]?.id ?? null);
  const slotDateValue = slotDate(weekStart, slot.day, slot.start);

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    await onCreateTask(title.trim(), duration, projectId);
  };

  return (
    <div className="modal-backdrop">
      <button className="modal-dismiss" type="button" aria-label="Close slot scheduler" onClick={onClose} />
      <div className="slot-schedule-modal" role="dialog" aria-modal="true" aria-label="Schedule time block">
        <div className="slot-schedule-header">
          <div>
            <div className="eyebrow">Schedule time</div>
            <strong>{slotDateValue.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {minutesToTime(slot.start)}</strong>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="slot-schedule-tabs">
          <button className={mode === "pick" ? "active" : ""} onClick={() => setMode("pick")}>Existing task</button>
          <button className={mode === "create" ? "active" : ""} onClick={() => setMode("create")}>Quick create</button>
        </div>
        {mode === "pick" ? (
          <div className="slot-task-list">
            {tasks.filter((task) => task.status !== "scheduled").map((task) => (
              <button key={task.id} type="button" className="slot-task-row" onClick={() => onPickTask(task)}>
                <i style={{ background: task.color }} />
                <span>{task.title}</span>
                <small>{durationLabel(task.duration)}</small>
              </button>
            ))}
            {tasks.filter((task) => task.status !== "scheduled").length === 0 && (
              <p className="slot-empty">No inbox tasks · quick create one instead.</p>
            )}
          </div>
        ) : (
          <form className="slot-create-form" onSubmit={submitCreate}>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Task title" />
            <div className="slot-create-fields">
              <label>
                <span>Duration</span>
                <select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>1 hour</option>
                </select>
              </label>
              <label>
                <span>Project</span>
                <select value={projectId ?? ""} onChange={(event) => setProjectId(event.target.value || null)}>
                  {projects.map((project) => (
                    <option key={project.id ?? "inbox"} value={project.id ?? ""}>{project.title}</option>
                  ))}
                </select>
              </label>
            </div>
            <button type="submit" className="primary-button" disabled={!title.trim()}>
              {live ? "Create & schedule" : "Create & schedule · demo"}
            </button>
          </form>
        )}
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
  onOpenTask,
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
  onOpenTask: (taskId: string) => void;
}) {
  return (
    <aside className="task-panel">
      <div className="task-panel-header">
        <div>
          <div className="eyebrow">Unscheduled work</div>
          <h2>Tasks <span>{count}</span></h2>
        </div>
        <div className="task-panel-actions">
          <button className="icon-button" aria-label="Task menu"><MoreHorizontal size={18} /></button>
          <button className="icon-button" aria-label="Close task panel" onClick={onClose}><X size={18} /></button>
        </div>
      </div>

      <button className="quick-capture" onClick={onQuickAdd}>
        <span><Plus size={17} /> Add task</span>
        <kbd>⌘ K</kbd>
      </button>

      <label className="task-search">
        <Search size={16} />
        <input ref={searchRef} value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search tasks" />
      </label>

      <div className="task-tabs">
        <button className={filter === "inbox" ? "active" : ""} onClick={() => onFilter("inbox")}>
          Inbox
        </button>
        <button className={filter === "today" ? "active" : ""} onClick={() => onFilter("today")}>
          Today
        </button>
      </div>

      <div className="drag-hint"><GripVertical size={14} /> Drag a task onto free time</div>

      <div className="task-list">
        {tasks.map((task) => (
          <article
            className="task-card"
            key={task.id}
            draggable
            onDragStart={(event) => onDragStart(event, { kind: "task", taskId: task.id })}
          >
            <button className="task-check" onClick={() => onComplete(task.id)} aria-label={`Complete ${task.title}`}>
              <Circle size={18} />
            </button>
            <div className="task-content">
              <button className="task-title-button" type="button" onClick={() => onOpenTask(task.id)}>
                {task.title}
              </button>
              <div className="task-project"><i style={{ background: task.color }} />{task.project}</div>
              <div className="task-meta">
                <span><Clock3 size={13} />{durationLabel(task.duration)}</span>
                {task.due && <span className={task.priority === "high" ? "urgent" : ""}><Flag size={13} />{task.due}</span>}
              </div>
            </div>
            <GripVertical className="drag-handle" size={17} />
          </article>
        ))}

        {tasks.length === 0 && (
          <div className="empty-tasks">
            <div><Sparkles size={20} /></div>
            <strong>Clear for now</strong>
            <span>Capture something new or enjoy the open time.</span>
          </div>
        )}
      </div>
    </aside>
  );
}

function TasksWorkspace({
  tasks,
  blocks,
  projects,
  onQuickAdd,
  onOpenTask,
  onComplete,
  onRestore,
}: {
  tasks: PlannerTask[];
  blocks: CalendarBlock[];
  projects: ProjectOption[];
  onQuickAdd: () => void;
  onOpenTask: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  onRestore: (taskId: string) => void;
}) {
  const [filter, setFilter] = useState<"open" | "inbox" | "scheduled" | "done">("open");
  const [projectFilterId, setProjectFilterId] = useState<string | "all">("all");
  const [query, setQuery] = useState("");
  const today = new Date();
  const normalizedQuery = query.trim().toLowerCase();
  const active = tasks.filter((task) => task.status !== "done");
  const overdue = active.filter((task) => task.dueAt && new Date(task.dueAt) < today).length;
  const scheduled = active.filter((task) => task.status === "scheduled").length;
  const completed = tasks.filter((task) => task.status === "done").length;
  const visible = tasks
    .filter((task) => {
      if (filter === "open" && task.status === "done") return false;
      if (filter !== "open" && task.status !== filter) return false;
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
      if (left.priority !== right.priority) {
        const rank = { high: 0, normal: 1, low: 2 };
        return rank[left.priority] - rank[right.priority];
      }
      return (left.dueAt ? new Date(left.dueAt).getTime() : Number.MAX_SAFE_INTEGER)
        - (right.dueAt ? new Date(right.dueAt).getTime() : Number.MAX_SAFE_INTEGER);
    });

  return (
    <section className="tasks-workspace" aria-label="Task workspace">
      <div className="tasks-hero">
        <div>
          <div className="eyebrow">Plan the work, then protect the time</div>
          <h2>Your tasks</h2>
          <p>Capture everything here. Schedule only what deserves time on your calendar.</p>
        </div>
        <button className="primary-button task-add-button" onClick={onQuickAdd}>
          <Plus size={17} /> Add task
        </button>
      </div>

      <div className="task-metrics" aria-label="Task summary">
        <div><span>Open</span><strong>{active.length}</strong><small>ready to plan</small></div>
        <div><span>Scheduled</span><strong>{scheduled}</strong><small>protected on calendar</small></div>
        <div className={overdue ? "attention" : ""}><span>Overdue</span><strong>{overdue}</strong><small>needs a decision</small></div>
        <div><span>Completed</span><strong>{completed}</strong><small>all-time progress</small></div>
      </div>

      <div className="task-board">
        <div className="task-board-toolbar">
          <div className="task-board-tabs">
            {(["open", "inbox", "scheduled", "done"] as const).map((value) => (
              <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>
                {value === "done" ? "Completed" : value[0].toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>
          <label className="task-workspace-search">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks" />
          </label>
          <label className="task-project-filter">
            <span className="sr-only">Filter by project</span>
            <select
              value={projectFilterId}
              onChange={(event) => {
                const value = event.target.value;
                setProjectFilterId(value === "all" ? "all" : value === "inbox" ? "inbox" : value);
              }}
              aria-label="Filter by project"
            >
              <option value="all">All projects</option>
              {projects.filter((project) => project.id).map((project) => (
                <option key={project.id!} value={project.id!}>{project.title}</option>
              ))}
              <option value="inbox">Inbox only</option>
            </select>
          </label>
        </div>

        <div className="task-table-heading" aria-hidden="true">
          <span>Task</span><span>Project</span><span>Schedule</span><span>Due</span><span />
        </div>
        <div className="task-workspace-list">
          {visible.map((task) => {
            const block = blocks.find((candidate) => candidate.taskId === task.id);
            const isOverdue = Boolean(task.dueAt && new Date(task.dueAt) < today && task.status !== "done");
            return (
              <article className={`task-workspace-row ${task.status === "done" ? "completed" : ""}`} key={task.id}>
                <button
                  className="workspace-task-check"
                  aria-label={task.status === "done" ? `Restore ${task.title}` : `Complete ${task.title}`}
                  onClick={() => task.status === "done" ? onRestore(task.id) : onComplete(task.id)}
                >
                  {task.status === "done" ? <RotateCcw size={15} /> : <Circle size={19} />}
                </button>
                <button className="workspace-task-title" onClick={() => onOpenTask(task.id)}>
                  <strong>{task.title}</strong>
                  <span>{task.notes || `${durationLabel(task.duration)} focus block`}</span>
                </button>
                <div className="workspace-task-project"><i style={{ background: task.color }} />{task.project}</div>
                <div className={`workspace-task-status ${task.status}`}>
                  {task.status === "scheduled" ? <CalendarClock size={14} /> : <FileText size={14} />}
                  {task.status === "scheduled" ? scheduleLabel(block) : task.status === "done" ? "Completed" : "Inbox"}
                </div>
                <div className={`workspace-task-due ${isOverdue ? "overdue" : ""}`}>
                  {task.due ? <><Flag size={13} />{task.due}</> : "—"}
                </div>
                <button className="row-more" aria-label={`Edit ${task.title}`} onClick={() => onOpenTask(task.id)}>
                  <MoreHorizontal size={18} />
                </button>
              </article>
            );
          })}

          {visible.length === 0 && (
            <div className="task-workspace-empty">
              <div><Sparkles size={22} /></div>
              <strong>No tasks in this view</strong>
              <span>Switch filters or capture your next action.</span>
              <button onClick={onQuickAdd}><Plus size={15} /> Add task</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TaskEditor({
  task,
  projects,
  live,
  onClose,
  onChanged,
}: {
  task: PlannerTask;
  projects: ProjectOption[];
  live: boolean;
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const suggestedStart = defaultScheduleStart();
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [projectId, setProjectId] = useState<string | null>(task.projectId);
  const [dueDate, setDueDate] = useState(dateInputValue(task.dueAt));
  const [duration, setDuration] = useState(task.duration);
  const [priority, setPriority] = useState<"LOW" | "NORMAL" | "HIGH">(
    task.priority === "high" ? "HIGH" : task.priority === "low" ? "LOW" : "NORMAL",
  );
  const [taskBlocks, setTaskBlocks] = useState<ApiTimeBlock[]>([]);
  const [scheduleDate, setScheduleDate] = useState(dateInputValue(suggestedStart.toISOString()));
  const [scheduleTime, setScheduleTime] = useState(timeInputValue(suggestedStart.toISOString()));
  const [loadingSchedule, setLoadingSchedule] = useState(live);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const scheduledBlock = taskBlocks[0];

  useEffect(() => {
    titleRef.current?.focus();
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

  const taskPayload = () => ({
    title: title.trim(),
    notes: notes.trim(),
    projectId,
    dueAt: dueDate ? new Date(`${dueDate}T23:59:00`).toISOString() : null,
    durationMinutes: duration,
    priority,
  });

  const selectedProject = projects.find((project) => project.id === projectId)
    ?? projects.at(-1)!;

  const saveTask = async (schedule: boolean) => {
    if (!title.trim()) {
      setError("Task title cannot be empty.");
      return;
    }
    if ((schedule || scheduledBlock) && (!scheduleDate || !scheduleTime)) {
      setError("Choose a date and time before scheduling.");
      return;
    }
    setSaving(true);
    setError(null);
    if (!live) {
      onChanged(schedule ? "Task scheduled · demo mode" : "Task updated · demo mode");
      return;
    }
    try {
      await updateTask(task.id, taskPayload());
      if (schedule || scheduledBlock) {
        const startAt = scheduleStart(scheduleDate, scheduleTime);
        const endAt = new Date(startAt.getTime() + duration * 60_000);
        if (scheduledBlock) {
          await updateTimeBlock(scheduledBlock.id, {
            title: title.trim(),
            projectId,
            color: selectedProject.color,
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
          });
        } else {
          await createPlannerTimeBlock({
            taskId: task.id,
            projectId,
            title: title.trim(),
            color: selectedProject.color,
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
          });
        }
      }
      onChanged(schedule
        ? "Task saved and synced to Google Calendar"
        : scheduledBlock
          ? "Task and calendar block updated"
          : "Task details updated");
    } catch {
      setSaving(false);
      setError("Could not save these changes. Please try again.");
    }
  };

  const unscheduleTask = async () => {
    setSaving(true);
    setError(null);
    if (!live) {
      onChanged("Task returned to Inbox · demo mode");
      return;
    }
    try {
      await Promise.all(taskBlocks.map((block) => deleteTimeBlock(block.id)));
      await updateTask(task.id, { status: "INBOX" });
      onChanged("Task removed from calendar and returned to Inbox");
    } catch {
      setSaving(false);
      setError("Could not remove this task from the calendar.");
    }
  };

  const removeTask = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    setError(null);
    if (!live) {
      onChanged("Task deleted · demo mode");
      return;
    }
    try {
      await deletePlannerTask(task.id);
      onChanged("Task and its calendar blocks deleted");
    } catch {
      setSaving(false);
      setError("Could not delete this task. Please try again.");
    }
  };

  return (
    <div className="task-editor-backdrop">
      <button className="modal-dismiss" type="button" aria-label="Close task editor" onClick={onClose} />
      <aside className="task-editor" role="dialog" aria-modal="true" aria-label={`Edit ${task.title}`}>
        <div className="task-editor-header">
          <div>
            <div className="eyebrow">Task detail</div>
            <span className={`task-state-pill ${scheduledBlock ? "scheduled" : task.status}`}>
              {scheduledBlock ? "Scheduled" : task.status === "done" ? "Completed" : "Inbox"}
            </span>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="task-editor-body">
          <label className="editor-title-field">
            <span>Task</span>
            <input ref={titleRef} value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="editor-notes-field">
            <span>Notes</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Context, links, or the definition of done…" />
          </label>

          <div className="editor-field-grid">
            <label><span>Project</span>
              <select value={projectId ?? ""} onChange={(event) => setProjectId(event.target.value || null)}>
                {projects.map((project) => <option key={project.id ?? "inbox"} value={project.id ?? ""}>{project.title}</option>)}
              </select>
            </label>
            <label><span>Priority</span>
              <select value={priority} onChange={(event) => setPriority(event.target.value as "LOW" | "NORMAL" | "HIGH")}>
                <option value="HIGH">High</option><option value="NORMAL">Normal</option><option value="LOW">Low</option>
              </select>
            </label>
            <label><span>Duration</span>
              <select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
                <option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={45}>45 minutes</option>
                <option value={60}>1 hour</option><option value={90}>1.5 hours</option><option value={120}>2 hours</option>
              </select>
            </label>
            <label><span>Due date</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
          </div>

          <section className="editor-schedule-section">
            <div className="editor-section-heading">
              <div><CalendarClock size={17} /><span>Calendar time</span></div>
              {loadingSchedule && <small>Checking schedule…</small>}
            </div>
            <div className="editor-schedule-fields">
              <label><span>Date</span><input type="date" value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} /></label>
              <label><span>Start</span><input type="time" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)} /></label>
              <div><span>Length</span><strong>{durationLabel(duration)}</strong></div>
            </div>
            <p>{scheduledBlock
              ? "Saving will update this time block in Personal OS and Google Calendar."
              : "Schedule this task when you are ready to protect time for it."}</p>
          </section>

          {error && <div className="editor-error" role="alert">{error}</div>}
        </div>

        <div className="task-editor-footer">
          <button className={`delete-task-button ${confirmDelete ? "confirm" : ""}`} type="button" onClick={removeTask} disabled={saving}>
            <Trash2 size={15} /> {confirmDelete ? "Click again to delete" : "Delete"}
          </button>
          <div>
            {scheduledBlock && <button className="secondary-button" type="button" onClick={unscheduleTask} disabled={saving}>Unschedule</button>}
            <button className="secondary-button" type="button" onClick={() => saveTask(false)} disabled={saving || loadingSchedule}>
              <Save size={15} /> Save details
            </button>
            <button className="primary-button" type="button" onClick={() => saveTask(true)} disabled={saving || loadingSchedule}>
              <CalendarClock size={15} /> {saving ? "Saving…" : scheduledBlock ? "Save & sync" : "Schedule task"}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function QuickAdd({
  projects,
  onClose,
  onAdd,
}: {
  projects: ProjectOption[];
  onClose: () => void;
  onAdd: (title: string, duration: number, projectId: string | null) => void;
}) {
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(30);
  const [projectId, setProjectId] = useState<string | null>(projects[0]?.id ?? null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    onAdd(title.trim(), duration, projectId);
  };

  return (
    <div className="modal-backdrop">
      <button className="modal-dismiss" type="button" aria-label="Close quick add" onClick={onClose} />
      <form className="quick-add-modal" onSubmit={submit}>
        <div className="quick-add-heading">
          <div className="command-icon"><Command size={19} /></div>
          <div><span>Quick add</span><strong>Capture without breaking flow</strong></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <input
          ref={titleRef}
          className="quick-add-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What needs to get done?"
          aria-label="Task title"
        />
        <div className="quick-add-fields">
          <label>
            <span>Duration</span>
            <select value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
            </select>
          </label>
          <label>
            <span>Project</span>
            <select
              value={projectId ?? ""}
              onChange={(event) => setProjectId(event.target.value || null)}
            >
              {projects.map((project) => (
                <option key={project.id ?? "inbox"} value={project.id ?? ""}>
                  {project.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="quick-add-footer">
          <span>Saved to Inbox · drag it into your calendar next</span>
          <button type="submit" className="primary-button">Add task <span>↵</span></button>
        </div>
      </form>
    </div>
  );
}
