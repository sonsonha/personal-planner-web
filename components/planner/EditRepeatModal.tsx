"use client";

import { useEffect, useState } from "react";

export type EditRepeatModalProps = {
  cadenceLabel?: string;
  weekCount: number;
  rangeLabel: string;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (weeks: number) => void | Promise<void>;
  onStopAfterThis: () => void | Promise<void>;
};

export function EditRepeatModal({
  cadenceLabel = "Weekly",
  weekCount,
  rangeLabel,
  saving = false,
  error,
  onClose,
  onSave,
  onStopAfterThis,
}: EditRepeatModalProps) {
  const [weeks, setWeeks] = useState(String(weekCount));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  return (
    <div className="pos-qa-backdrop">
      <button type="button" className="pos-qa-dismiss" aria-label="Close" onClick={onClose} disabled={saving} />
      <form
        className="pos-qa-modal pos-entity-form-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Edit repeat"
        onSubmit={(event) => {
          event.preventDefault();
          if (saving) return;
          const next = Math.max(1, Math.min(52, Number(weeks) || weekCount));
          void onSave(next);
        }}
      >
        <div className="pos-qa-header">
          <span className="pos-qa-eyebrow">Edit repeat</span>
          <button type="button" className="pos-qa-close" onClick={onClose} aria-label="Close" disabled={saving}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="pos-qa-fields">
          <label className="pos-qa-field">
            <span className="pos-qa-field-label">Frequency</span>
            <input value={cadenceLabel} readOnly disabled />
          </label>
          <label className="pos-qa-field">
            <span className="pos-qa-field-label">Range</span>
            <div className="pos-entity-form-inline">
              <input
                type="number"
                min={1}
                max={52}
                value={weeks}
                onChange={(event) => setWeeks(event.target.value)}
                disabled={saving}
                aria-label="Weeks from this instance"
              />
              <span className="pos-entity-form-suffix">future weeks</span>
            </div>
          </label>
          <p className="pos-qa-for-hint">Current series: {rangeLabel}</p>
        </div>

        {error && <p className="pos-entity-form-error">{error}</p>}

        <div className="pos-entity-form-footer">
          <div className="pos-entity-form-secondary">
            <button
              type="button"
              className="pos-btn-ghost"
              disabled={saving}
              onClick={() => void onStopAfterThis()}
            >
              Stop repeating after this instance
            </button>
          </div>
          <div className="pos-entity-form-primary">
            <button type="button" className="pos-btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="pos-btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
