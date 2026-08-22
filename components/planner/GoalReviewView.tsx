"use client";

import type { ReactNode } from "react";
import type { ApiGoal, ApiGoalProgress, GoalOutcomeStatus, GoalReflection } from "@/lib/planner-api";
import { BackButton, GoalBadge } from "./shared";
import { cn } from "./utils";
import { formatShortDate } from "@/app/goal-project-workspaces";

const OUTCOME_OPTIONS: Array<{
  status: Exclude<GoalOutcomeStatus, "ACTIVE">;
  label: string;
  sub: string;
}> = [
  { status: "ACHIEVED_ON_TIME", label: "Achieved on time", sub: "Outcome met by target date" },
  { status: "ACHIEVED_LATE", label: "Achieved late", sub: "Outcome met after target date" },
  { status: "PARTIALLY_ACHIEVED", label: "Partially achieved", sub: "Part of the intended outcome was met" },
  { status: "NOT_ACHIEVED", label: "Not achieved", sub: "Outcome was not met" },
  { status: "STOPPED_INTENTIONALLY", label: "Stopped intentionally", sub: "Consciously chose to stop pursuing it" },
  { status: "NO_LONGER_RELEVANT", label: "No longer relevant", sub: "Context has changed" },
];

const SERIOUS_OPTIONS: Array<{
  value: NonNullable<GoalReflection["seriousAttempt"]>;
  label: string;
}> = [
  { value: "NOT_REALLY", label: "Not really" },
  { value: "PARTLY", label: "Partly" },
  { value: "YES", label: "Yes" },
];

