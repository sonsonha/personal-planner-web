"use client";

import type { ReactNode } from "react";
import type { GoalFocusType, GoalMilestone } from "@/lib/planner-api";
import { formatProcessValue, formatProcessRatio, type ProcessBucketView } from "@/lib/goal-progress-display";
import { cn, processAccent } from "./utils";

export function SectionLabel({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="pos-section-label">
      <span>{children}</span>
      {right != null && <span className="pos-section-label-right">{right}</span>}
    </div>
  );
}

export function GoalBadge({
  focus,
  size = "sm",
}: {
  focus: GoalFocusType;
  size?: "sm" | "xs";
}) {
  const label = focus === "FOCUS" ? "Focus" : focus === "MAINTAIN" ? "Maintain" : "Explore";
  return (
    <span className={cn("pos-goal-badge", `focus-${focus.toLowerCase()}`, size === "xs" && "xs")}>
      {label}
    </span>
  );
}

export function ProcessBar({
  name,
  bucket,
  accentIndex = 0,
  measurementType,
  periodSuffix = "/wk",
  onEdit,
}: {
  name: string;
  bucket: ProcessBucketView;
  accentIndex?: number;
  measurementType?: string | null;
  /** Shown after target in the legend, e.g. /wk or /mo. */
  periodSuffix?: string;
  onEdit?: () => void;
}) {
  const accent = processAccent(accentIndex);
  const denom = Math.max(bucket.target, 0.0001);
  const completedPct = Math.min((bucket.completed / denom) * 100, 100);
  const plannedPct = Math.min((bucket.planned / denom) * 100, 100);
  const atTarget = bucket.target > 0 && bucket.completed >= bucket.target;
  const statusLabel = atTarget && bucket.completed >= bucket.planned
    ? "Done"
    : atTarget
      ? "At target"
      : bucket.completed > 0
        ? "In progress"
        : "Not started";
  const unit = bucket.unit;

  return (
    <article className="pos-process-bar">
      <div className="pos-process-bar-top">
        <span className="pos-process-bar-name">{name}</span>
        <div className="pos-process-bar-top-right">
          {onEdit && (
            <button type="button" className="pos-btn-ghost pos-system-edit" onClick={onEdit}>
              Edit
            </button>
          )}
          <span
            className={cn("pos-process-bar-status", atTarget && "at-target")}
            style={atTarget ? { backgroundColor: accent.light, color: accent.color } : undefined}
          >
            {statusLabel}
          </span>
        </div>
      </div>
      <div className="pos-process-bar-metrics">
        <span className="pos-mono pos-process-completed" style={{ color: accent.color }}>
          {formatProcessValue(bucket.completed, unit, measurementType)}
        </span>
        <span className="pos-process-target">
          <span className="pos-mono">/ {formatProcessValue(bucket.target, unit, measurementType)}</span>
          {" "}target
        </span>
      </div>
      {bucket.planned > 0 && (
        <p className="pos-process-planned">
          <span className="pos-mono">{formatProcessValue(bucket.planned, unit, measurementType)}</span>
          {" "}planned
        </p>
      )}
      <div className="pos-process-track" aria-hidden="true">
        <div
          className="pos-process-planned-fill"
          style={{ width: `${plannedPct}%`, backgroundColor: accent.light }}
        />
        <div
          className="pos-process-completed-fill"
          style={{ width: `${completedPct}%`, backgroundColor: accent.color }}
        />
      </div>
      <div className="pos-process-legend">
        <span>
          <i style={{ backgroundColor: accent.light, borderColor: accent.color }} />
          target {formatProcessValue(bucket.target, unit, measurementType)}
          {periodSuffix}
        </span>
      </div>
    </article>
  );
}

export function ProcessMini({
  name,
  bucket,
  accentIndex = 0,
  measurementType,
}: {
  name: string;
  bucket: ProcessBucketView;
  accentIndex?: number;
  measurementType?: string | null;
}) {
  const accent = processAccent(accentIndex);
  const denom = Math.max(bucket.target, 0.0001);
  const completedPct = Math.min((bucket.completed / denom) * 100, 100);
  const plannedPct = Math.min((bucket.planned / denom) * 100, 100);
  const atTarget = bucket.target > 0 && bucket.completed >= bucket.target;

  return (
    <div className="pos-process-mini">
      <span className="pos-process-mini-name">{name}</span>
      <div className="pos-process-mini-track" aria-hidden="true">
        <div style={{ width: `${plannedPct}%`, backgroundColor: accent.light }} />
        <div style={{ width: `${completedPct}%`, backgroundColor: accent.color }} />
      </div>
      <span
        className="pos-process-mini-values pos-mono"
        style={{ color: atTarget ? accent.color : undefined }}
      >
        {formatProcessRatio(bucket.completed, bucket.target, bucket.unit, measurementType)}
      </span>
    </div>
  );
}

