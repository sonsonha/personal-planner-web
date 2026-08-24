"use client";

import { useState } from "react";
import type { GoalStructureSuggestion } from "@/lib/ai-api";
import {
  acceptGoalStructure,
  copyTextToClipboard,
  exportGoalStructureSuggestion,
  suggestGoalStructure,
} from "@/lib/ai-api";
import type { GoalFocusType } from "@/lib/planner-api";
import { PlannerApiError } from "@/lib/planner-api";

type Props = {
  title: string;
  why: string;
  targetDate: string;
  focusType: GoalFocusType;
  suggestion: GoalStructureSuggestion;
  onSuggestionChange: (next: GoalStructureSuggestion) => void;
  onClose: () => void;
  onSaved: (message: string) => void;
  onRegenerate: () => Promise<void>;
  regenerating?: boolean;
};

export function GoalStructureReview({
  title,
  why,
  targetDate,
  focusType,
  suggestion,
  onSuggestionChange,
  onClose,
  onSaved,
  onRegenerate,
  regenerating,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedActions, setSelectedActions] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const update = (patch: Partial<GoalStructureSuggestion>) => {
    onSuggestionChange({ ...suggestion, ...patch });
  };

  const useStructure = async () => {
    setSaving(true);
    setError(null);
    try {
      await acceptGoalStructure({
        title: suggestion.outcome?.statement?.trim() || title,
        why,
        targetDate: targetDate || null,
        focusType,
        suggestion,
        selectedNextActionIndexes: [...selectedActions],
      });
      onSaved("Goal structure saved");
    } catch (err) {
      setSaving(false);
      setError(
        err instanceof PlannerApiError
          ? err.message
          : "Could not save this structure. Try again or create manually.",
      );
    }
  };

  const copySuggestion = async () => {
    try {
      const { markdown } = await exportGoalStructureSuggestion({
        title,
        why,
        targetDate: targetDate || null,
        suggestion,
      });
      const ok = await copyTextToClipboard(markdown);
      setToast(ok ? "Context copied" : "Could not copy — select and copy manually");
    } catch {
      setToast("Could not export suggestion");
    }
  };

  return (
    <div className="gp-panel-backdrop">
      <button className="modal-dismiss" type="button" aria-label="Close" onClick={onClose} />
      <div className="gp-panel gp-create-panel gp-ai-review-panel" role="dialog" aria-modal="true">
        <div className="gp-panel-header">
          <div>
            <div className="eyebrow">AI suggestion · review before saving</div>
            <h3>Edit this Goal structure</h3>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="gp-panel-body gp-ai-review-body">
          <p className="gp-guidance">
            Personal OS uses your saved AI Context and current planner context when generating suggestions.
            Nothing is saved until you use this structure.
          </p>

          <label className="gp-outcome-field">
            <span>Outcome</span>
            <textarea
              value={suggestion.outcome?.statement ?? ""}
              onChange={(e) =>
                update({
                  outcome: {
                    statement: e.target.value,
                    confidence: suggestion.outcome?.confidence ?? "MEDIUM",
                  },
                })
              }
              rows={2}
            />
            {suggestion.outcome?.confidence && (
              <span className="gp-ai-meta">Confidence: {suggestion.outcome.confidence}</span>
            )}
          </label>

          <section className="gp-ai-section">
            <h4>Metrics</h4>
            {suggestion.metrics.map((metric, index) => (
              <div key={`m-${index}`} className="gp-ai-card">
                <input
                  value={metric.name}
                  onChange={(e) => {
                    const metrics = [...suggestion.metrics];
                    metrics[index] = { ...metric, name: e.target.value };
                    update({ metrics });
                  }}
                />
                <div className="gp-ai-row">
                  <label>
                    Current
                    <input
                      type="number"
                      value={metric.currentValue ?? ""}
                      onChange={(e) => {
                        const metrics = [...suggestion.metrics];
                        metrics[index] = {
                          ...metric,
                          currentValue: e.target.value === "" ? null : Number(e.target.value),
                        };
                        update({ metrics });
                      }}
                    />
                  </label>
                  <label>
                    Target
                    <input
                      type="number"
                      value={metric.targetValue ?? ""}
                      onChange={(e) => {
                        const metrics = [...suggestion.metrics];
                        metrics[index] = {
                          ...metric,
                          targetValue: e.target.value === "" ? null : Number(e.target.value),
                        };
                        update({ metrics });
                      }}
                    />
                  </label>
                </div>
                {metric.needsUserDecision && (
                  <p className="gp-guidance">Metric needs clarification.</p>
                )}
                {metric.possibleAlternatives?.length ? (
                  <p className="gp-ai-why">Alternatives: {metric.possibleAlternatives.join("; ")}</p>
                ) : null}
                {metric.rationale ? <p className="gp-ai-why">Why: {metric.rationale}</p> : null}
                <button
                  type="button"
                  className="pos-btn-ghost"
                  onClick={() => update({ metrics: suggestion.metrics.filter((_, i) => i !== index) })}
                >
                  Remove
                </button>
              </div>
            ))}
          </section>

          <section className="gp-ai-section">
            <div className="gp-ai-section-head">
              <h4>Milestones</h4>
              <button
                type="button"
                className="pos-btn-ghost"
                onClick={() =>
                  update({
                    milestones: [...suggestion.milestones, { title: "New milestone" }],
                  })
                }
              >
                + Add
              </button>
            </div>
            {suggestion.milestones.map((item, index) => (
              <div key={`ms-${index}`} className="gp-ai-card gp-ai-card-row">
                <input
                  value={item.title}
                  onChange={(e) => {
                    const milestones = [...suggestion.milestones];
                    milestones[index] = { ...item, title: e.target.value };
                    update({ milestones });
                  }}
                />
                <button
                  type="button"
                  className="pos-btn-ghost"
                  onClick={() =>
                    update({ milestones: suggestion.milestones.filter((_, i) => i !== index) })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </section>

          <section className="gp-ai-section">
            <div className="gp-ai-section-head">
              <h4>Systems / Processes</h4>
              <button
                type="button"
                className="pos-btn-ghost"
                onClick={() =>
                  update({
                    processes: [
                      ...suggestion.processes,
                      {
                        name: "New process",
                        metricType: "COUNT",
                        targetValue: 1,
                        period: "WEEK",
                        confidence: "MEDIUM",
                      },
                    ],
                  })
                }
              >
                + Add
              </button>
            </div>
            {suggestion.processes.map((proc, index) => (
              <div key={`p-${index}`} className="gp-ai-card">
                <input
                  value={proc.name}
                  onChange={(e) => {
                    const processes = [...suggestion.processes];
                    processes[index] = { ...proc, name: e.target.value };
                    update({ processes });
                  }}
                />
                <div className="gp-ai-row">
                  <label>
                    Target / week
                    <input
                      type="number"
                      value={proc.targetValue}
                      onChange={(e) => {
                        const processes = [...suggestion.processes];
                        processes[index] = { ...proc, targetValue: Number(e.target.value) || 0 };
                        update({ processes });
                      }}
                    />
                  </label>
                  <label>
                    Type
                    <select
                      value={proc.metricType}
                      onChange={(e) => {
                        const processes = [...suggestion.processes];
                        processes[index] = {
                          ...proc,
                          metricType: e.target.value as "COUNT" | "DURATION",
                        };
                        update({ processes });
                      }}
                    >
                      <option value="COUNT">Count</option>
                      <option value="DURATION">Duration (min)</option>
                    </select>
                  </label>
                </div>
                {proc.rationale ? <p className="gp-ai-why">Why: {proc.rationale}</p> : null}
                <button
                  type="button"
                  className="pos-btn-ghost"
                  onClick={() =>
                    update({ processes: suggestion.processes.filter((_, i) => i !== index) })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </section>

          <section className="gp-ai-section">
            <div className="gp-ai-section-head">
              <h4>Projects</h4>
              <button
                type="button"
                className="pos-btn-ghost"
                onClick={() =>
                  update({
                    projects: [
                      ...suggestion.projects,
                      { title: "New project", purpose: "", suggestedDefaultProcessName: null },
                    ],
                  })
                }
              >
                + Add
              </button>
            </div>
            {suggestion.projects.map((project, index) => (
              <div key={`pr-${index}`} className="gp-ai-card">
                <input
                  value={project.title}
                  onChange={(e) => {
                    const projects = [...suggestion.projects];
                    projects[index] = { ...project, title: e.target.value };
                    update({ projects });
                  }}
                />
                <textarea
                  value={project.purpose ?? ""}
                  placeholder="Purpose"
                  rows={2}
                  onChange={(e) => {
                    const projects = [...suggestion.projects];
                    projects[index] = { ...project, purpose: e.target.value };
                    update({ projects });
                  }}
                />
                {project.rationale ? <p className="gp-ai-why">Why: {project.rationale}</p> : null}
                <button
                  type="button"
                  className="pos-btn-ghost"
                  onClick={() =>
                    update({ projects: suggestion.projects.filter((_, i) => i !== index) })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </section>

          <label>
            <span>Time protected (minutes / week)</span>
            <input
              type="number"
              value={suggestion.timeProtectedMinutesPerWeek ?? ""}
              onChange={(e) =>
                update({
                  timeProtectedMinutesPerWeek:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>

          <section className="gp-ai-section">
            <h4>Suggested next actions</h4>
            <p className="gp-guidance">Optional — only checked items become Tasks.</p>
            {suggestion.nextActions.map((action, index) => (
              <label key={`a-${index}`} className="gp-ai-check-row">
                <input
                  type="checkbox"
                  checked={selectedActions.has(index)}
                  onChange={(e) => {
                    const next = new Set(selectedActions);
                    if (e.target.checked) next.add(index);
                    else next.delete(index);
                    setSelectedActions(next);
                  }}
                />
                <span>{action.title}</span>
              </label>
            ))}
          </section>

          {(suggestion.assumptions.length > 0 || (suggestion.questionsForUser?.length ?? 0) > 0) && (
            <section className="gp-ai-section">
              <h4>Assumptions / questions</h4>
              <ul className="gp-ai-list">
                {suggestion.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
                {suggestion.questionsForUser?.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </section>
          )}

          {error ? <p className="gp-error">{error}</p> : null}
          {toast ? <p className="gp-guidance">{toast}</p> : null}
        </div>

        <div className="gp-panel-footer gp-ai-footer">
          <button type="button" className="pos-btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="pos-btn-ghost" onClick={() => void copySuggestion()} disabled={saving}>
            Copy suggestion
          </button>
          <button
            type="button"
            className="pos-btn-ghost"
            onClick={() => void onRegenerate()}
            disabled={saving || regenerating}
          >
            {regenerating ? "Regenerating…" : "Regenerate"}
          </button>
          <button
            type="button"
            className="pos-btn-primary"
            onClick={() => void useStructure()}
            disabled={saving || suggestion.projects.length === 0}
          >
            {saving ? "Saving…" : "Use this structure"}
          </button>
        </div>
      </div>
    </div>
  );
}

export async function generateGoalSuggestion(input: {
  title: string;
  why?: string;
  targetDate?: string | null;
}): Promise<GoalStructureSuggestion> {
  const { suggestion } = await suggestGoalStructure(input);
  return suggestion;
}
