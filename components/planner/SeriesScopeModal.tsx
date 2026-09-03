"use client";

import type { ApiSeriesScope } from "@/lib/planner-api";

export type SeriesScopeModalProps = {
  title?: string;
  entityLabel?: "task" | "session";
  saving?: boolean;
  onClose: () => void;
  onChoose: (scope: ApiSeriesScope) => void;
};

export function SeriesScopeModal({
  title = "Edit repeating item",
  entityLabel = "session",
  saving = false,
  onClose,
  onChoose,
}: SeriesScopeModalProps) {
  return (
    <div className="pos-qa-backdrop">
      <button
        type="button"
        className="pos-qa-dismiss"
        aria-label="Close"
        onClick={onClose}
        disabled={saving}
      />
      <div
        className="pos-qa-modal pos-entity-form-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="pos-qa-header">
          <span className="pos-qa-eyebrow">{title}</span>
          <button
            type="button"
            className="pos-qa-close"
            onClick={onClose}
            aria-label="Close"
            disabled={saving}
          >
            ×
          </button>
        </div>
        <p className="pos-qa-for-hint" style={{ margin: "0 20px 12px" }}>
          This {entityLabel} is part of a repeating series. Choose what to update.
        </p>
        <div className="pos-cal-popover-actions" style={{ padding: "0 16px 16px" }}>
          <button
            type="button"
            className="pos-cal-popover-action"
            disabled={saving}
            onClick={() => onChoose("THIS_INSTANCE")}
          >
            <span>This instance only</span>
            <small>Leave future repeats unchanged</small>
          </button>
          <button
            type="button"
            className="pos-cal-popover-action indigo"
            disabled={saving}
            onClick={() => onChoose("THIS_AND_FUTURE")}
          >
            <span>This and future</span>
            <small>Apply the change to this and later repeats</small>
          </button>
        </div>
        <div className="pos-entity-form-footer">
          <div className="pos-entity-form-primary">
            <button type="button" className="pos-btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
