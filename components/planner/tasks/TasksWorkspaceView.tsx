"use client";

import { useEffect, useMemo, useState, type ReactNode, type RefObject } from "react";
import { EmptyState } from "../shared";
import { cn } from "../utils";
import { groupTasks } from "@/lib/task-groups";
import { deriveTaskProgressFromSessions, directTaskCompletePolicy } from "@/lib/session-evidence";
import { isSessionDailyFocusOnDate } from "@/lib/daily-focus";
import { type WeekRoutineRow } from "@/lib/week-task-hierarchy";
import { TaskRow } from "./TaskRow";
import type {
  HorizonScope,
  TaskHorizon,
  TasksProjectOption,
  TasksViewBlock,
  TasksViewTask,
} from "./types";

const HORIZON_TABS: Array<{ id: HorizonScope; label: string }> = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "all", label: "All" },
];

function blockForTask(taskId: string, blocks: TasksViewBlock[]) {
  return blocks.find((block) => block.taskId === taskId);
}

function syntheticRoutineTask(routine: WeekRoutineRow): TasksViewTask {
  return {
    id: routine.representativeTaskId,
    title: routine.title,
    notes: "",
    projectId: routine.projectId,
    project: routine.project,
    color: routine.color,
    duration: 0,
    priority: "p2",
    status: "scheduled",
    dueAt: null,
    repeatSeriesId: routine.repeatSeriesId,
    projectType: "HABIT",
  };
}

export type TasksWorkspaceViewProps = {
  horizon: HorizonScope;
  periodCaption: string;
  /** Custom tabs; if omitted, built-in Day/Week/Month/All tabs are rendered. */
  horizonTabs?: ReactNode;
  onHorizonChange?: (horizon: HorizonScope) => void;
  tasks: TasksViewTask[];
  blocks: TasksViewBlock[];
  projects: TasksProjectOption[];
  showCompleted: boolean;
  onShowCompleted: (value: boolean) => void;
  query: string;
  onQuery: (value: string) => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  projectFilterId: string | "all" | "inbox";
  onProjectFilter: (value: string | "all" | "inbox") => void;
  selectedTaskId?: string | null;
  /** When set (Today Day view), group Daily Focus vs Supporting. */
  focusDate?: string | null;
  /** Week window for Core / Supporting / Routines hierarchy. */
  weekStartMs?: number;
  weekEndMs?: number;
  onChooseDailyFocus?: () => void;
  onAdd: () => void;
  onOpenTask: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  onRestore: (taskId: string) => void;
  onPrevPeriod?: () => void;
  onNextPeriod?: () => void;
  onJumpCurrent?: () => void;
  canJumpCurrent?: boolean;
  jumpCurrentLabel?: string;
  periodControl?: ReactNode;
  footerHint?: string;
  today: Date;
  getHorizon: (task: TasksViewTask) => TaskHorizon;
  getScheduleLabel: (task: TasksViewTask, block?: TasksViewBlock) => string;
  getHorizonLabel: (task: TasksViewTask) => string | null;
  isOverdue: (task: TasksViewTask) => boolean;
};

