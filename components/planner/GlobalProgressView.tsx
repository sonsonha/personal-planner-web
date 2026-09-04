"use client";

import type { ApiGoal, ApiGoalProgress, ApiProject, GoalFocusType } from "@/lib/planner-api";
import { formatProcessValue, type ProcessBucketView } from "@/lib/goal-progress-display";
import {
  ConsistencyDots,
  GoalBadge,
  ProcessMini,
  SectionLabel,
} from "./shared";
import { cn, formatHoursFromMinutes, processAccent } from "./utils";
import {
  currentMilestone,
  formatShortDate,
  getOutcomeSnapshot,
} from "@/app/goal-project-workspaces";

export type GlobalProgressGoalCard = {
  goal: ApiGoal;
  progress: ApiGoalProgress | null;
  protectedMinutes: number;
};

export type GlobalProgressProjectRow = {
  project: ApiProject;
  goal?: ApiGoal;
  nextTitle: string | null;
  processThisWeek: { name: string; thisWeek: ProcessBucketView; measurementType?: string } | null;
  weekDone: number;
  weekOpen: number;
};

export type AttentionItemData = {
  id: string;
  kind: "overdue" | "process" | "review" | "project";
  title: string;
  sub?: string;
  actionLabel: string;
  severity?: "warn" | "info";
  onAction: () => void;
};

export type GlobalProgressViewProps = {
  weekLabel: string;
  goalsWithWorkCount: number;
  goalsWithWorkSub: string;
  protectedMinutes: number;
  processesBelowTargetCount: number;
  processesBelowTargetSub: string;
  focusGoals: GlobalProgressGoalCard[];
  maintainGoals: GlobalProgressGoalCard[];
  exploreGoals?: GlobalProgressGoalCard[];
  timeByGoal: Array<{ goalId: string; title: string; minutes: number; color?: string }>;
  projects: GlobalProgressProjectRow[];
  attentionItems: AttentionItemData[];
  onOpenGoal: (id: string) => void;
  onOpenProject: (id: string) => void;
  onShowAllProjects?: () => void;
  showingAllProjects?: boolean;
  totalProjectCount?: number;
};

function TimeBar({ hours, maxHours, color }: { hours: number; maxHours: number; color: string }) {
  const pct = maxHours > 0 ? Math.min((hours / maxHours) * 100, 100) : 0;
  return (
    <div className="pos-pw-time-bar">
      <div className="pos-pw-time-track" aria-hidden="true">
        <div style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="pos-mono" style={{ color }}>{hours}h</span>
    </div>
  );
}

function AttentionItem({ item }: { item: AttentionItemData }) {
  const severity = item.severity ?? (item.kind === "review" ? "info" : "warn");
  return (
    <div className={cn("pos-pw-attention-item", severity)}>
      <div className="pos-pw-attention-body">
        <p>{item.title}</p>
        {item.sub && <span>{item.sub}</span>}
      </div>
      <button type="button" className={cn("pos-pw-attention-action", severity)} onClick={item.onAction}>
        {item.actionLabel}
      </button>
    </div>
  );
}

function FocusGoalCard({
  card,
  onOpen,
}: {
  card: GlobalProgressGoalCard;
  onOpen: () => void;
}) {
  const { goal, progress, protectedMinutes } = card;
  const milestone = currentMilestone(goal);
  const processes = (progress?.progress.processes ?? []).slice(0, 4);
  const consistency = progress?.progress.consistency;
  const outcomeSnapshot = getOutcomeSnapshot(goal, progress);
  const outcome = outcomeSnapshot.line;
  const achieved = outcomeSnapshot.achieved;

  return (
    <button type="button" className={cn("pos-pw-focus-card", achieved && "is-achieved")} onClick={onOpen}>
      <div className="pos-pw-focus-head">
        <div>
          <div className="pos-pw-card-meta">
            <GoalBadge focus={goal.focusType ?? "FOCUS"} />
            {achieved && <span className="pos-goal-badge status-achieved">Achieved</span>}
            {goal.targetDate && (
              <span className="pos-mono pos-muted">Target {formatShortDate(goal.targetDate)}</span>
            )}
          </div>
          <h3 className="pos-pw-goal-title">{goal.title}</h3>
        </div>
        <div className="pos-pw-focus-metrics">
          <div>
            <span className="pos-pw-metric-label">Outcome</span>
            <strong className={cn("pos-mono", achieved && "achieved")}>{outcome ?? "—"}</strong>
          </div>
          <div>
            <span className="pos-pw-metric-label">Protected</span>
            <strong className="pos-mono indigo">{formatHoursFromMinutes(protectedMinutes)}h</strong>
          </div>
          <div>
            <span className="pos-pw-metric-label">Consistency</span>
            {consistency ? (
              <ConsistencyDots met={consistency.metWeeks} total={consistency.totalWeeks} />
            ) : (
              <span className="pos-muted">—</span>
            )}
          </div>
        </div>
      </div>

      {milestone && (
        <div className="pos-pw-stage-row">
          <i />
          <span>Stage: {milestone.title}</span>
        </div>
      )}

      {processes.length > 0 && (
        <div className="pos-pw-mini-stack">
          {processes.map((proc, i) => (
            <ProcessMini
              key={proc.id}
              name={proc.name}
              bucket={proc.thisWeek}
              accentIndex={i}
              measurementType={proc.measurementType}
            />
          ))}
        </div>
      )}
    </button>
  );
}

