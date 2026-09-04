"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "../utils";
import {
  PRIORITY_META,
  type TaskHorizon,
  type TaskPriority,
  type TasksProjectOption,
} from "./types";

const FOR_OPTIONS: Array<{ id: TaskHorizon; label: string }> = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

export type QuickAddViewProps = {
  title: string;
  onTitleChange: (value: string) => void;
  projectId: string | null;
  onProjectChange: (projectId: string | null) => void;
  projects: TasksProjectOption[];
  /** Planning period membership — labeled "For", never "Due". */
  forHorizon: Exclude<TaskHorizon, null>;
  onForHorizonChange: (value: Exclude<TaskHorizon, null>) => void;
  duration: number;
  onDurationChange: (minutes: number) => void;
  priority: TaskPriority;
  onPriorityChange: (priority: TaskPriority) => void;
  /** Parent-owned period picker (date / week / month). */
  periodControl?: ReactNode;
  contextHint: string;
  /** Optional weekly repeat when For = Week. */
  repeatWeekly?: boolean;
  onRepeatWeeklyChange?: (value: boolean) => void;
  repeatWeeks?: string;
  onRepeatWeeksChange?: (value: string) => void;
  saving?: boolean;
  error?: string | null;
  onSubmit: () => void;
  onClose: () => void;
};

export function QuickAddView({
  title,
  onTitleChange,
  projectId,
  onProjectChange,
  projects,
  forHorizon,
  onForHorizonChange,
  duration,
  onDurationChange,
  priority,
  onPriorityChange,
  periodControl,
  contextHint,
  repeatWeekly = false,
  onRepeatWeeklyChange,
  repeatWeeks = "8",
  onRepeatWeeksChange,
  saving = false,
  error,
  onSubmit,
  onClose,
}: QuickAddViewProps) {
  return (
    <div className="pos-qa-backdrop">
      <button
        type="button"
        className="pos-qa-dismiss"
        aria-label="Close quick add"
        onClick={onClose}
      />
      <form
        className="pos-qa-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Quick add task"
        onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim() || saving) return;
          onSubmit();
        }}
      >
        <div className="pos-qa-header">
          <span className="pos-qa-eyebrow">Quick add</span>
          <button type="button" className="pos-qa-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <input
          className="pos-qa-title"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="What needs to get done?"
          aria-label="Task title"
          autoFocus
          disabled={saving}
        />

        <div className="pos-qa-fields">
          <div className="pos-qa-block">
            <label className="pos-qa-field">
              <span>Belongs to</span>
              <select
                value={projectId ?? ""}
                onChange={(event) => onProjectChange(event.target.value || null)}
                disabled={saving}
              >
                {projects.map((project) => (
                  <option key={project.id ?? "inbox"} value={project.id ?? ""}>
                    {project.title}
                  </option>
                ))}
              </select>
              <p className="pos-qa-for-hint">Project also links its Goal when configured.</p>
            </label>

            <div className="pos-qa-field">
              <span>For</span>
              <div className="pos-qa-for-tabs" role="group" aria-label="Planning period">
                {FOR_OPTIONS.map((option) => (
                  <button
                    key={option.id!}
                    type="button"
                    className={cn(forHorizon === option.id && "active")}
                    onClick={() => onForHorizonChange(option.id!)}
                    disabled={saving}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {periodControl}
              {(forHorizon === "week" || forHorizon === "month") && (
                <p className="pos-qa-for-hint">
                  {forHorizon === "week"
                    ? "Somewhere in this week — not a Monday deadline."
                    : "Somewhere in this month — not a day-1 deadline."}
                </p>
              )}
              {forHorizon === "week" && onRepeatWeeklyChange && (
                <div className="pos-qa-repeat">
                  <label className="pos-qa-repeat-toggle">
                    <input
                      type="checkbox"
                      checked={repeatWeekly}
                      onChange={(event) => onRepeatWeeklyChange(event.target.checked)}
                      disabled={saving}
                    />
                    <span>Repeat weekly</span>
                  </label>
                  {repeatWeekly && onRepeatWeeksChange && (
                    <label className="pos-qa-repeat-weeks">
                      <span>for</span>
                      <input
                        type="number"
                        min={1}
                        max={52}
                        value={repeatWeeks}
                        onChange={(event) => onRepeatWeeksChange(event.target.value)}
                        disabled={saving}
                      />
                      <span>weeks</span>
                    </label>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="pos-qa-block pos-qa-block-stack">
            <label className="pos-qa-field">
              <span>Estimated effort</span>
              <select
                value={duration}
                onChange={(event) => onDurationChange(Number(event.target.value))}
                disabled={saving}
              >
                {DURATION_OPTIONS.map((mins) => (
                  <option key={mins} value={mins}>
                    {mins < 60 ? `${mins} minutes` : mins === 60 ? "1 hour" : `${mins / 60} hours`}
                  </option>
                ))}
              </select>
            </label>

            <div className="pos-qa-priority" role="group" aria-label="Priority">
              <span className="pos-qa-field-label">Priority</span>
              <div className="pos-qa-priority-chips">
                {(Object.values(PRIORITY_META) as Array<(typeof PRIORITY_META)[TaskPriority]>).map(
                  (level) => (
                    <button
                      key={level.id}
                      type="button"
                      className={cn("pos-qa-priority-chip", priority === level.id && "active")}
                      style={{ "--pos-task-priority-color": level.color } as CSSProperties}
                      aria-pressed={priority === level.id}
                      title={`${level.label} · ${level.hint}`}
                      onClick={() => onPriorityChange(level.id)}
                      disabled={saving}
                    >
                      <i aria-hidden="true" />
                      <span>{level.label}</span>
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="pos-qa-error" role="alert">
            {error}
          </div>
        )}

        <div className="pos-qa-footer">
          <span className="pos-qa-hint">{saving ? "Saving…" : contextHint}</span>
          <div className="pos-qa-actions">
            <button type="button" className="pos-btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className="pos-btn-primary"
              disabled={saving || !title.trim()}
            >
              Add Task
              <span className="pos-qa-enter" aria-hidden="true">
                ↵
              </span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