export function TasksWorkspaceView({
  horizon,
  periodCaption,
  horizonTabs,
  onHorizonChange,
  tasks,
  blocks,
  projects,
  showCompleted,
  onShowCompleted,
  query,
  onQuery,
  searchInputRef,
  projectFilterId,
  onProjectFilter,
  selectedTaskId,
  focusDate = null,
  weekStartMs,
  weekEndMs,
  onChooseDailyFocus,
  onAdd,
  onOpenTask,
  onComplete,
  onRestore,
  onPrevPeriod,
  onNextPeriod,
  onJumpCurrent,
  canJumpCurrent,
  jumpCurrentLabel,
  periodControl,
  footerHint,
  getHorizon,
  getScheduleLabel,
  getHorizonLabel,
  isOverdue,
}: TasksWorkspaceViewProps) {
  const emphasizeDailyFocus = horizon === "day" && Boolean(focusDate);
  const groups = groupTasks(horizon, tasks, blocks, getHorizon, isOverdue, {
    focusDate,
    emphasizeDailyFocus,
    weekStartMs,
    weekEndMs,
    showCompleted,
  });
  const empty = tasks.length === 0
    || (horizon === "week" && groups.every((group) => (group.rows?.length ?? group.tasks.length) === 0));

  const routinesGroup = groups.find((group) => group.id === "routines");
  const [routinesExpanded, setRoutinesExpanded] = useState<boolean | null>(null);
  const routinesOpen = routinesExpanded ?? !(routinesGroup?.defaultCollapsed ?? false);

  useEffect(() => {
    setRoutinesExpanded(null);
  }, [weekStartMs]);

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const quietPriority = horizon === "week";

  return (
    <section className="pos-task" aria-label="Task workspace" data-horizon={horizon}>
      <div className="pos-task-toolbar">
        <div className="pos-task-toolbar-primary">
          {horizonTabs ?? (
            <div className="pos-task-horizon-tabs" role="tablist" aria-label="Task period">
              {HORIZON_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={horizon === tab.id}
                  className={cn("pos-task-horizon-tab", horizon === tab.id && "active")}
                  onClick={() => onHorizonChange?.(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {horizon !== "all" && (
            <div className="pos-task-period-nav">
              {(onPrevPeriod || onNextPeriod) && (
                <div className="pos-task-pager">
                  <button
                    type="button"
                    aria-label="Previous period"
                    onClick={onPrevPeriod}
                    disabled={!onPrevPeriod}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Next period"
                    onClick={onNextPeriod}
                    disabled={!onNextPeriod}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              )}
              {periodControl}
              <span className="pos-task-period-caption">{periodCaption}</span>
              {canJumpCurrent && onJumpCurrent && (
                <button type="button" className="pos-task-jump-current" onClick={onJumpCurrent}>
                  {jumpCurrentLabel
                    ?? (horizon === "week" ? "This week" : horizon === "month" ? "This month" : "Today")}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="pos-task-toolbar-secondary">
          <label className="pos-task-show-completed">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(event) => onShowCompleted(event.target.checked)}
            />
            Show completed
          </label>

          <label className="pos-task-search">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M9.5 9.5L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <input
              ref={searchInputRef}
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder="Search tasks"
              aria-label="Search tasks"
            />
          </label>

          <label className="pos-task-project-filter task-project-filter">
            <span className="sr-only">Filter by project</span>
            <select
              value={projectFilterId}
              onChange={(event) => {
                const value = event.target.value;
                onProjectFilter(value === "all" || value === "inbox" ? value : value);
              }}
              aria-label="Filter by project"
            >
              <option value="all">All projects</option>
              {projects.filter((project) => project.id).map((project) => (
                <option key={project.id!} value={project.id!}>
                  {project.title}
                </option>
              ))}
              <option value="inbox">Inbox only</option>
            </select>
          </label>

          <button type="button" className="pos-btn-primary" onClick={onAdd}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M6.5 2v9M2 6.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Add Task
          </button>
        </div>
      </div>

      <div className="pos-task-table-head" aria-hidden="true">
        <span className="pos-task-col-task">Task</span>
        <span className="pos-task-col-calendar">Calendar</span>
        <span className="pos-task-col-period">Period</span>
        <span className="pos-task-col-pri">Pri</span>
        <span className="pos-task-col-est">Est</span>
      </div>

      <div className="pos-task-scroll">
        {empty ? (
          <EmptyState
            title={horizon === "all" ? "No tasks in this view" : `Nothing in this ${horizon}`}
            sub={
              horizon === "all"
                ? "Capture your next action, or turn on completed to look back."
                : horizon === "day"
                  ? "Day view shows tasks pinned to a specific day. Week membership stays in Week until you pick a day."
                  : "Add a task for this period, or schedule time on the calendar."
            }
          />
        ) : (
          groups.map((group) => {
            const isRoutines = group.id === "routines";
            const collapsed = isRoutines && !routinesOpen;
            const rowCount = group.rows?.length ?? group.tasks.length;
            const headMeta = isRoutines
              ? [
                  typeof group.plannedSessions === "number"
                    ? `${group.completedSessions ?? 0} / ${group.plannedSessions} sessions`
                    : null,
                  `${rowCount} routine${rowCount === 1 ? "" : "s"}`,
                ].filter(Boolean).join(" · ")
              : String(rowCount);

            return (
              <section
                key={group.id}
                className={cn(
                  "pos-task-group",
                  group.id === "core" && "pos-task-group-core",
                  isRoutines && "pos-task-group-routines",
                )}
                aria-label={group.label}
              >
                <div className="pos-task-group-head">
                  <span>{group.label}</span>
                  <span className="pos-task-group-head-right">
                    <span className="pos-mono">{headMeta}</span>
                    {isRoutines && group.collapsible && (
                      <button
                        type="button"
                        className="pos-task-routines-toggle"
                        aria-expanded={routinesOpen}
                        onClick={() => setRoutinesExpanded(!routinesOpen)}
                      >
                        {routinesOpen ? "Collapse" : "Show"}
                      </button>
                    )}
                  </span>
                </div>

                {group.id === "daily-focus" && group.tasks.length === 0 ? (
                  <div className="pos-daily-focus-empty">
                    <p>No Daily Focus selected.</p>
                    {onChooseDailyFocus && (
                      <button type="button" className="pos-btn-secondary" onClick={onChooseDailyFocus}>
                        Choose Daily Focus
                      </button>
                    )}
                  </div>
                ) : collapsed ? null : (
                  <div className="pos-task-group-list">
                    {group.rows
                      ? group.rows.map((row) => {
                          if (row.kind === "routine") {
                            const routineTask = syntheticRoutineTask(row.routine);
                            return (
                              <TaskRow
                                key={row.routine.key}
                                task={routineTask}
                                isOverdue={false}
                                isSelected={selectedTaskId === row.routine.representativeTaskId}
                                quietPriority={quietPriority}
                                hideComplete
                                sessionProgressLabel={
                                  `${row.routine.completedSessions} / ${row.routine.plannedSessions} sessions this week`
                                }
                                scheduleLabel={`${row.routine.plannedSessions} session${row.routine.plannedSessions === 1 ? "" : "s"}`}
                                horizonLabel="Routine"
                                onOpen={() => onOpenTask(row.routine.representativeTaskId)}
                                completeEnabled={false}
                                onToggleComplete={() => undefined}
                              />
                            );
                          }

                          const task = taskById.get(row.taskId);
                          if (!task) return null;
                          const meta = row.meta;
                          const block = blockForTask(task.id, blocks);
                          const taskBlocks = blocks.filter((candidate) => candidate.taskId === task.id);
                          const policy = directTaskCompletePolicy(
                            taskBlocks.map((item) => ({
                              id: item.id,
                              status: item.status ?? "PLANNED",
                            })),
                            { definitionOfDone: task.definitionOfDone },
                          );
                          const isCore = group.id === "core";
                          const focusDatesLabel = meta.focusWeekdays.length > 0
                            ? meta.focusWeekdays.join(" + ")
                            : null;
                          const sessionProgressLabel = meta.plannedSessions > 0
                            ? `${meta.completedSessions} / ${meta.plannedSessions} sessions`
                            : null;
                          const scheduleLabel = focusDatesLabel
                            ? `${focusDatesLabel} · ${meta.plannedSessions || meta.focusWeekdays.length} session${(meta.plannedSessions || meta.focusWeekdays.length) === 1 ? "" : "s"}`
                            : getScheduleLabel(task, block);

                          return (
                            <TaskRow
                              key={task.id}
                              task={task}
                              block={block}
                              isOverdue={isOverdue(task)}
                              isSelected={selectedTaskId === task.id}
                              isCoreWork={isCore}
                              quietPriority={quietPriority}
                              focusDatesLabel={focusDatesLabel}
                              sessionProgressLabel={sessionProgressLabel}
                              scheduleLabel={scheduleLabel}
                              horizonLabel={getHorizonLabel(task)}
                              completeEnabled={task.status === "done" || policy.allow}
                              onOpen={() => onOpenTask(task.id)}
                              onToggleComplete={() => {
                                if (task.status === "done") {
                                  onRestore(task.id);
                                  return;
                                }
                                if (!policy.allow) return;
                                onComplete(task.id);
                              }}
                            />
                          );
                        })
                      : group.tasks.map((task) => {
                          const block = blockForTask(task.id, blocks);
                          const taskBlocks = blocks.filter((candidate) => candidate.taskId === task.id);
                          const policy = directTaskCompletePolicy(
                            taskBlocks.map((item) => ({
                              id: item.id,
                              status: item.status ?? "PLANNED",
                            })),
                            { definitionOfDone: task.definitionOfDone },
                          );
                          const progress = deriveTaskProgressFromSessions(
                            taskBlocks.map((item) => ({
                              id: item.id,
                              status: item.status ?? "PLANNED",
                            })),
                          );
                          const sessionProgressLabel = progress.activeCount > 0
                            ? `${progress.completedCount} / ${progress.activeCount} sessions · ${progress.progressPercent}%`
                            : null;
                          const isFocus = Boolean(
                            focusDate
                            && taskBlocks.some((item) => isSessionDailyFocusOnDate(item, focusDate)),
                          );
                          return (
                            <TaskRow
                              key={task.id}
                              task={task}
                              block={block}
                              isOverdue={isOverdue(task)}
                              isSelected={selectedTaskId === task.id}
                              isDailyFocus={isFocus}
                              quietPriority={false}
                              sessionProgressLabel={sessionProgressLabel}
                              scheduleLabel={getScheduleLabel(task, block)}
                              horizonLabel={getHorizonLabel(task)}
                              onOpen={() => onOpenTask(task.id)}
                              completeEnabled={task.status === "done" || policy.allow}
                              onToggleComplete={() => {
                                if (task.status === "done") {
                                  onRestore(task.id);
                                  return;
                                }
                                if (!policy.allow) return;
                                onComplete(task.id);
                              }}
                            />
                          );
                        })}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>

      {footerHint && <p className="pos-task-footer-hint">{footerHint}</p>}
    </section>
  );
}
