"use client";

import {
  Bell,
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
  FolderKanban,
  GripVertical,
  ListTodo,
  LockKeyhole,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Sparkles,
  Target,
  X,
  Zap,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type TaskStatus = "inbox" | "scheduled" | "done";

type PlannerTask = {
  id: string;
  title: string;
  project: string;
  color: string;
  duration: number;
  priority: "high" | "normal";
  status: TaskStatus;
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
  meta?: string;
};

type DragPayload =
  | { kind: "task"; taskId: string }
  | { kind: "block"; blockId: string };

const START_HOUR = 7;
const END_HOUR = 22;
const MINUTES_VISIBLE = (END_HOUR - START_HOUR) * 60;
const SNAP_MINUTES = 15;
const COLORS = {
  violet: "#705CF6",
  blue: "#3478F6",
  coral: "#FA5D73",
  cyan: "#11B8C7",
  amber: "#F3A712",
};

const initialTasks: PlannerTask[] = [
  {
    id: "task-roadmap",
    title: "Finalize product roadmap",
    project: "Personal OS",
    color: COLORS.violet,
    duration: 60,
    priority: "high",
    status: "inbox",
    due: "Today",
  },
  {
    id: "task-networking",
    title: "Study TCP reliability",
    project: "Systems depth",
    color: COLORS.blue,
    duration: 45,
    priority: "normal",
    status: "scheduled",
    due: "This week",
  },
  {
    id: "task-demo",
    title: "Record Rover demo walkthrough",
    project: "Landfill Rover",
    color: COLORS.coral,
    duration: 90,
    priority: "high",
    status: "inbox",
    due: "Friday",
  },
  {
    id: "task-english",
    title: "English interview practice",
    project: "Career capital",
    color: COLORS.cyan,
    duration: 30,
    priority: "normal",
    status: "inbox",
  },
  {
    id: "task-expenses",
    title: "Review monthly expenses",
    project: "Life admin",
    color: COLORS.amber,
    duration: 30,
    priority: "normal",
    status: "inbox",
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

export function PlannerApp() {
  const [now] = useState(() => new Date());
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [view, setView] = useState<"week" | "day">("week");
  const [activeDay, setActiveDay] = useState(() => {
    const day = new Date().getDay();
    return day === 0 ? 6 : day - 1;
  });
  const [tasks, setTasks] = useState(initialTasks);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [taskFilter, setTaskFilter] = useState<"inbox" | "today">("inbox");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [taskPanelOpen, setTaskPanelOpen] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuickAddOpen(true);
      }
      if (event.key === "Escape") setQuickAddOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
      return blocks.some((block) => block.taskId === task.id && block.day === nowDay);
    }
    return task.title.toLowerCase().includes(search.toLowerCase());
  });

  const plannedMinutes = blocks
    .filter((block) => block.type === "task")
    .reduce((total, block) => total + block.duration, 0);

  const changeWeek = (amount: number) => {
    setWeekStart((current) => addDays(current, amount * 7));
  };

  const goToday = () => {
    setWeekStart(startOfWeek(new Date()));
    setActiveDay(nowDay);
  };

  const completeTask = (taskId: string) => {
    setTasks((current) =>
      current.map((task) => (task.id === taskId ? { ...task, status: "done" } : task)),
    );
    setBlocks((current) => current.filter((block) => block.taskId !== taskId));
    setToast("Task completed");
  };

  const onDragStart = (event: React.DragEvent, payload: DragPayload) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-personal-os", JSON.stringify(payload));
  };

  const onCalendarDrop = (event: React.DragEvent, day: number) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData("application/x-personal-os");
    if (!raw) return;
    const payload = JSON.parse(raw) as DragPayload;
    const rect = event.currentTarget.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const minutesFromStart = Math.round((y / rect.height) * MINUTES_VISIBLE / SNAP_MINUTES) * SNAP_MINUTES;
    const start = Math.min(END_HOUR * 60 - SNAP_MINUTES, START_HOUR * 60 + minutesFromStart);

    if (payload.kind === "block") {
      setBlocks((current) =>
        current.map((block) => (block.id === payload.blockId ? { ...block, day, start } : block)),
      );
      setToast("Time block moved · sync queued");
      return;
    }

    const task = tasks.find((item) => item.id === payload.taskId);
    if (!task) return;
    const block: CalendarBlock = {
      id: `block-${task.id}-${blocks.length + 1}`,
      title: task.title,
      day,
      start,
      duration: task.duration,
      color: task.color,
      type: "task",
      taskId: task.id,
      meta: task.project,
    };
    setBlocks((current) => [...current, block]);
    setTasks((current) =>
      current.map((item) => (item.id === task.id ? { ...item, status: "scheduled" } : item)),
    );
    setToast("Task scheduled · sync queued");
  };

  const addTask = (title: string, duration: number, project: string) => {
    const task: PlannerTask = {
      id: `task-${tasks.length + 1}`,
      title,
      project: project || "Inbox",
      color: COLORS.violet,
      duration,
      priority: "normal",
      status: "inbox",
      due: "Today",
    };
    setTasks((current) => [task, ...current]);
    setTaskFilter("inbox");
    setTaskPanelOpen(true);
    setQuickAddOpen(false);
    setToast("Task added to Inbox");
  };

  return (
    <div className="app-shell">
      <Sidebar inboxCount={tasks.filter((task) => task.status === "inbox").length} />

      <main className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <div className="brand-mark">P</div>
            <strong>Personal OS</strong>
          </div>
          <div className="calendar-title-block">
            <div className="eyebrow">Calendar planner</div>
            <h1>
              {weekStart.toLocaleDateString("en-US", { month: "long" })}{" "}
              <span>{weekStart.getFullYear()}</span>
            </h1>
          </div>

          <div className="topbar-actions">
            <div className="sync-status" title="Calendar connection status">
              <span className="sync-dot" />
              Google Calendar
              <span>Synced</span>
            </div>
            <button className="icon-button" aria-label="Notifications">
              <Bell size={18} />
              <span className="notification-dot" />
            </button>
            <button className="avatar" aria-label="Open profile menu">SH</button>
          </div>
        </header>

        <section className="calendar-toolbar" aria-label="Calendar controls">
          <div className="toolbar-cluster">
            <button className="today-button" onClick={goToday}>Today</button>
            <div className="pager">
              <button aria-label="Previous week" onClick={() => changeWeek(-1)}>
                <ChevronLeft size={18} />
              </button>
              <button aria-label="Next week" onClick={() => changeWeek(1)}>
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="week-range">
              {weekDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              <span>—</span>
              {weekDays[6].toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </div>
          </div>

          <div className="toolbar-cluster toolbar-right">
            <div className="capacity-summary">
              <span><strong>{durationLabel(plannedMinutes)}</strong> planned</span>
              <i />
              <span><strong>12h 15m</strong> open</span>
            </div>
            <div className="view-switcher" aria-label="Calendar view">
              <button className={view === "day" ? "active" : ""} onClick={() => setView("day")}>Day</button>
              <button className={view === "week" ? "active" : ""} onClick={() => setView("week")}>Week</button>
            </div>
            <button
              className={`tasks-toggle ${taskPanelOpen ? "active" : ""}`}
              onClick={() => setTaskPanelOpen((open) => !open)}
            >
              <ListTodo size={17} /> Tasks
            </button>
          </div>
        </section>

        <div className={`planner-layout ${taskPanelOpen ? "with-panel" : ""}`}>
          <section className="calendar-card" aria-label="Weekly calendar">
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
              {visibleDays.map((date, index) => (
                <div className="all-day-cell" key={date.toISOString()}>
                  {visibleIndexes[index] === 4 && (
                    <div className="deadline-pill"><Flag size={12} /> Rover demo due</div>
                  )}
                </div>
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
                    {blocks
                      .filter((block) => block.day === dayIndex)
                      .map((block) => (
                        <CalendarEvent
                          key={block.id}
                          block={block}
                          onDragStart={onDragStart}
                          onComplete={completeTask}
                        />
                      ))}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {taskPanelOpen && (
            <TaskPanel
              tasks={filteredTasks}
              count={tasks.filter((task) => task.status !== "done").length}
              filter={taskFilter}
              search={search}
              onSearch={setSearch}
              onFilter={setTaskFilter}
              onClose={() => setTaskPanelOpen(false)}
              onQuickAdd={() => setQuickAddOpen(true)}
              onDragStart={onDragStart}
              onComplete={completeTask}
            />
          )}
        </div>
      </main>

      <button className="quick-add-fab" onClick={() => setQuickAddOpen(true)} aria-label="Quick add">
        <Plus size={22} />
      </button>

      {quickAddOpen && <QuickAdd onClose={() => setQuickAddOpen(false)} onAdd={addTask} />}

      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} /> {toast}
        </div>
      )}
    </div>
  );
}

function Sidebar({ inboxCount }: { inboxCount: number }) {
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
        <button><Crosshair size={19} /><span>Today</span></button>
        <button className="active"><CalendarDays size={19} /><span>Calendar</span></button>
        <button><ListTodo size={19} /><span>Tasks</span><em>{inboxCount}</em></button>
        <button><FolderKanban size={19} /><span>Projects</span></button>
        <button><Target size={19} /><span>Goals</span></button>
      </nav>

      <div className="sidebar-section">
        <div className="sidebar-label">My calendars</div>
        <button className="calendar-source"><i className="source-dot personal" /><span>Personal Planner</span><Check size={14} /></button>
        <button className="calendar-source"><i className="source-dot work" /><span>Work</span><Check size={14} /></button>
        <button className="calendar-source"><i className="source-dot personal-calendar" /><span>Personal</span><Check size={14} /></button>
      </div>

      <div className="sidebar-bottom">
        <div className="week-score">
          <div className="score-icon"><Zap size={17} /></div>
          <div><strong>68% planned</strong><span>Healthy buffer</span></div>
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
}: {
  block: CalendarBlock;
  onDragStart: (event: React.DragEvent, payload: DragPayload) => void;
  onComplete: (taskId: string) => void;
}) {
  return (
    <article
      className={`calendar-event ${block.type}`}
      style={{
        top: block.start - START_HOUR * 60 + 3,
        height: Math.max(28, block.duration - 6),
        "--event-color": block.color,
      } as React.CSSProperties}
      draggable={block.type === "task"}
      onDragStart={(event) => onDragStart(event, { kind: "block", blockId: block.id })}
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
      </div>
      {block.duration >= 45 && <span>{minutesToTime(block.start)} · {block.meta}</span>}
    </article>
  );
}

function TaskPanel({
  tasks,
  count,
  filter,
  search,
  onSearch,
  onFilter,
  onClose,
  onQuickAdd,
  onDragStart,
  onComplete,
}: {
  tasks: PlannerTask[];
  count: number;
  filter: "inbox" | "today";
  search: string;
  onSearch: (value: string) => void;
  onFilter: (value: "inbox" | "today") => void;
  onClose: () => void;
  onQuickAdd: () => void;
  onDragStart: (event: React.DragEvent, payload: DragPayload) => void;
  onComplete: (taskId: string) => void;
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
        <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search tasks" />
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
              <strong>{task.title}</strong>
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

function QuickAdd({ onClose, onAdd }: { onClose: () => void; onAdd: (title: string, duration: number, project: string) => void }) {
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(30);
  const [project, setProject] = useState("Personal OS");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    onAdd(title.trim(), duration, project);
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
            <select value={project} onChange={(event) => setProject(event.target.value)}>
              <option>Personal OS</option>
              <option>Landfill Rover</option>
              <option>Career capital</option>
              <option>Life admin</option>
              <option>Inbox</option>
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