const NEXT_ACTIONS: Array<{
  value: NonNullable<GoalReflection["nextAction"]>;
  label: string;
}> = [
  { value: "ARCHIVE", label: "Archive and close" },
  { value: "EXTEND", label: "Extend deadline and continue" },
  { value: "REVISE", label: "Revise scope / approach" },
  { value: "FOLLOW_UP", label: "Follow up in 30 days" },
  { value: "MAINTAIN", label: "Transition to Maintain" },
  { value: "STOP", label: "Stop intentionally" },
];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="pos-gr-field">
      <div>
        <label className="pos-gr-field-label">{label}</label>
        {hint && <p className="pos-gr-field-hint">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export type GoalReviewViewProps = {
  goal: ApiGoal;
  progress: ApiGoalProgress | null;
  outcomeStatus: GoalOutcomeStatus | null;
  onOutcomeStatus: (v: GoalOutcomeStatus) => void;
  achievedAt: string;
  onAchievedAt: (v: string) => void;
  seriousAttempt: GoalReflection["seriousAttempt"];
  onSeriousAttempt: (v: GoalReflection["seriousAttempt"]) => void;
  worked: string;
  onWorked: (v: string) => void;
  didntWork: string;
  onDidntWork: (v: string) => void;
  outsideControl: string;
  onOutsideControl: (v: string) => void;
  learned: string;
  onLearned: (v: string) => void;
  differently: string;
  onDifferently: (v: string) => void;
  nextAction: GoalReflection["nextAction"];
  onNextAction: (v: GoalReflection["nextAction"]) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
};

export function GoalReviewView({
  goal,
  progress,
  outcomeStatus,
  onOutcomeStatus,
  achievedAt,
  onAchievedAt,
  seriousAttempt,
  onSeriousAttempt,
  worked,
  onWorked,
  didntWork,
  onDidntWork,
  outsideControl,
  onOutsideControl,
  learned,
  onLearned,
  differently,
  onDifferently,
  nextAction,
  onNextAction,
  saving,
  onSave,
  onCancel,
}: GoalReviewViewProps) {
  const focus = goal.focusType ?? "FOCUS";
  const isAchieved = outcomeStatus === "ACHIEVED_ON_TIME" || outcomeStatus === "ACHIEVED_LATE";
  const canSave = Boolean(outcomeStatus) && !saving;
  const consistency = progress?.progress.consistency;

  return (
    <div className="pos-gr">
      <div className="pos-gr-topbar">
        <BackButton label={goal.title} onClick={onCancel} />
        <GoalBadge focus={focus} />
        <div className="pos-gr-topbar-spacer" />
        <button
          type="button"
          className="pos-btn-primary"
          onClick={onSave}
          disabled={!canSave}
        >
          {saving ? "Saving…" : "Save review"}
        </button>
      </div>

      <div className="pos-gr-scroll">
        <div className="pos-gr-form">
          <header className="pos-gr-hero">
            <p className="pos-gr-eyebrow">Reviewing goal</p>
            <h1 className="pos-display">{goal.title}</h1>
            {goal.targetDate && (
              <p className="pos-gr-target">
                Target:{" "}
                <span className="pos-mono">{formatShortDate(goal.targetDate)}</span>
              </p>
            )}
          </header>

          {progress && (
            <div className="pos-gr-evidence">
              <p>
                <strong>Latest outcome:</strong>{" "}
                {progress.progress.latestObservation
                  ? progress.progress.latestObservation.value
                  : "No observation yet"}
              </p>
              {consistency && consistency.totalWeeks > 0 && (
                <p>
                  <strong>Consistency:</strong> {consistency.metWeeks} / {consistency.totalWeeks}{" "}
                  recent weeks met target
                </p>
              )}
            </div>
          )}

          <Field
            label="How did this goal end?"
            hint="Choose what best describes the outcome — not a pass/fail, just what happened."
          >
            {!outcomeStatus && (
              <p className="pos-gr-amber-hint">
                Select an outcome to continue. Reflection does not imply failure.
              </p>
            )}
            <div className="pos-gr-chip-grid">
              {OUTCOME_OPTIONS.map((opt) => (
                <button
                  key={opt.status}
                  type="button"
                  className={cn("pos-gr-chip", outcomeStatus === opt.status && "active")}
                  onClick={() => onOutcomeStatus(opt.status)}
                >
                  <span>{opt.label}</span>
                  <em>{opt.sub}</em>
                </button>
              ))}
            </div>
          </Field>

          <div className="pos-gr-two-col">
            {isAchieved && (
              <Field label="Date achieved" hint="When did you actually meet the outcome?">
                <input
                  type="date"
                  className="pos-gr-input"
                  value={achievedAt}
                  onChange={(e) => onAchievedAt(e.target.value)}
                />
              </Field>
            )}
            <Field label="Serious attempt?" hint="Did you genuinely try, or was it exploratory?">
              <div className="pos-gr-segment">
                {SERIOUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={cn(seriousAttempt === opt.value && "active")}
                    onClick={() => onSeriousAttempt(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <div className="pos-gr-divider">
            <span>Reflection</span>
          </div>

          <Field label="What worked?" hint="Approaches, habits, decisions that contributed.">
            <textarea
              className="pos-gr-textarea"
              rows={3}
              value={worked}
              onChange={(e) => onWorked(e.target.value)}
              placeholder="What specific actions or approaches made progress possible?"
            />
          </Field>

          <Field label="What didn't work?" hint="Patterns, decisions, or tools that slowed things down.">
            <textarea
              className="pos-gr-textarea"
              rows={3}
              value={didntWork}
              onChange={(e) => onDidntWork(e.target.value)}
              placeholder="What would you do differently?"
            />
          </Field>

          <Field label="What was outside my control?" hint="External factors that affected the outcome.">
            <textarea
              className="pos-gr-textarea"
              rows={2}
              value={outsideControl}
              onChange={(e) => onOutsideControl(e.target.value)}
              placeholder="Market conditions, timing, people, dependencies..."
            />
          </Field>

          <Field label="What did I learn?" hint="Insights you'd carry forward.">
            <textarea
              className="pos-gr-textarea"
              rows={3}
              value={learned}
              onChange={(e) => onLearned(e.target.value)}
              placeholder="Skills, self-knowledge, process insights..."
            />
          </Field>

          <Field label="What next?" hint="One or two concrete follow-up intentions.">
            <textarea
              className="pos-gr-textarea"
              rows={2}
              value={differently}
              onChange={(e) => onDifferently(e.target.value)}
              placeholder="What does this review suggest you do differently or next?"
            />
          </Field>

          <Field label="Action for this goal" hint="What happens to this goal after review?">
            <div className="pos-gr-chip-grid">
              {NEXT_ACTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={cn("pos-gr-chip compact", nextAction === opt.value && "active")}
                  onClick={() => onNextAction(opt.value)}
                >
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </Field>

          <div className="pos-gr-footer">
            <button
              type="button"
              className="pos-btn-primary pos-gr-save"
              onClick={onSave}
              disabled={!canSave}
            >
              {saving ? "Saving…" : "Save review"}
            </button>
            <button type="button" className="pos-btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
