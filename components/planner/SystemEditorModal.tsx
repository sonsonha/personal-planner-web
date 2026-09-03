"use client";

import { useEffect, useState } from "react";
import type { GoalSystem } from "@/lib/planner-api";

const DAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export function formatSystemPreferredDays(days: number[] | null | undefined) {
  if (!days?.length) return null;
  const labels = new Map(DAY_OPTIONS.map((d) => [d.value, d.label]));
  return [...days]
    .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
    .map((d) => labels.get(d) ?? String(d))
    .join(" · ");
}

export function formatSystemTarget(system: GoalSystem) {
  if (system.targetValue == null) return system.cadence ?? "Weekly";
  const unit =
    system.unit
    ?? (system.targetType === "DURATION" ? "hours" : "sessions");
  return `${system.targetValue} ${unit} / week`;
}

export type SystemEditorModalProps = {
  system: GoalSystem | null;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (system: GoalSystem) => void | Promise<void>;
  onPauseResume?: (system: GoalSystem) => void | Promise<void>;
  onComplete?: (system: GoalSystem) => void | Promise<void>;
  onDelete?: (system: GoalSystem) => void | Promise<void>;
};

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function SystemEditorModal({
  system,
  saving = false,
  error,
  onClose,
  onSave,
  onPauseResume,
  onComplete,
  onDelete,
}: SystemEditorModalProps) {
  const editing = Boolean(system);
  const [title, setTitle] = useState(system?.title ?? "");
  const [targetType, setTargetType] = useState<"COUNT" | "DURATION">(
    system?.targetType === "DURATION" ? "DURATION" : "COUNT",
  );
  const [targetValue, setTargetValue] = useState(String(system?.targetValue ?? 4));
  const [unit, setUnit] = useState(
    system?.unit
    ?? (system?.targetType === "DURATION" ? "hours" : "sessions"),
  );
  const [durationWeeks, setDurationWeeks] = useState(String(system?.durationWeeks ?? 8));
  const [preferredDays, setPreferredDays] = useState<number[]>(system?.preferredDays ?? []);
  const [preferredTime, setPreferredTime] = useState(system?.preferredTime ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const submit = async () => {
    const target = Number(targetValue);
    const weeks = Number(durationWeeks);
    if (!title.trim()) {
      setLocalError("Name is required.");
      return;
    }
    if (!Number.isFinite(target) || target < 0) {
      setLocalError("Enter a valid weekly target.");
      return;
    }
    if (!Number.isFinite(weeks) || weeks < 1) {
      setLocalError("Duration must be at least 1 week.");
      return;
    }
    setLocalError(null);
    const next: GoalSystem = {
      id: system?.id ?? uid(),
      title: title.trim(),
      targetType,
      targetValue: target,
      unit: unit.trim() || (targetType === "DURATION" ? "hours" : "sessions"),
      period: "WEEK",
      durationWeeks: weeks,
      status: system?.status ?? "ACTIVE",
      startDate: system?.startDate ?? null,
      preferredDays: preferredDays.length
        ? [...preferredDays].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
        : null,
      preferredTime: preferredTime.trim() || null,
    };
    await onSave(next);
  };

  return (
    <div className="pos-qa-backdrop">
      <button
        type="button"
        className="pos-qa-dismiss"
        aria-label="Close"
        onClick={onClose}
        disabled={saving}
      />
      <form
        className="pos-qa-modal pos-entity-form-modal"
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Edit system" : "New system"}
        onSubmit={(event) => {
          event.preventDefault();
          if (saving) return;
          void submit();
        }}
      >
        <div className="pos-qa-header">
          <span className="pos-qa-eyebrow">{editing ? "Edit system" : "New system"}</span>
          <button type="button" className="pos-qa-close" onClick={onClose} aria-label="Close" disabled={saving}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <p className="pos-entity-form-lede">What behavior do you want to repeat?</p>

        <div className="pos-qa-fields">
          <label className="pos-qa-field">
            <span className="pos-qa-field-label">Name</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="English Study"
              autoFocus
              disabled={saving}
            />
          </label>

          <div className="pos-entity-form-row">
            <label className="pos-qa-field">
              <span className="pos-qa-field-label">Target</span>
              <div className="pos-entity-form-inline">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  disabled={saving}
                  aria-label="Target value"
                />
                <select
                  value={targetType}
                  onChange={(e) => {
                    const next = e.target.value as "COUNT" | "DURATION";
                    setTargetType(next);
                    setUnit(next === "DURATION" ? "hours" : "sessions");
                  }}
                  disabled={saving}
                  aria-label="Target unit type"
                >
                  <option value="COUNT">sessions</option>
                  <option value="DURATION">hours</option>
                </select>
              </div>
            </label>
            <label className="pos-qa-field">
              <span className="pos-qa-field-label">Per</span>
              <input value="Week" readOnly disabled aria-label="Period" />
            </label>
          </div>

          <label className="pos-qa-field">
            <span className="pos-qa-field-label">For how long?</span>
            <div className="pos-entity-form-inline">
              <input
                type="number"
                min="1"
                value={durationWeeks}
                onChange={(e) => setDurationWeeks(e.target.value)}
                disabled={saving}
                aria-label="Duration weeks"
              />
              <span className="pos-entity-form-suffix">weeks</span>
            </div>
          </label>

          <div className="pos-qa-field">
            <span className="pos-qa-field-label">Preferred days (optional)</span>
            <div className="pos-entity-day-chips">
              {DAY_OPTIONS.map((day) => {
                const selected = preferredDays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    className={selected ? "pos-entity-day-chip active" : "pos-entity-day-chip"}
                    aria-pressed={selected}
                    disabled={saving}
                    onClick={() => setPreferredDays((current) =>
                      selected ? current.filter((d) => d !== day.value) : [...current, day.value],
                    )}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="pos-qa-field">
            <span className="pos-qa-field-label">Preferred time (optional)</span>
            <input
              type="time"
              value={preferredTime}
              onChange={(e) => setPreferredTime(e.target.value)}
              disabled={saving}
            />
          </label>

          <p className="pos-qa-for-hint">
            Preferred days and time are guidance only. Personal OS will not automatically create Tasks or Calendar events.
          </p>
        </div>

        {(localError || error) && <p className="pos-entity-form-error">{localError || error}</p>}

        <div className="pos-entity-form-footer">
          {editing && (
            <div className="pos-entity-form-secondary">
              {onPauseResume && system && (
                <button
                  type="button"
                  className="pos-btn-ghost"
                  disabled={saving}
                  onClick={() => void onPauseResume(system)}
                >
                  {system.status === "PAUSED" ? "Resume" : "Pause"}
                </button>
              )}
              {onComplete && system && system.status !== "COMPLETED" && (
                <button
                  type="button"
                  className="pos-btn-ghost"
                  disabled={saving}
                  onClick={() => void onComplete(system)}
                >
                  Complete
                </button>
              )}
              {onDelete && system && (
                <button
                  type="button"
                  className="pos-btn-ghost danger"
                  disabled={saving}
                  onClick={() => {
                    if (!confirmDelete) {
                      setConfirmDelete(true);
                      return;
                    }
                    void onDelete(system);
                  }}
                >
                  {confirmDelete ? "Confirm delete" : "Delete"}
                </button>
              )}
            </div>
          )}
          <div className="pos-entity-form-primary">
            <button type="button" className="pos-btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="pos-btn-primary" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add System"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
