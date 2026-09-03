"use client";

import { useEffect, useState } from "react";
import type { ApiSeriesScope } from "@/lib/planner-api";

export type DestructiveConfirmModalProps = {
  title: string;
  body: string;
  confirmLabel?: string;
  /** When true, show This instance / This and future radios (default This instance). */
  showSeriesScope?: boolean;
  saving?: boolean;
  onClose: () => void;
  onConfirm: (scope: ApiSeriesScope | null) => void | Promise<void>;
};

export function DestructiveConfirmModal({
  title,
  body,
  confirmLabel = "Delete",
  showSeriesScope = false,
  saving = false,
  onClose,
  onConfirm,
}: DestructiveConfirmModalProps) {
  const [scope, setScope] = useState<ApiSeriesScope>("THIS_INSTANCE");

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
      <div
        className="pos-qa-modal pos-entity-form-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="pos-qa-header">
          <span className="pos-qa-eyebrow">{title}</span>
          <button type="button" className="pos-qa-close" onClick={onClose} aria-label="Close" disabled={saving}>
            ×
          </button>
        </div>
        <p className="pos-qa-for-hint" style={{ margin: "0 20px 12px" }}>{body}</p>
        {showSeriesScope && (
          <div className="pos-destructive-scope" role="radiogroup" aria-label="Apply to">
            <label className={scope === "THIS_INSTANCE" ? "active" : undefined}>
              <input
                type="radio"
                name="destructive-scope"
                checked={scope === "THIS_INSTANCE"}
                onChange={() => setScope("THIS_INSTANCE")}
                disabled={saving}
              />
              <span>
                <strong>This instance only</strong>
                <small>Leave other repeats unchanged</small>
              </span>
            </label>
            <label className={scope === "THIS_AND_FUTURE" ? "active" : undefined}>
              <input
                type="radio"
                name="destructive-scope"
                checked={scope === "THIS_AND_FUTURE"}
                onChange={() => setScope("THIS_AND_FUTURE")}
                disabled={saving}
              />
              <span>
                <strong>This and future</strong>
                <small>Current and later repeats — past stays untouched</small>
              </span>
            </label>
          </div>
        )}
        <p className="pos-qa-for-hint" style={{ margin: "0 20px 12px" }}>
          This action cannot be undone.
        </p>
        <div className="pos-entity-form-footer">
          <div className="pos-entity-form-primary">
            <button type="button" className="pos-btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="button"
              className="danger-button"
              disabled={saving}
              onClick={() => void onConfirm(showSeriesScope ? scope : null)}
            >
              {saving ? "Working…" : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
