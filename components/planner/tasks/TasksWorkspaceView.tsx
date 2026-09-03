"use client";

import type { ReactNode, RefObject } from "react";
import { EmptyState } from "../shared";
import { cn } from "../utils";
import { groupTasks } from "@/lib/task-groups";
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
  const groups = groupTasks(horizon, tasks, blocks, getHorizon, isOverdue);
  const empty = tasks.length === 0;

  return (
    <section className="pos-task" aria-label="Task workspace">
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
          groups.map((group) => (
            <section key={group.id} className="pos-task-group" aria-label={group.label}>
              <div className="pos-task-group-head">
                <span>{group.label}</span>
                <span className="pos-mono">{group.tasks.length}</span>
              </div>
              <div className="pos-task-group-list">
                {group.tasks.map((task) => {
                  const block = blockForTask(task.id, blocks);
                  return (
                    <TaskRow
                      key={task.id}
                      task={task}
                      block={block}
                      isOverdue={isOverdue(task)}
                      isSelected={selectedTaskId === task.id}
                      scheduleLabel={getScheduleLabel(task, block)}
                      horizonLabel={getHorizonLabel(task)}
                      onOpen={() => onOpenTask(task.id)}
                      onToggleComplete={() =>
                        task.status === "done" ? onRestore(task.id) : onComplete(task.id)
                      }
                    />
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>

      {footerHint && <p className="pos-task-footer-hint">{footerHint}</p>}
    </section>
  );
}