function MaintainGoalCard({
  card,
  onOpen,
}: {
  card: GlobalProgressGoalCard;
  onOpen: () => void;
}) {
  const { goal, progress } = card;
  const milestone = currentMilestone(goal);
  const processes = (progress?.progress.processes ?? []).slice(0, 2);
  const outcomeSnapshot = getOutcomeSnapshot(goal, progress);
  const outcome = outcomeSnapshot.line;
  const achieved = outcomeSnapshot.achieved;

  return (
    <button type="button" className={cn("pos-pw-maintain-card", achieved && "is-achieved")} onClick={onOpen}>
      <div className="pos-pw-maintain-head">
        <div>
          <div className="pos-pw-card-meta">
            <GoalBadge focus={(goal.focusType ?? "MAINTAIN") as GoalFocusType} />
            {achieved && <span className="pos-goal-badge status-achieved xs">Achieved</span>}
          </div>
          <h3 className="pos-pw-goal-title">{goal.title}</h3>
        </div>
        <span className={cn("pos-mono", achieved ? "achieved" : "pos-muted")}>{outcome ?? "—"}</span>
      </div>
      {milestone && (
        <div className="pos-pw-stage-row maintain">
          <i />
          <span>{milestone.title}</span>
        </div>
      )}
      {processes.length > 0 ? (
        <div className="pos-pw-mini-stack">
          {processes.map((proc, i) => (
            <ProcessMini
              key={proc.id}
              name={proc.name}
              bucket={proc.thisWeek}
              accentIndex={i}
              measurementType={proc.measurementType}
            />
          ))}
        </div>
      ) : (
        <p className="pos-muted italic">No process tracked</p>
      )}
    </button>
  );
}

