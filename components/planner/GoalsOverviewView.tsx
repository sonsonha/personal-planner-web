"use client";

import type { ReactNode } from "react";
import type { ApiGoal, ApiGoalProgress, ApiProject } from "@/lib/planner-api";
import { inProductWeek } from "@/lib/product-week";
import {
  ConsistencyDots,
  GoalBadge,
  ProcessMini,
} from "./shared";
import { formatHoursFromMinutes, weekRangeLabel } from "./utils";
import type { WorkspaceBlock, WorkspaceTask } from "@/app/goal-project-workspaces";
import {
  currentMilestone,
  formatShortDate,
  healthLabel,
  outcomeLine,
} from "@/app/goal-project-workspaces";

export type GoalsYearGroup = {
  year: number | null;
  label: string;
  sub: string;
  items: ApiGoal[];
};

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value.length <= 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function tasksForGoal(goal: ApiGoal, projects: ApiProject[], tasks: WorkspaceTask[]) {
  const projectIds = new Set(projects.filter((p) => p.goalId === goal.id && p.active).map((p) => p.id));
  return tasks.filter((task) => task.goalId === goal.id || (task.projectId && projectIds.has(task.projectId)));
}

function protectedMinutesForGoal(
  goal: ApiGoal,
  projects: ApiProject[],
  tasks: WorkspaceTask[],
  blocks: WorkspaceBlock[],
  now: Date,
) {
  const goalTasks = new Set(tasksForGoal(goal, projects, tasks).map((t) => t.id));
  let minutes = 0;
  for (const block of blocks) {
    if (block.type !== "task" || !block.taskId || !goalTasks.has(block.taskId)) continue;
    if (!block.startAt) continue;
    const start = new Date(block.startAt);
    if (!inProductWeek(start, now)) continue;
    minutes += block.duration;
  }
  return minutes;
}

function GoalCard({
  goal,
  progress,
  protectedMinutes,
  now,
  onOpen,
  onReview,
}: {
  goal: ApiGoal;
  progress: ApiGoalProgress | null;
  protectedMinutes: number;
  now: Date;
  onOpen: () => void;
  onReview?: () => void;
}) {
  const milestone = currentMilestone(goal);
  const outcome = outcomeLine(goal, progress);
  const processes = (progress?.progress.processes ?? []).slice(0, 3);
  const consistency = progress?.progress.consistency;
  const health = healthLabel(goal, now);

  return (
    <button type="button" className="pos-ov-focus-card" onClick={onOpen}>
      <div className="pos-ov-focus-head">
        <div className="pos-ov-focus-head-main">
          <div className="pos-ov-card-meta">
            <GoalBadge focus={goal.focusType ?? "FOCUS"} />
            {goal.targetDate && (
              <span className="pos-mono pos-ov-target">Target {formatShortDate(goal.targetDate)}</span>
            )}
            {health === "Review needed" && onReview && (
              <span
                className="pos-ov-review-chip"
                role="link"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onReview();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onReview();
                  }
                }}
              >
                Review needed
              </span>
            )}
          </div>
          <h3 className="pos-ov-focus-title">{goal.title}</h3>
          {(goal.outcome || goal.description) && goal.outcome !== goal.title && (
            <p className="pos-ov-focus-desc">{goal.outcome || goal.description}</p>
          )}
        </div>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="pos-ov-arrow">
          <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="pos-ov-metrics-strip">
        <div className="pos-ov-metric-cell">
          <div className="pos-ov-metric-label">Outcome</div>
          <span className="pos-mono pos-ov-metric-value">{outcome ?? "—"}</span>
        </div>
        <div className="pos-ov-metric-cell">
          <div className="pos-ov-metric-label">Stage</div>
          <div className="pos-ov-stage">
            <i className="pos-ov-stage-dot focus" />
            <span>{milestone?.title ?? "No milestone"}</span>
          </div>
        </div>
        <div className="pos-ov-metric-cell">
          <div className="pos-ov-metric-label">Protected</div>
          <span className="pos-mono pos-ov-metric-value indigo">
            {formatHoursFromMinutes(protectedMinutes)}h
          </span>
          <span className="pos-ov-metric-unit">this wk</span>
        </div>
        <div className="pos-ov-metric-cell pos-ov-metric-consistency">
          <div className="pos-ov-metric-label">Consistency</div>
          {consistency ? (
            <ConsistencyDots met={consistency.metWeeks} total={consistency.totalWeeks} />
          ) : (
            <span className="pos-muted">—</span>
          )}
        </div>
      </div>

      {processes.length > 0 ? (
        <div className="pos-ov-process-block">
          <div className="pos-ov-metric-label">Process this week</div>
          {processes.map((proc, i) => (
            <ProcessMini key={proc.id} name={proc.name} bucket={proc.thisWeek} accentIndex={i} />
          ))}
        </div>
      ) : (
        <p className="pos-ov-empty-process">No process tracked</p>
      )}
    </button>
  );
}

export function GoalsOverviewView({
  grouped,
  progressById,
  projects,
  tasks,
  blocks,
  now,
  focusCount,
  onOpenGoal,
  onReviewGoal,
  onCreate,
  horizonTabs,
}: {
  grouped: GoalsYearGroup[];
  progressById: Record<string, ApiGoalProgress>;
  projects: ApiProject[];
  tasks: WorkspaceTask[];
  blocks: WorkspaceBlock[];
  now: Date;
  focusCount: number;
  onOpenGoal: (id: string) => void;
  onReviewGoal: (id: string) => void;
  onCreate: () => void;
  horizonTabs?: ReactNode;
}) {
  const weekLabel = weekRangeLabel(now);
  const empty = grouped.every((g) => g.items.length === 0);
  const total = grouped.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <div className="pos-overview">
      <div className="pos-overview-topbar pos-overview-actions">
        {focusCount >= 3 && (
          <span className="pos-ov-focus-warn">
            {focusCount} Focus goals — consider narrowing
          </span>
        )}
        <div className="pos-overview-topbar-spacer" />
        <button type="button" className="pos-btn-primary" onClick={onCreate}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
            <path d="M6.5 2v9M2 6.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          New Goal
        </button>
      </div>

      <div className="pos-overview-scroll">
        <div className="pos-ov-week-head">
          <span className="pos-ov-week-title">
            {weekLabel}
            {total > 0 ? ` · ${total} active` : ""}
          </span>
          {horizonTabs}
        </div>

        {empty ? (
          <div className="pos-empty-state">
            <p>Set a result you want to make true</p>
            <span>Goals give Projects and weekly work a direction.</span>
            <button type="button" className="pos-btn-primary" onClick={onCreate}>
              Create goal
            </button>
          </div>
        ) : (
          grouped.map((group) => (
            <section key={group.year ?? "none"} className="pos-ov-section">
              <div className="pos-ov-section-head">
                <span className="pos-ov-section-label year">{group.label}</span>
                <span className="pos-ov-section-sub">
                  {group.items.length} goal{group.items.length === 1 ? "" : "s"} · {group.sub}
                </span>
                <div className="pos-ov-section-rule year" />
              </div>
              <div className="pos-ov-focus-grid">
                {group.items.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    progress={progressById[goal.id] ?? null}
                    protectedMinutes={protectedMinutesForGoal(goal, projects, tasks, blocks, now)}
                    now={now}
                    onOpen={() => onOpenGoal(goal.id)}
                    onReview={() => onReviewGoal(goal.id)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
