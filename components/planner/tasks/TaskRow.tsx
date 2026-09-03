"use client";

import type { CSSProperties } from "react";
import { ScheduledBadge, UnscheduledBadge } from "../shared";
import { cn } from "../utils";
import {
  formatTaskDuration,
  priorityMeta,
  type TasksViewBlock,
  type TasksViewTask,
} from "./types";

export type TaskRowProps = {
  task: TasksViewTask;
  block?: TasksViewBlock;
  isOverdue: boolean;
  isSelected: boolean;
  /** Calendar column copy — parent owns schedule formatting. */
  scheduleLabel: string;
  /** Period column — parent owns period-safe labels (never invent WEEK/MONTH due dates). */
  horizonLabel: string | null;
  onOpen: () => void;
  onToggleComplete: () => void;
};

export function TaskRow({
  task,
  block,
  isOverdue,
  isSelected,
  scheduleLabel,
  horizonLabel,
  onOpen,
  onToggleComplete,
}: TaskRowProps) {
  const priority = priorityMeta(task.priority);
  const done = task.status === "done";
  const showUnscheduledBadge = !block && Boolean(task.dueHorizon);

  return (
    <article
      className={cn(
        "pos-task-row",
        isSelected && "selected",
        done && "done",
        isOverdue && "overdue",
      )}
      data-task-id={task.id}
    >
      <button
        type="button"
        className={cn("pos-task-check", done && "done")}
        aria-label={done ? `Restore ${task.title}` : `Complete ${task.title}`}
        onClick={(event) => {
          event.stopPropagation();
          onToggleComplete();
        }}
      >
        {done ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M3 7.2l2.4 2.4L11 4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <span className="pos-task-check-ring" aria-hidden="true" />
        )}
      </button>

      <button type="button" className="pos-task-main" onClick={onOpen}>
        <span className="pos-task-title">{task.title}</span>
        <span className="pos-task-project">
          <i style={{ background: task.color }} aria-hidden="true" />
          {task.project}
        </span>
      </button>

      <div className="pos-task-calendar">
        {showUnscheduledBadge ? (
          <UnscheduledBadge />
        ) : block ? (
          <ScheduledBadge label={scheduleLabel} />
        ) : (
          <span className="pos-task-calendar-muted">{scheduleLabel}</span>
        )}
      </div>

      <div className={cn("pos-task-period", isOverdue && "overdue")}>
        {horizonLabel ? (
          <span>{horizonLabel}</span>
        ) : (
          <span className="pos-task-period-empty">—</span>
        )}
      </div>

      <div
        className="pos-task-priority"
        style={{ "--pos-task-priority-color": priority.color } as CSSProperties}
        title={`${priority.label} · ${priority.hint}`}
      >
        <i aria-hidden="true" />
        <span>{priority.label}</span>
      </div>

      <div className="pos-task-duration pos-mono">{formatTaskDuration(task.duration)}</div>
    </article>
  );
}
