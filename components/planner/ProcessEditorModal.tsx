"use client";

import { useEffect, useState } from "react";
import type { GoalProcess } from "@/lib/planner-api";

export type ProcessEditorModalProps = {
  process: GoalProcess | null;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (process: GoalProcess) => void | Promise<void>;
  onDelete?: (process: GoalProcess) => void | Promise<void>;
};

const MINUTE_UNITS = new Set(["min", "mins", "minute", "minutes", "m"]);

function isMinuteUnit(unit?: string | null) {
  return Boolean(unit && MINUTE_UNITS.has(unit.trim().toLowerCase()));
}

/** Editor always works in hours for DURATION; convert legacy minute targets. */
function initialEditorState(process: GoalProcess | null) {
  const measurementType = process?.measurementType ?? "COUNT";
  if (measurementType === "DURATION" && process && isMinuteUnit(process.unit)) {
    return {
      measurementType,
      targetValue: String(Math.round((process.targetValue / 60) * 10) / 10),
      unit: "h",
    };
  }
  return {
    measurementType,
    targetValue: String(process?.targetValue ?? 5),
    unit: measurementType === "DURATION" ? "h" : (process?.unit ?? ""),
  };
}

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `proc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ProcessEditorModal({
  process,
  saving = false,
  error,
  onClose,
  onSave,
  onDelete,
}: ProcessEditorModalProps) {
  const editing = Boolean(process);
  const initial = initialEditorState(process);
  const [name, setName] = useState(process?.name ?? "");
  const [measurementType, setMeasurementType] = useState<GoalProcess["measurementType"]>(
    initial.measurementType,
  );
  const [targetValue, setTargetValue] = useState(initial.targetValue);
  const [unit, setUnit] = useState(initial.unit);
  const [period, setPeriod] = useState<GoalProcess["period"]>(process?.period ?? "WEEK");
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
    if (!name.trim()) {
      setLocalError("Name is required.");
      return;
    }
    if (!Number.isFinite(target) || target < 0) {
      setLocalError("Enter a valid target.");
      return;
    }
    setLocalError(null);
    const next: GoalProcess = {
      id: process?.id ?? uid(),
      name: name.trim(),
      measurementType,
      targetValue: target,
      unit: measurementType === "DURATION"
        ? "h"
        : (unit.trim() || undefined),
      period,
      active: process?.active ?? true,
    };
    await onSave(next);
  };

  const periodLabel =
    period === "DAY" ? "Day" : period === "MONTH" ? "Month" : "Week";

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
        aria-label={editing ? "Edit process" : "New process"}
        onSubmit={(event) => {
          event.preventDefault();
          if (saving) return;
          void submit();
        }}
      >
        <div className="pos-qa-header">
          <span className="pos-qa-eyebrow">{editing ? "Edit process" : "New process"}</span>
          <button type="button" className="pos-qa-close" onClick={onClose} aria-label="Close" disabled={saving}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <p className="pos-entity-form-lede">
          Change the quota definition (name, count or hours, target). Evidence numbers update
          automatically from linked tasks that are scheduled or completed — they are not edited here.
        </p>

        <div className="pos-qa-fields">
          <label className="pos-qa-field">
            <span className="pos-qa-field-label">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Technical Preparation"
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
                  step="0.1"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  disabled={saving}
                  aria-label="Target value"
                />
                <select
                  value={measurementType}
                  onChange={(e) => {
                    const next = e.target.value as GoalProcess["measurementType"];
                    setMeasurementType(next);
                    if (next === "DURATION") setUnit("h");
                    if (next === "COUNT" && unit === "h") setUnit("");
                  }}
                  disabled={saving}
                  aria-label="Measurement type"
                >
                  <option value="COUNT">Count</option>
                  <option value="DURATION">Hours</option>
                  <optgroup label="Advanced">
                    <option value="BINARY">Binary</option>
                    <option value="CUSTOM_METRIC">Custom</option>
                  </optgroup>
                </select>
              </div>
            </label>
            <label className="pos-qa-field">
              <span className="pos-qa-field-label">Per</span>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as GoalProcess["period"])}
                disabled={saving}
                aria-label="Period"
              >
                <option value="WEEK">Week</option>
                <option value="MONTH">Month</option>
                <option value="DAY">Day</option>
              </select>
            </label>
          </div>

          {(measurementType === "COUNT" || measurementType === "CUSTOM_METRIC" || measurementType === "BINARY") && (
            <label className="pos-qa-field">
              <span className="pos-qa-field-label">Unit label (optional)</span>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="sessions"
                disabled={saving}
              />
            </label>
          )}

          {measurementType === "DURATION" && (
            <p className="pos-qa-for-hint">
              Hours are measured from calendar sessions on linked tasks (not from estimated effort).
              Target is in hours (e.g. 2 = 2h/week), not minutes.
            </p>
          )}

          <p className="pos-qa-for-hint">
            Example: {targetValue || "5"}{" "}
            {measurementType === "DURATION" ? "h" : (unit || "sessions")} / {periodLabel.toLowerCase()}
          </p>
        </div>

        {(localError || error) && <p className="pos-entity-form-error">{localError || error}</p>}

        <div className="pos-entity-form-footer">
          {editing && onDelete && process && (
            <div className="pos-entity-form-secondary">
              <button
                type="button"
                className="pos-btn-ghost danger"
                disabled={saving}
                onClick={() => {
                  if (!confirmDelete) {
                    setConfirmDelete(true);
                    return;
                  }
                  void onDelete(process);
                }}
              >
                {confirmDelete ? "Confirm delete" : "Delete"}
              </button>
            </div>
          )}
          <div className="pos-entity-form-primary">
            <button type="button" className="pos-btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="pos-btn-primary" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add Process"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
