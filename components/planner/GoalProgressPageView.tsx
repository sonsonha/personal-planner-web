"use client";

import { useState } from "react";
import type { ApiGoal, ApiGoalProgress } from "@/lib/planner-api";
import {
  formatObservationEntry,
  formatProcessValue,
  coerceProcessBucketForDisplay,
  type ProcessBucketView,
} from "@/lib/goal-progress-display";
import {
  ArrowLink,
  BackButton,
  GoalBadge,
  MilestoneTimeline,
  ProcessBar,
  ProcessMini,
  SectionLabel,
} from "./shared";
import { cn, formatHoursFromMinutes, processAccent } from "./utils";
import {
  currentMilestone,
  formatShortDate,
  outcomeLine,
  OUTCOME_STATUS_LABEL,
} from "@/app/goal-project-workspaces";

type PeriodKey = "thisWeek" | "thisMonth" | "allTime";

const PERIOD_TABS: { id: PeriodKey; label: string }[] = [
  { id: "thisWeek", label: "This week" },
  { id: "thisMonth", label: "This month" },
  { id: "allTime", label: "All time" },
];

function weekChipLabel(startAt: string) {
  const date = new Date(startAt);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function ProcessPeriodCard({
  name,
  bucket,
  period,
  accentIndex,
  measurementType,
  onEdit,
}: {
  name: string;
  bucket: ProcessBucketView;
  period: PeriodKey;
  accentIndex: number;
  measurementType?: string | null;
  onEdit?: () => void;
}) {
  const view = coerceProcessBucketForDisplay(bucket, measurementType);
  const accent = processAccent(accentIndex);
  const denom = Math.max(view.target, view.planned, 0.0001);
  const completedPct = Math.min((view.completed / denom) * 100, 100);
  const plannedPct = Math.min((view.planned / denom) * 100, 100);
  const atTarget = view.target > 0 && view.completed >= view.target;
  const periodSuffix = period === "thisWeek" ? "/wk" : period === "thisMonth" ? "/mo" : "";
  const unit = view.unit;

  return (
    <article className="pos-gp-period-card">
      <div className="pos-gp-period-card-top">
        <span className="pos-gp-period-name">{name}</span>
        <div className="pos-gp-period-card-actions">
          {onEdit && (
            <button type="button" className="pos-btn-ghost pos-system-edit" onClick={onEdit}>
              Edit
            </button>
          )}
          {atTarget && <span className="pos-gp-on-track">On track</span>}
        </div>
      </div>
      <div className="pos-gp-period-metrics">
        <span className="pos-mono pos-gp-period-completed" style={{ color: accent.color }}>
          {formatProcessValue(view.completed, unit, measurementType)}
        </span>
        <span className="pos-gp-period-planned">
          <span className="pos-mono">/ {formatProcessValue(view.target, unit, measurementType)}</span>
          {" "}target
        </span>
      </div>
      {view.planned > 0 && (
        <p className="pos-gp-period-planned-line">
          <span className="pos-mono">{formatProcessValue(view.planned, unit, measurementType)}</span>
          {" "}planned
        </p>
      )}
      <div className="pos-process-track thin" aria-hidden="true">
        <div
          className="pos-process-planned-fill"
          style={{ width: `${plannedPct}%`, backgroundColor: accent.light }}
        />
        <div
          className="pos-process-completed-fill"
          style={{ width: `${completedPct}%`, backgroundColor: accent.color }}
        />
      </div>
      <div className="pos-gp-period-footer">
        <span className="pos-mono">
          target {formatProcessValue(view.target, unit, measurementType)}{periodSuffix}
        </span>
        <span className="pos-mono">
          {formatProcessValue(view.completed, unit, measurementType)} completed
        </span>
      </div>
    </article>
  );
}

export type GoalProgressPageViewProps = {
  goal: ApiGoal;
  data: ApiGoalProgress;
  protectedMinutes: number;
  layout?: "page" | "panel";
  onBack?: () => void;
  onOpenTask?: (taskId: string) => void;
  onReview?: () => void;
  onAddProcess?: () => void;
  onEditProcess?: (processId: string) => void;
  onLogObservation?: () => void;
  onDeleteObservation?: (observationId: string) => void;
};

export function GoalProgressPageView({
  goal,
  data,
  protectedMinutes,
  layout = "page",
  onBack,
  onOpenTask,
  onReview,
  onAddProcess,
  onEditProcess,
  onLogObservation,
  onDeleteObservation,
}: GoalProgressPageViewProps) {
  const [period, setPeriod] = useState<PeriodKey>("thisWeek");
  const [showAllEvidence, setShowAllEvidence] = useState(false);
  const focus = goal.focusType ?? "FOCUS";
  const milestone = currentMilestone(goal);
  const milestones = goal.milestones ?? [];
  const processes = data.progress.processes;
  const consistency = data.progress.consistency;
  const observations = [...(goal.metricObservations ?? [])].sort((a, b) =>
    a.observedAt.localeCompare(b.observedAt),
  );
  const outcome = outcomeLine(goal, data);
  const closed = Boolean(goal.outcomeStatus && goal.outcomeStatus !== "ACTIVE");
  const evidence = showAllEvidence ? data.progress.activity : data.progress.activity.slice(0, 8);
  const currentIdx = Math.max(0, milestones.findIndex((m) => m.status === "current"));
  const showReviewCta =
    data.progress.insight.processState === "strong"
    && (data.progress.insight.outcomeState === "stable" || data.progress.insight.outcomeState === "declining");

  const outcomeParts = (() => {
    if (!outcome) return null;
    if (outcome.includes("/")) {
      const [left, right] = outcome.split("/").map((part) => part.trim());
      return { kind: "ratio" as const, left, right };
    }
    return { kind: "plain" as const, text: outcome };
  })();

  const body = (
    <div className={cn("pos-gp", layout === "panel" && "panel")}>
      {layout === "page" && (
        <div className="pos-gp-topbar">
          <BackButton label={goal.title} onClick={() => onBack?.()} />
          <GoalBadge focus={focus} />
          <div className="pos-gp-topbar-spacer" />
          {onReview && (
            <button type="button" className="pos-btn-secondary" onClick={onReview}>
              Review / Close
            </button>
          )}
        </div>
      )}

      <div className="pos-gp-scroll">
        {layout === "page" && (
          <header className="pos-gp-hero">
            <h1 className="pos-display">{goal.title}</h1>
            <p>Progress evidence for this goal</p>
          </header>
        )}

        {layout === "panel" && (
          <header className="pos-gp-panel-head">
            <div>
              <div className="pos-gp-eyebrow">Goal progress</div>
              <h2>{goal.title}</h2>
            </div>
            {onBack && (
              <button type="button" className="pos-btn-secondary" onClick={onBack}>
                Close
              </button>
            )}
          </header>
        )}

        <div className="pos-gp-columns">
          <div className="pos-gp-main">
            <div className="pos-gp-outcome-row">
              <div className="pos-gp-card">
                <div className="pos-gp-card-head">
                  <div className="pos-gp-card-label">Outcome</div>
                  {onLogObservation && !closed && (
                    <button type="button" className="pos-btn-ghost pos-system-edit" onClick={onLogObservation}>
                      Update
                    </button>
                  )}
                </div>
                {outcomeParts?.kind === "ratio" ? (
                  <div className="pos-gp-outcome-nums">
                    <span className="pos-mono pos-gp-outcome-big">{outcomeParts.left}</span>
                    <span className="pos-gp-outcome-slash">/</span>
                    <span className="pos-mono pos-gp-outcome-mid">{outcomeParts.right}</span>
                  </div>
                ) : (
                  <div className="pos-mono pos-gp-outcome-big">{outcome ?? "—"}</div>
                )}
                <p className="pos-gp-outcome-sub" title={goal.metric || undefined}>
                  {goal.metric || "Result"}
                </p>
                <div className="pos-gp-field-row">
                  <span>Status</span>
                  <strong>{OUTCOME_STATUS_LABEL[goal.outcomeStatus ?? "ACTIVE"]}</strong>
                </div>
                <div className="pos-gp-field-row">
                  <span>Deadline</span>
                  <strong>{formatShortDate(goal.targetDate) ?? "No deadline"}</strong>
                </div>
                <div className="pos-gp-obs">
                  <div className="pos-gp-obs-head">
                    <div className="pos-gp-card-label">Observations</div>
                    {onLogObservation && !closed && (
                      <button type="button" className="pos-btn-ghost" onClick={onLogObservation}>
                        + Log
                      </button>
                    )}
                  </div>
                  {observations.length === 0 ? (
                    <p className="pos-muted italic">No outcome observations yet.</p>
                  ) : (
                    <ul className="pos-gp-obs-list">
                      {observations.map((item) => {
                        const entry = formatObservationEntry(item);
                        return (
                          <li key={item.id}>
                            <div className="pos-gp-obs-row">
                              <div>
                                <strong>{entry.month}</strong>
                                <span>{entry.detail}</span>
                              </div>
                              {onDeleteObservation && !closed && (
                                <button
                                  type="button"
                                  className="pos-btn-ghost danger"
                                  onClick={() => onDeleteObservation(item.id)}
                                  aria-label={`Remove observation ${entry.detail}`}
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              <div className="pos-gp-card">
                <div className="pos-gp-card-label">Current stage</div>
                {milestone ? (
                  <>
                    <div className="pos-stage-value">
                      <i />
                      {milestone.title}
                    </div>
                    <p className="pos-gp-stage-sub">
                      Step {currentIdx + 1} of {milestones.length}
                    </p>
                  </>
                ) : (
                  <p className="pos-muted">No milestone</p>
                )}
                {milestones.length > 0 && (
                  <div className="pos-gp-timeline">
                    <MilestoneTimeline milestones={milestones} />
                  </div>
                )}
              </div>
            </div>

            <section>
              <div className="pos-gp-section-head">
                <span className="pos-gp-card-label">Process evidence</span>
                <div className="pos-gp-section-head-actions">
                  {onAddProcess && (
                    <button type="button" className="pos-btn-ghost" onClick={onAddProcess}>
                      + Add process
                    </button>
                  )}
                  <div className="pos-gp-period-tabs" role="group" aria-label="Progress period">
                    {PERIOD_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className={cn(period === tab.id && "active")}
                        onClick={() => setPeriod(tab.id)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <p className="pos-gp-process-hint pos-muted">
                Edit name, target, or count/hours here. Completed and planned update automatically when linked tasks are scheduled or marked done.
              </p>
              {processes.length === 0 ? (
                <p className="pos-muted">
                  No recurring process defined.
                  {onAddProcess && (
                    <>
                      {" "}
                      <button type="button" className="pos-text-link" onClick={onAddProcess}>
                        Add a process
                      </button>
                    </>
                  )}
                </p>
              ) : period === "thisWeek" ? (
                <div className="pos-process-grid">
                  {processes.map((proc, index) => (
                    <ProcessBar
                      key={proc.id}
                      name={proc.name}
                      bucket={proc.thisWeek}
                      accentIndex={index}
                      measurementType={proc.measurementType}
                      periodSuffix="/wk"
                      onEdit={onEditProcess ? () => onEditProcess(proc.id) : undefined}
                    />
                  ))}
                </div>
              ) : (
                <div className="pos-gp-period-grid">
                  {processes.map((proc, index) => (
                    <ProcessPeriodCard
                      key={proc.id}
                      name={proc.name}
                      bucket={proc[period]}
                      period={period}
                      accentIndex={index}
                      measurementType={proc.measurementType}
                      onEdit={onEditProcess ? () => onEditProcess(proc.id) : undefined}
                    />
                  ))}
                </div>
              )}
            </section>

            {processes.length > 0 && consistency.totalWeeks > 0 && (
              <section>
                <div className="pos-gp-section-head">
                  <span className="pos-gp-card-label">Weekly consistency</span>
                  <div className="pos-gp-heat-legend">
                    <span>
                      <i className="met" />
                      ≥ {Math.round(consistency.threshold * 100)}% of target
                    </span>
                    <span>
                      <i />
                      Below target
                    </span>
                  </div>
                </div>
                <div className="pos-gp-card">
                  <div className="pos-gp-consistency-head">
                    <span className="pos-mono pos-gp-consistency-met">{consistency.metWeeks}</span>
                    <span className="pos-mono pos-gp-consistency-total">/ {consistency.totalWeeks}</span>
                    <span className="pos-gp-consistency-copy">
                      recent weeks met (≥ {Math.round(consistency.threshold * 100)}% threshold)
                    </span>
                  </div>
                  <div className="pos-gp-heatmap" role="img" aria-label="Weekly consistency heatmap">
                    {consistency.weeks.map((week) => (
                      <div key={week.startAt} className="pos-gp-heat-cell">
                        <div
                          className={cn("pos-gp-heat-box", week.met && "met")}
                          title={`${weekChipLabel(week.startAt)}: ${week.met ? "Met" : "Not met"}`}
                        />
                        <span className="pos-mono">{weekChipLabel(week.startAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            <section>
              <SectionLabel>Calendar / Time protected</SectionLabel>
              <div className="pos-gp-card">
                <div className="pos-gp-protected-head">
                  <span className="pos-mono pos-gp-protected-big">
                    {formatHoursFromMinutes(protectedMinutes)}
                  </span>
                  <span className="pos-mono pos-gp-protected-unit">h</span>
                  <span className="pos-gp-protected-copy">protected on calendar this week</span>
                </div>
                {processes.length > 0 && (
                  <ul className="pos-gp-protected-list">
                    {processes.map((proc, index) => {
                      const accent = processAccent(index);
                      const bucket = coerceProcessBucketForDisplay(proc.thisWeek, proc.measurementType);
                      return (
                        <li key={proc.id}>
                          <i style={{ backgroundColor: accent.color }} />
                          <span>{proc.name}</span>
                          <em className="pos-mono">
                            {formatProcessValue(bucket.planned, bucket.unit, proc.measurementType)} planned ·{" "}
                            {formatProcessValue(bucket.completed, bucket.unit, proc.measurementType)} completed
                          </em>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>

            <section>
              <SectionLabel>Recent evidence</SectionLabel>
              {data.progress.activity.length === 0 ? (
                <p className="pos-muted">No recent completed work linked to this goal.</p>
              ) : (
                <>
                  <ul className="pos-gp-evidence-list">
                    {evidence.map((item) => (
                      <li key={item.taskId}>
                        <button type="button" onClick={() => onOpenTask?.(item.taskId)}>
                          <span className="pos-gp-evidence-status">
                            {item.completedAt ? "Done" : "Planned"}
                          </span>
                          <span className="pos-gp-evidence-title">{item.title}</span>
                          <em>
                            {item.completedAt ? formatShortDate(item.completedAt) : "Unscheduled"}
                            {item.plannedMinutes > 0 ? ` · ${item.plannedMinutes}m` : ""}
                          </em>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {data.progress.activity.length > 8 && (
                    <button
                      type="button"
                      className="pos-btn-ghost"
                      onClick={() => setShowAllEvidence((v) => !v)}
                    >
                      {showAllEvidence ? "Show recent" : "View all"}
                    </button>
                  )}
                </>
              )}
            </section>

            {closed && (
              <section className="pos-gp-card">
                <div className="pos-gp-card-label">Review</div>
                <div className="pos-gp-field-row">
                  <span>Target</span>
                  <strong>
                    {goal.metric || goal.title}
                    {goal.targetDate ? ` by ${formatShortDate(goal.targetDate)}` : ""}
                  </strong>
                </div>
                <div className="pos-gp-field-row">
                  <span>Actual result</span>
                  <strong>{outcome ?? "—"}</strong>
                </div>
                <div className="pos-gp-field-row">
                  <span>Outcome</span>
                  <strong>{OUTCOME_STATUS_LABEL[goal.outcomeStatus ?? "ACTIVE"]}</strong>
                </div>
              </section>
            )}
          </div>

          <aside className="pos-gp-rail">
            <div className="pos-gp-summary">
              <div className="pos-gp-summary-label">Evidence summary</div>
              <div className="pos-gp-summary-row">
                <span>Weeks consistent</span>
                <strong className="pos-mono">
                  {consistency.metWeeks}/{consistency.totalWeeks}
                </strong>
              </div>
              <div className="pos-gp-summary-row">
                <span>Protected time</span>
                <strong className="pos-mono">
                  {formatHoursFromMinutes(protectedMinutes)}h this wk
                </strong>
              </div>
              <div className="pos-gp-summary-row">
                <span>Processes active</span>
                <strong className="pos-mono">{processes.length}</strong>
              </div>
            </div>

            {processes.length > 0 && (
              <div className="pos-gp-card">
                <div className="pos-gp-card-label">This week</div>
                <div className="pos-gp-mini-stack">
                  {processes.map((proc, index) => (
                    <ProcessMini
                      key={proc.id}
                      name={proc.name}
                      bucket={proc.thisWeek}
                      accentIndex={index}
                      measurementType={proc.measurementType}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="pos-gp-insight">
              <div className="pos-gp-card-label">Evidence note</div>
              <p>{data.progress.insight.message}</p>
              {showReviewCta && onReview && (
                <button type="button" className="pos-btn-ghost" onClick={onReview}>
                  Review strategy
                </button>
              )}
            </div>

            <div className="pos-gp-actions">
              {onBack && <ArrowLink onClick={onBack}>Back to Goal Detail</ArrowLink>}
              {onReview && <ArrowLink onClick={onReview}>Review / Close goal</ArrowLink>}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );

  if (layout === "panel") {
    return (
      <div className="pos-gp-panel-backdrop">
        <button type="button" className="pos-gp-panel-dismiss" aria-label="Close" onClick={onBack} />
        <aside className="pos-gp-panel" role="dialog" aria-modal="true">
          {body}
        </aside>
      </div>
    );
  }

  return body;
}
