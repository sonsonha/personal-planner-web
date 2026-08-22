"use client";

import type { CSSProperties } from "react";
import { cn } from "../utils";
import {
  formatTaskDuration,
  PRIORITY_META,
  type TaskHorizon,
  type TaskPriority,
  type TaskStatus,
  type TasksGoalOption,
  type TasksProjectOption,
} from "./types";

const FOR_SCOPES: Array<{ id: "none" | Exclude<TaskHorizon, null>; label: string }> = [
  { id: "none", label: "Unspecified" },
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;

export type TaskEditorViewProps = {
  title: string;
  onTitleChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  status: TaskStatus;
  scheduled: boolean;
  scheduleDisplay?: string | null;
  projectId: string | null;
  onProjectChange: (projectId: string | null) => void;
  projects: TasksProjectOption[];
  goalId: string | null;
  onGoalChange: (goalId: string | null) => void;
  goals: TasksGoalOption[];
  goalProcessId: string | null;
  onGoalProcessChange: (goalProcessId: string | null) => void;
  /** True when process comes from project.defaultGoalProcessId without explicit override. */
  inherited?: boolean;
  inheritedProcessLabel?: string | null;
  inheritedFromProjectTitle?: string | null;
  forScope: "none" | "day" | "week" | "month";
  onForScopeChange: (scope: "none" | "day" | "week" | "month") => void;
  forDate: string;
  onForDateChange: (value: string) => void;
  priority: TaskPriority;
  onPriorityChange: (priority: TaskPriority) => void;
  duration: number;
  onDurationChange: (minutes: number) => void;
  scheduleDate: string;
  onScheduleDateChange: (value: string) => void;
  scheduleTime: string;
  onScheduleTimeChange: (value: string) => void;
  syncStatus?: "PENDING" | "SYNCED" | "FAILED" | null;
  syncMessage?: string | null;
  loadingSchedule?: boolean;
  saving?: boolean;
  error?: string | null;
  confirmDelete?: boolean;
  onComplete?: () => void;
  onRestore?: () => void;
  onUnschedule?: () => void;
  onDelete: () => void;
  onSaveDetails: () => void;
  onSchedule: () => void;
  onClose: () => void;
};

export function TaskEditorView({
  title,
  onTitleChange,
  notes,
  onNotesChange,
  status,
  scheduled,
  scheduleDisplay,
  projectId,
  onProjectChange,
  projects,
  goalId,
  onGoalChange,
  goals,
  goalProcessId,
  onGoalProcessChange,
  inherited = false,
  inheritedProcessLabel,
  inheritedFromProjectTitle,
  forScope,
  onForScopeChange,
  forDate,
  onForDateChange,
  priority,
  onPriorityChange,
  duration,
  onDurationChange,
  scheduleDate,
  onScheduleDateChange,
  scheduleTime,
  onScheduleTimeChange,
  syncStatus,
  syncMessage,
  loadingSchedule = false,
  saving = false,
  error,
  confirmDelete = false,
  onComplete,
  onRestore,
  onUnschedule,
  onDelete,
  onSaveDetails,
  onSchedule,
  onClose,
}: TaskEditorViewProps) {
  const selectedGoal = goals.find((goal) => goal.id === goalId);
  const processes = (selectedGoal?.processes ?? []).filter((process) => process.active);
  const statusLabel = status === "done" ? "Completed" : scheduled ? "Scheduled" : "Unscheduled";

  return (
    <div className="pos-te-backdrop">
      <button
        type="button"
        className="pos-te-dismiss"
        aria-label="Close task editor"
        onClick={onClose}
      />
      <aside
        className="pos-te-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${title || "task"}`}
      >
        <div className="pos-te-header">
          <div className="pos-te-status-row">
            {status === "done" ? (
              <button
                type="button"
                className="pos-te-status-pill restore"
                onClick={onRestore}
                disabled={saving || !onRestore}
              >
                Restore
              </button>
            ) : (
              <button
                type="button"
                className="pos-te-status-pill complete"
                onClick={onComplete}
                disabled={saving || !onComplete}
              >
                Mark complete
              </button>
            )}
            <span className={cn("pos-te-schedule-chip", scheduled ? "scheduled" : "unscheduled")}>
              {statusLabel}
            </span>
          </div>
          <button type="button" className="pos-te-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="pos-te-body">
          <label className="pos-te-title-field">
            <span className="sr-only">Title</span>
            <input
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="Task title"
              disabled={saving}
            />
          </label>

          <section className="pos-te-section" aria-labelledby="pos-te-context">
            <h3 id="pos-te-context" className="pos-te-section-title">
              Task context
            </h3>
            <div className="pos-te-field-grid">
              <label>
                <span>Project</span>
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
              </label>
              <label>
                <span>Goal</span>
                <select
                  value={goalId ?? ""}
                  onChange={(event) => onGoalChange(event.target.value || null)}
                  disabled={saving}
                >
                  <option value="">None</option>
                  {goals
                    .filter((goal) => goal.status === "ACTIVE" || goal.status === "active")
                    .map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.outcome?.trim() || goal.title}
                      </option>
                    ))}
                </select>
              </label>
              <label>
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
                {inherited && inheritedProcessLabel && (
                  <small className="pos-te-inherited">
                    {inheritedProcessLabel}
                    {inheritedFromProjectTitle
                      ? ` · Inherited from ${inheritedFromProjectTitle}`
                      : " · Inherited from project"}
                  </small>
                )}
              </label>
            </div>
          </section>

          <section className="pos-te-section" aria-labelledby="pos-te-planning">
            <h3 id="pos-te-planning" className="pos-te-section-title">
              Planning period
            </h3>
            <div className="pos-te-for">
              <span className="pos-te-field-label">For</span>
              <div className="pos-te-for-tabs" role="group" aria-label="Planning period">
                {FOR_SCOPES.map((scope) => (
                  <button
                    key={scope.id}
                    type="button"
                    className={cn(forScope === scope.id && "active")}
                    onClick={() => onForScopeChange(scope.id)}
                    disabled={saving}
                  >
                    {scope.label}
                  </button>
                ))}
              </div>
              {forScope !== "none" && (
                <>
                  <label className="pos-te-date-field">
                    <span>
                      {forScope === "day"
                        ? "Due date"
                        : forScope === "week"
                          ? "Week of"
                          : "Month of"}
                    </span>
                    <input
                      type="date"
                      value={forDate}
                      onChange={(event) => onForDateChange(event.target.value)}
                      disabled={saving}
                    />
                  </label>
                  {forScope === "week" && (
                    <p className="pos-te-help">
                      Stays in Week view until you pin a specific day or calendar time. Not a Monday deadline.
                    </p>
                  )}
                  {forScope === "month" && (
                    <p className="pos-te-help">
                      Stays in Month view until you pin a week or day. Not a day-1 deadline.
                    </p>
                  )}
                </>
              )}
            </div>
          </section>

          <section className="pos-te-section" aria-labelledby="pos-te-calendar">
            <h3 id="pos-te-calendar" className="pos-te-section-title">
              Calendar
            </h3>
            {loadingSchedule ? (
              <p className="pos-te-help">Checking schedule…</p>
            ) : scheduled && scheduleDisplay ? (
              <div className="pos-te-schedule-display">
                <p className="pos-mono">{scheduleDisplay}</p>
                <p className="pos-te-help">
                  Completing keeps this block on the calendar with completed styling.
                </p>
              </div>
            ) : null}
            <div className="pos-te-schedule-fields">
              <label>
                <span>Date</span>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(event) => onScheduleDateChange(event.target.value)}
                  disabled={saving}
                />
              </label>
              <label>
                <span>Start</span>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(event) => onScheduleTimeChange(event.target.value)}
                  disabled={saving}
                />
              </label>
              <div>
                <span>Length</span>
                <strong className="pos-mono">{formatTaskDuration(duration)}</strong>
              </div>
            </div>
            {scheduled && onUnschedule && (
              <button
                type="button"
                className="pos-te-unschedule"
                onClick={onUnschedule}
                disabled={saving}
              >
                Unschedule
              </button>
            )}
            <p className="pos-te-help">
              {scheduled
                ? "Unschedule removes the calendar block only — the task and its planning period stay."
                : "Schedule when you are ready to protect time. Unschedule later is not delete."}
            </p>
          </section>

          <section className="pos-te-section" aria-labelledby="pos-te-details">
            <h3 id="pos-te-details" className="pos-te-section-title">
              Details
            </h3>
            <div className="pos-te-field-grid">
              <div className="pos-te-priority-field">
                <span className="pos-te-field-label">Priority</span>
                <div className="pos-te-priority-chips" role="group" aria-label="Priority">
                  {(Object.values(PRIORITY_META) as Array<(typeof PRIORITY_META)[TaskPriority]>).map(
                    (level) => (
                      <button
                        key={level.id}
                        type="button"
                        className={cn("pos-te-priority-chip", priority === level.id && "active")}
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
              <label>
                <span>Duration</span>
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
            </div>
            <label className="pos-te-notes">
              <span>Notes</span>
              <textarea
                value={notes}
                onChange={(event) => onNotesChange(event.target.value)}
                placeholder="Context, links, or the definition of done…"
                rows={4}
                disabled={saving}
              />
            </label>
          </section>

          {syncStatus && (
            <section className="pos-te-section pos-te-sync" aria-label="Sync state">
              <span className={cn("pos-te-sync-chip", syncStatus.toLowerCase())}>
                {syncStatus === "SYNCED"
                  ? "Synced"
                  : syncStatus === "PENDING"
                    ? "Sync pending"
                    : "Sync failed"}
              </span>
              {syncMessage && <p className="pos-te-help">{syncMessage}</p>}
            </section>
          )}

          {error && (
            <div className="pos-te-error" role="alert">
              {error}
            </div>
          )}
        </div>

        <div className="pos-te-footer">
          <button
            type="button"
            className={cn("pos-te-delete", confirmDelete && "confirm")}
            onClick={onDelete}
            disabled={saving}
          >
            {confirmDelete ? "Click again to delete" : "Delete"}
          </button>
          <div className="pos-te-footer-actions">
            <button
              type="button"
              className="pos-btn-secondary"
              onClick={onSaveDetails}
              disabled={saving || loadingSchedule}
            >
              Save details
            </button>
            <button
              type="button"
              className="pos-btn-primary"
              onClick={onSchedule}
              disabled={saving || loadingSchedule}
            >
              {saving ? "Saving…" : scheduled ? "Save & sync" : "Schedule"}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
