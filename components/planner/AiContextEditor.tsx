"use client";

import { useEffect, useState } from "react";
import {
  fetchAiContext,
  resetAiContext,
  saveAiContext,
} from "@/lib/ai-api";
import { PlannerApiError } from "@/lib/planner-api";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: (message: string) => void;
};

export function AiContextEditor({ open, onClose, onSaved }: Props) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDefaultSeed, setIsDefaultSeed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAiContext()
      .then((result) => {
        if (cancelled) return;
        setValue(result.aiContext);
        setIsDefaultSeed(result.isDefaultSeed);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof PlannerApiError ? err.message : "Could not load AI Context");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveAiContext(value);
      onSaved?.("AI Context saved");
      onClose();
    } catch (err) {
      setError(err instanceof PlannerApiError ? err.message : "Could not save AI Context");
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await resetAiContext();
      setValue(result.aiContext);
      setIsDefaultSeed(false);
      onSaved?.("AI Context reset");
    } catch (err) {
      setError(err instanceof PlannerApiError ? err.message : "Could not reset AI Context");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="gp-panel-backdrop">
      <button className="modal-dismiss" type="button" aria-label="Close" onClick={onClose} />
      <div className="gp-panel gp-create-panel" role="dialog" aria-modal="true">
        <div className="gp-panel-header">
          <div>
            <div className="eyebrow">Account</div>
            <h3>AI Context</h3>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="gp-panel-body">
          <p className="gp-guidance">
            Personal OS uses this context when generating Goal suggestions. It stays private to your account.
          </p>
          {isDefaultSeed ? (
            <p className="gp-guidance">Showing the initial owner default until you save your own version.</p>
          ) : null}
          {loading ? (
            <p className="gp-guidance">Loading…</p>
          ) : (
            <label>
              <span>Your context</span>
              <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                rows={16}
                placeholder="Background, priorities, planning preferences…"
              />
            </label>
          )}
          {error ? <p className="entity-error">{error}</p> : null}
        </div>
        <div className="gp-panel-footer">
          <button type="button" className="ghost-button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="ghost-button" onClick={() => void reset()} disabled={saving || loading}>
            Reset to default
          </button>
          <button type="button" className="primary-button" onClick={() => void save()} disabled={saving || loading}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
