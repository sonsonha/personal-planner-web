"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "../utils";
import {
  PRIORITY_META,
  type TaskHorizon,
  type TaskPriority,
  type TasksGoalOption,
  type TasksProjectOption,
} from "./types";

const FOR_OPTIONS: Array<{ id: TaskHorizon; label: string }> = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

export type QuickAddViewProps = {
  title: string;
  onTitleChange: (value: string) => void;
  goalId: string | null;
  onGoalChange: (goalId: string | null) => void;
  goals: TasksGoalOption[];
  projectId: string | null;
  onProjectChange: (projectId: string | null) => void;
  /** Projects already filtered for the selected goal (plus Inbox/none). */
  projects: TasksProjectOption[];
  /** True until a Goal is chosen (Inbox path keeps project disabled too). */
  projectDisabled?: boolean;
  goalProcessId: string | null;
  onGoalProcessChange: (goalProcessId: string | null) => void;
  processes: Array<{ id: string; name: string }>;
  processHint?: string;
  /** Planning period membership — labeled "For", never "Due". */
  forHorizon: Exclude<TaskHorizon, null>;
  onForHorizonChange: (value: Exclude<TaskHorizon, null>) => void;
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
  goalId,
  onGoalChange,
  goals,
  projectId,
  onProjectChange,
  projects,
  projectDisabled = false,
  goalProcessId,
  onGoalProcessChange,
  processes,
  processHint,
  forHorizon,
  onForHorizonChange,
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
  const activeGoals = goals.filter(
    (goal) => goal.status === "ACTIVE" || goal.status === "active",
  );

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
              <span>Goal</span>
              <select
                value={goalId ?? ""}
                onChange={(event) => onGoalChange(event.target.value || null)}
                disabled={saving}
              >
                <option value="">No goal (Inbox)</option>
                {activeGoals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.outcome?.trim() || goal.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="pos-qa-field">
              <span>Project</span>
              <select
                value={projectId ?? ""}
                onChange={(event) => onProjectChange(event.target.value || null)}
                disabled={saving || projectDisabled}
              >
                {projects.map((project) => (
                  <option key={project.id ?? "inbox"} value={project.id ?? ""}>
                    {project.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="pos-qa-field">
              <span>Process</span>
              <select
                value={goalProcessId ?? ""}
                onChange={(event) => onGoalProcessChange(event.target.value || null)}
                disabled={saving || !goalId}
              >
                <option value="">None</option>
                {processes.map((process) => (
                  <option key={process.id} value={process.id}>
                    {process.name}
                  </option>
                ))}
              </select>
              {processHint && <p className="pos-qa-for-hint">{processHint}</p>}
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
