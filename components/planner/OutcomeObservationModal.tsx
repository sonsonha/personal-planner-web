"use client";

import { useEffect, useState } from "react";
import type { GoalMetricObservation } from "@/lib/planner-api";

export type OutcomeObservationModalProps = {
  metricHint?: string | null;
  /** Parsed outcome target (e.g. 1 offer). Editable so users can fix 0/0-style bugs. */
  initialTarget?: number | null;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (
    observation: GoalMetricObservation,
    meta?: { target: number },
  ) => void | Promise<void>;
};

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `obs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function todayInputValue() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function OutcomeObservationModal({
  metricHint,
  initialTarget = null,
  saving = false,
  error,
  onClose,
  onSave,
}: OutcomeObservationModalProps) {
  const [value, setValue] = useState("0");
  const [target, setTarget] = useState(
    initialTarget != null && Number.isFinite(initialTarget) ? String(initialTarget) : "1",
  );
  const [date, setDate] = useState(todayInputValue);
  const [label, setLabel] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const submit = async () => {
    const numeric = Number(value);
    const targetNum = Number(target);
    if (!Number.isFinite(numeric)) {
      setLocalError("Enter a valid current value.");
      return;
    }
    if (!Number.isFinite(targetNum) || targetNum < 0) {
      setLocalError("Enter a valid target.");
      return;
    }
    if (!date) {
      setLocalError("Pick an observation date.");
      return;
    }
    setLocalError(null);
    const observedAt = new Date(`${date}T12:00:00`).toISOString();
    const trimmedLabel = label.trim();
    await onSave(
      {
        id: uid(),
        observedAt,
        value: numeric,
        label: trimmedLabel || undefined,
        note: trimmedLabel || undefined,
      },
      { target: targetNum },
    );
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
        aria-label="Update outcome"
        onSubmit={(event) => {
          event.preventDefault();
          if (saving) return;
          void submit();
        }}
      >
        <div className="pos-qa-header">
          <span className="pos-qa-eyebrow">Update outcome</span>
          <button type="button" className="pos-qa-close" onClick={onClose} aria-label="Close" disabled={saving}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <p className="pos-entity-form-lede">
          Set the outcome target and log the current value (for example offers received). Process
          evidence still comes from scheduled or completed sessions.
        </p>
        {metricHint?.trim() && (
          <p className="pos-qa-for-hint">Metric: {metricHint.trim()}</p>
        )}

        <div className="pos-qa-fields">
          <div className="pos-entity-form-row">
            <label className="pos-qa-field">
              <span className="pos-qa-field-label">Current value</span>
              <input
                type="number"
                step="any"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                disabled={saving}
                autoFocus
                aria-label="Current outcome value"
              />
            </label>
            <label className="pos-qa-field">
              <span className="pos-qa-field-label">Target</span>
              <input
                type="number"
                step="any"
                min="0"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                disabled={saving}
                aria-label="Outcome target"
              />
            </label>
          </div>
          <label className="pos-qa-field">
            <span className="pos-qa-field-label">Date</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              disabled={saving}
            />
          </label>
          <label className="pos-qa-field">
            <span className="pos-qa-field-label">Label (optional)</span>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="e.g. First offer received"
              disabled={saving}
            />
          </label>
        </div>

        {(localError || error) && <p className="pos-entity-form-error">{localError || error}</p>}

        <div className="pos-entity-form-footer">
          <div className="pos-entity-form-primary">
            <button type="button" className="pos-btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="pos-btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