export function GlobalProgressView({
  weekLabel,
  goalsWithWorkCount,
  goalsWithWorkSub,
  protectedMinutes,
  processesBelowTargetCount,
  processesBelowTargetSub,
  focusGoals,
  maintainGoals,
  exploreGoals = [],
  timeByGoal,
  projects,
  attentionItems,
  onOpenGoal,
  onOpenProject,
  onShowAllProjects,
  showingAllProjects,
  totalProjectCount,
}: GlobalProgressViewProps) {
  const maxHours = Math.max(
    ...timeByGoal.map((row) => row.minutes / 60),
    protectedMinutes / 60,
    1,
  );

  return (
    <div className="pos-pw">
      <div className="pos-pw-scroll">
        <div className="pos-pw-week-head">
          <span className="pos-mono pos-muted">{weekLabel}</span>
        </div>

        <div className="pos-pw-summary">
          <div className="pos-pw-summary-card">
            <span className="pos-pw-metric-label">Goals with work scheduled</span>
            <strong className="pos-mono indigo">{goalsWithWorkCount}</strong>
            <span className="pos-muted">{goalsWithWorkSub}</span>
          </div>
          <div className="pos-pw-summary-card">
            <span className="pos-pw-metric-label">Time protected</span>
            <strong className="pos-mono indigo">{formatHoursFromMinutes(protectedMinutes)}h</strong>
            <span className="pos-muted">on calendar this week</span>
          </div>
          <div className="pos-pw-summary-card">
            <span className="pos-pw-metric-label">Processes below target</span>
            <strong className="pos-mono amber">{processesBelowTargetCount}</strong>
            <span className="pos-muted">{processesBelowTargetSub || "—"}</span>
          </div>
        </div>

        {focusGoals.length > 0 && (
          <section>
            <div className="pos-pw-section-head focus">
              <span>Focus</span>
              <div />
            </div>
            <div className="pos-pw-focus-stack">
              {focusGoals.map((card) => (
                <FocusGoalCard
                  key={card.goal.id}
                  card={card}
                  onOpen={() => onOpenGoal(card.goal.id)}
                />
              ))}
            </div>
          </section>
        )}

        {maintainGoals.length > 0 && (
          <section>
            <div className="pos-pw-section-head maintain">
              <span>Maintain</span>
              <div />
            </div>
            <div className="pos-pw-maintain-grid">
              {maintainGoals.map((card) => (
                <MaintainGoalCard
                  key={card.goal.id}
                  card={card}
                  onOpen={() => onOpenGoal(card.goal.id)}
                />
              ))}
            </div>
          </section>
        )}

        {exploreGoals.length > 0 && (
          <section>
            <div className="pos-pw-section-head explore">
              <span>Explore</span>
              <div />
            </div>
            <div className="pos-pw-explore-list">
              {exploreGoals.map((card) => (
                <button
                  key={card.goal.id}
                  type="button"
                  className="pos-pw-explore-row"
                  onClick={() => onOpenGoal(card.goal.id)}
                >
                  <span>{card.goal.title}</span>
                  <GoalBadge focus="EXPLORE" size="xs" />
                </button>
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionLabel right={weekLabel}>Time protected this week</SectionLabel>
          <div className="pos-gp-card pos-pw-time-card">
            {timeByGoal.length === 0 ? (
              <p className="pos-muted">No protected time linked to goals this week.</p>
            ) : (
              timeByGoal.map((row, index) => (
                <div key={row.goalId} className="pos-pw-time-row">
                  <span>{row.title}</span>
                  <TimeBar
                    hours={Number(formatHoursFromMinutes(row.minutes))}
                    maxHours={maxHours}
                    color={row.color ?? processAccent(index).color}
                  />
                </div>
              ))
            )}
            <div className="pos-pw-time-total">
              <span>Total</span>
              <div>
                <strong className="pos-mono">{formatHoursFromMinutes(protectedMinutes)}</strong>
                <em className="pos-mono">h protected</em>
              </div>
            </div>
          </div>
        </section>

        <section>
          <SectionLabel>Projects — this week</SectionLabel>
          {projects.length === 0 ? (
            <p className="pos-muted">No active projects.</p>
          ) : (
            <div className="pos-pw-project-list">
              {projects.map((row) => {
                const accent = processAccent(0);
                return (
                  <button
                    key={row.project.id}
                    type="button"
                    className="pos-pw-project-row"
                    onClick={() => onOpenProject(row.project.id)}
                  >
                    <div className="pos-pw-project-main">
                      <div className="pos-pw-project-title-line">
                        <span>{row.project.title}</span>
                        {row.goal && (
                          <GoalBadge focus={row.goal.focusType ?? "FOCUS"} size="xs" />
                        )}
                      </div>
                      {row.nextTitle && (
                        <p className="pos-muted">Next: {row.nextTitle}</p>
                      )}
                    </div>
                    {row.processThisWeek ? (
                      <div className="pos-pw-project-week">
                        <span className="pos-mono" style={{ color: accent.color }}>
                          {formatProcessValue(
                            row.processThisWeek.thisWeek.completed,
                            row.processThisWeek.thisWeek.unit,
                            row.processThisWeek.measurementType,
                          )}
                        </span>
                        <span className="pos-mono pos-muted">
                          /{formatProcessValue(
                            row.processThisWeek.thisWeek.target,
                            row.processThisWeek.thisWeek.unit,
                            row.processThisWeek.measurementType,
                          )}
                        </span>
                        <div className="pos-process-track thin" aria-hidden="true">
                          <div
                            className="pos-process-completed-fill"
                            style={{
                              width: `${Math.min(
                                (row.processThisWeek.thisWeek.completed
                                  / Math.max(row.processThisWeek.thisWeek.target, 0.0001)) * 100,
                                100,
                              )}%`,
                              backgroundColor: accent.color,
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="pos-mono pos-muted">
                        {row.weekDone}/{row.weekDone + row.weekOpen}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {!showingAllProjects
            && onShowAllProjects
            && totalProjectCount != null
            && totalProjectCount > projects.length && (
            <button type="button" className="pos-pw-show-all" onClick={onShowAllProjects}>
              Show all {totalProjectCount} projects
            </button>
          )}
        </section>

        <section>
          <SectionLabel>Needs attention</SectionLabel>
          {attentionItems.length === 0 ? (
            <div className="pos-pw-all-clear">
              <p>All processes on track this week</p>
            </div>
          ) : (
            <div className="pos-pw-attention-list">
              {attentionItems.map((item) => (
                <AttentionItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
