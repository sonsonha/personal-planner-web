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
  const [name, setName] = useState(process?.name ?? "");
  const [measurementType, setMeasurementType] = useState<GoalProcess["measurementType"]>(
    process?.measurementType ?? "COUNT",
  );
  const [targetValue, setTargetValue] = useState(String(process?.targetValue ?? 5));
  const [unit, setUnit] = useState(process?.unit ?? "");
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
      unit: unit.trim()
        || (measurementType === "DURATION" ? "h" : undefined),
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
          Processes measure repeated Goal progress — a weekly or monthly quota.
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
                    if (next === "DURATION" && !unit) setUnit("h");
                  }}
                  disabled={saving}
                  aria-label="Measurement type"
                >
                  <option value="COUNT">count</option>
                  <option value="DURATION">hours</option>
                  <option value="BINARY">binary</option>
                  <option value="CUSTOM_METRIC">custom</option>
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

          {(measurementType === "DURATION" || measurementType === "CUSTOM_METRIC" || unit) && (
            <label className="pos-qa-field">
              <span className="pos-qa-field-label">Unit label (optional)</span>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder={measurementType === "DURATION" ? "h" : "apps"}
                disabled={saving}
              />
            </label>
          )}

          <p className="pos-qa-for-hint">
            Example: {targetValue || "5"} {unit || (measurementType === "DURATION" ? "h" : "sessions")} / {periodLabel.toLowerCase()}
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
