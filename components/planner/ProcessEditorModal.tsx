"use client";

import { useEffect, useMemo, useState } from "react";
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
const HOUR_UNITS = new Set(["h", "hr", "hrs", "hour", "hours"]);

function isMinuteUnit(unit?: string | null) {
  return Boolean(unit && MINUTE_UNITS.has(unit.trim().toLowerCase()));
}

function isHourUnit(unit?: string | null) {
  return Boolean(unit && HOUR_UNITS.has(unit.trim().toLowerCase()));
}

/** Suggest a count noun from the process name (e.g. applications, sections). */
export function guessCountUnit(name: string): string {
  const n = name.trim().toLowerCase();
  if (!n) return "sessions";
  if (/\b(applications?|applicat\w*|apply|apps?)\b/.test(n)) return "applications";
  if (/\bsections?\b/.test(n)) return "sections";
  if (/\boutreach|messages?|emails?\b/.test(n)) return "messages";
  if (/\binterviews?\b/.test(n) && !/\b(prepar|practic|study|mock)\b/.test(n)) return "interviews";
  if (/\b(problems?|leetcode|coding)\b/.test(n)) return "problems";
  if (/\bsessions?\b/.test(n)) return "sessions";
  if (/\breps?\b/.test(n)) return "reps";
  return "sessions";
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
  if (measurementType === "DURATION") {
    return {
      measurementType,
      targetValue: String(process?.targetValue ?? 2),
      unit: "h",
    };
  }
  const rawUnit = process?.unit?.trim() ?? "";
  const unit = !rawUnit || isHourUnit(rawUnit) || isMinuteUnit(rawUnit)
    ? guessCountUnit(process?.name ?? "")
    : rawUnit;
  return {
    measurementType,
    targetValue: String(process?.targetValue ?? 5),
    unit,
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

  const periodLabel =
    period === "DAY" ? "day" : period === "MONTH" ? "month" : "week";

  const previewUnit = measurementType === "DURATION"
    ? "h"
    : (unit.trim() || guessCountUnit(name));

  const preview = useMemo(
    () => `${targetValue || "0"} ${previewUnit} / ${periodLabel}`,
    [targetValue, previewUnit, periodLabel],
  );

  const setType = (next: GoalProcess["measurementType"]) => {
    setMeasurementType(next);
    if (next === "DURATION") {
      setUnit("h");
      return;
    }
    if (next === "COUNT" || next === "BINARY" || next === "CUSTOM_METRIC") {
      if (!unit.trim() || isHourUnit(unit) || isMinuteUnit(unit)) {
        setUnit(guessCountUnit(name));
      }
    }
  };

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
    const countUnit = unit.trim() || guessCountUnit(name);
    const next: GoalProcess = {
      id: process?.id ?? uid(),
      name: name.trim(),
      measurementType,
      targetValue: target,
      unit: measurementType === "DURATION" ? "h" : countUnit,
      period,
      active: process?.active ?? true,
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
        className="pos-qa-modal pos-entity-form-modal pos-process-editor"
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
          Define the weekly quota. Progress still comes from scheduled or completed sessions —
          you only edit the target here.
        </p>

        <div className="pos-qa-fields">
          <label className="pos-qa-field">
            <span className="pos-qa-field-label">Name</span>
            <input
              value={name}
              onChange={(e) => {
                const nextName = e.target.value;
                setName(nextName);
                if (
                  measurementType !== "DURATION"
                  && (!unit.trim() || unit === guessCountUnit(name) || isHourUnit(unit))
                ) {
                  setUnit(guessCountUnit(nextName));
                }
              }}
              placeholder="Quality applications"
              autoFocus
              disabled={saving}
            />
          </label>

          <div className="pos-qa-field">
            <span className="pos-qa-field-label">Measure as</span>
            <div className="pos-qa-for-tabs" role="group" aria-label="Measurement type">
              <button
                type="button"
                className={measurementType === "COUNT" ? "active" : undefined}
                onClick={() => setType("COUNT")}
                disabled={saving}
              >
                Count
              </button>
              <button
                type="button"
                className={measurementType === "DURATION" ? "active" : undefined}
                onClick={() => setType("DURATION")}
                disabled={saving}
              >
                Hours
              </button>
            </div>
          </div>

          <div className="pos-entity-form-row">
            <label className="pos-qa-field">
              <span className="pos-qa-field-label">Target</span>
              <input
                type="number"
                min="0"
                step={measurementType === "DURATION" ? "0.1" : "1"}
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                disabled={saving}
                aria-label="Target value"
              />
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

          {measurementType === "DURATION" ? (
            <div className="pos-qa-field">
              <span className="pos-qa-field-label">Unit</span>
              <input value="hours (h)" disabled readOnly aria-label="Duration unit" />
              <p className="pos-qa-for-hint">
                Measured from calendar sessions on linked tasks. Target is hours (2 = 2h/{periodLabel}).
              </p>
            </div>
          ) : (
            <label className="pos-qa-field">
              <span className="pos-qa-field-label">Unit label</span>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder={guessCountUnit(name)}
                disabled={saving}
                aria-label="Unit label"
              />
              <p className="pos-qa-for-hint">
                Shown next to numbers — e.g. applications, sections, sessions.
              </p>
            </label>
          )}

          <div className="pos-process-editor-preview" aria-live="polite">
            <span className="pos-qa-field-label">Preview</span>
            <strong className="pos-mono">{preview}</strong>
          </div>
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