export function MilestoneTimeline({
  milestones,
  onSetCurrent,
}: {
  milestones: GoalMilestone[];
  onSetCurrent?: (id: string) => void;
}) {
  return (
    <div className="pos-milestone-timeline">
      <div className="pos-milestone-nodes">
        {milestones.map((m, i) => (
          <div key={m.id} className="pos-milestone-node-wrap">
            <button
              type="button"
              className={cn("pos-milestone-node", m.status)}
              onClick={() => onSetCurrent?.(m.id)}
              disabled={!onSetCurrent}
              aria-label={`Set current milestone: ${m.title}`}
              aria-current={m.status === "current" ? "step" : undefined}
            >
              {m.status === "done" ? (
                <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden="true">
                  <path d="M1 4.5l3 3L10 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : m.status === "current" ? (
                <span className="pos-milestone-dot" />
              ) : null}
            </button>
            {i < milestones.length - 1 && (
              <div
                className={cn(
                  "pos-milestone-connector",
                  milestones[i + 1]?.status !== "pending" && "filled",
                )}
              />
            )}
          </div>
        ))}
      </div>
      <div className="pos-milestone-labels">
        {milestones.map((m) => (
          <span key={m.id} className={cn("pos-milestone-label", m.status)}>
            {m.title}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ConsistencyDots({ met, total }: { met: number; total: number }) {
  if (total <= 0) {
    return <span className="pos-consistency muted">No consistency window</span>;
  }
  return (
    <div className="pos-consistency" aria-label={`${met} of ${total} weeks met`}>
      <div className="pos-consistency-dots" aria-hidden="true">
        {Array.from({ length: total }).map((_, i) => (
          <i key={i} className={i < met ? "met" : undefined} />
        ))}
      </div>
      <span className="pos-mono pos-consistency-count">{met}/{total}</span>
      <span className="pos-consistency-unit">wks</span>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
}) {
  return (
    <div className="pos-metric-card">
      <div className="pos-metric-label">{label}</div>
      <div className="pos-metric-value">{value}</div>
      {sub && <p className="pos-metric-sub">{sub}</p>}
    </div>
  );
}

export type CalendarStripDay = {
  key: string;
  short: string;
  date: number;
  isToday: boolean;
  blocks: Array<{
    id: string;
    label: string;
    duration: string;
    color: string;
    external?: boolean;
  }>;
};

export function CalendarStrip({ days }: { days: CalendarStripDay[] }) {
  return (
    <div className="pos-calendar-strip">
      {days.map((day) => (
        <div key={day.key} className={cn("pos-cal-day", day.isToday && "today")}>
          <div className="pos-cal-day-head">
            <span className="pos-cal-dow">{day.short}</span>
            <span className="pos-mono pos-cal-date">{day.date}</span>
          </div>
          <div className="pos-cal-blocks">
            {day.blocks.map((block) => (
              <div
                key={block.id}
                className={cn("pos-cal-block", block.external && "external")}
                style={!block.external ? { backgroundColor: block.color } : undefined}
              >
                {block.external && <span aria-hidden="true">🔒 </span>}
                <span className="pos-cal-block-label">{block.label}</span>
                <span className="pos-cal-block-dur">{block.duration}</span>
              </div>
            ))}
            {day.blocks.length === 0 && <div className="pos-cal-empty" />}
          </div>
        </div>
      ))}
    </div>
  );
}

export function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="pos-back-button" onClick={onClick}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </button>
  );
}

export function ArrowLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="pos-arrow-link" onClick={onClick}>
      <span>{children}</span>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function UnscheduledBadge() {
  return (
    <span className="pos-badge unscheduled">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2" />
        <path d="M5 3v2.5l1.5 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      Unscheduled
    </span>
  );
}

export function ScheduledBadge({ label }: { label: string }) {
  return <span className="pos-badge scheduled">{label}</span>;
}

export function EmptyState({
  title,
  sub,
}: {
  title: string;
  sub?: string;
}) {
  return (
    <div className="pos-empty-state">
      <p>{title}</p>
      {sub && <span>{sub}</span>}
    </div>
  );
}
