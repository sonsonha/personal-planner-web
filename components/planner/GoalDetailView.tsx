"use client";

import { useMemo, useState } from "react";
import {
  type ApiGoal,
  type ApiGoalProgress,
  type ApiProject,
} from "@/lib/planner-api";
import { formatProcessRatio } from "@/lib/goal-progress-display";
import { inProductWeek, startOfProductWeek } from "@/lib/product-week";
import {
  ArrowLink,
  BackButton,
  CalendarStrip,
  ConsistencyDots,
  EmptyState,
  GoalBadge,
  MetricCard,
  MilestoneTimeline,
  ProcessBar,
  ScheduledBadge,
  SectionLabel,
  UnscheduledBadge,
  type CalendarStripDay,
} from "./shared";
import { formatHoursFromMinutes, processAccent } from "./utils";
import type { WorkspaceBlock, WorkspaceTask } from "@/app/goal-project-workspaces";

type DetailBlock = WorkspaceBlock & {
  title?: string;
  color?: string;
  day?: number;
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

function blockForTask(taskId: string, blocks: DetailBlock[]) {
  return blocks.find((block) => block.taskId === taskId && block.type === "task");
}

function formatBlockChip(block: DetailBlock) {
  if (!block.startAt) return null;
  const date = new Date(block.startAt);
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function formatBlockTimeRange(block: DetailBlock) {
  if (!block.startAt) return null;
  const start = new Date(block.startAt);
  const end = new Date(start.getTime() + block.duration * 60_000);
  const day = start.toLocaleDateString("en-US", { weekday: "short" });
  const startLabel = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const endLabel = end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${startLabel}–${endLabel}`;
}

function hoursLabel(minutes: number) {
  return `${formatHoursFromMinutes(minutes)}h`;
}

function weekRangeLabel(now: Date) {
  const start = startOfProductWeek(now);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-US", opts)}–${end.toLocaleDateString("en-US", opts)}`;
}

function buildCalendarStrip(
  goalTasks: WorkspaceTask[],
  blocks: DetailBlock[],
  now: Date,
): { days: CalendarStripDay[]; protectedMinutes: number; unscheduledCount: number } {
  const weekStart = startOfProductWeek(now);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const goalTaskIds = new Set(goalTasks.map((t) => t.id));
  const goalProjectIds = new Set(goalTasks.map((t) => t.projectId).filter(Boolean));

  let protectedMinutes = 0;
  const days: CalendarStripDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart.getTime() + index * 86_400_000);
    const next = new Date(date.getTime() + 86_400_000);
    const dayBlocks = blocks.filter((block) => {
      if (!block.startAt) return false;
      const at = new Date(block.startAt).getTime();
      if (at < date.getTime() || at >= next.getTime()) return false;
      if (block.type === "external") return true;
      return Boolean(block.taskId && goalTaskIds.has(block.taskId));
    });

    for (const block of dayBlocks) {
      if (block.type === "task") protectedMinutes += block.duration;
    }

    const isToday = date.toDateString() === today.toDateString();
    return {
      key: date.toISOString(),
      short: date.toLocaleDateString("en-US", { weekday: "short" }),
      date: date.getDate(),
      isToday,
      blocks: dayBlocks.slice(0, 3).map((block) => {
        const task = block.taskId ? goalTasks.find((t) => t.id === block.taskId) : null;
        const hours = Math.round((block.duration / 60) * 10) / 10;
        return {
          id: block.id,
          label: block.title ?? task?.title ?? (block.type === "external" ? "Google" : "Block"),
          duration: `${hours}h`,
          color: block.color ?? processAccent(0).color,
          external: block.type === "external",
        };
      }),
    };
  });

  const unscheduledCount = goalTasks.filter((task) => {
    if (task.status === "done") return false;
    const inWeek = task.dueHorizon === "week"
      || (task.dueAt && inProductWeek(parseDate(task.dueAt)!, now));
    if (!inWeek) return false;
    return !blockForTask(task.id, blocks);
  }).length;

  void goalProjectIds;
  return { days, protectedMinutes, unscheduledCount };
}

export type GoalDetailViewProps = {
  goal: ApiGoal;
  progress: ApiGoalProgress | null;
  loadingProgress: boolean;
  projects: ApiProject[];
  tasks: WorkspaceTask[];
  blocks: DetailBlock[];
  now: Date;
  outcomeText: string | null;
  currentMilestoneTitle: string | null;
  health: string | null;
  onBack: () => void;
  onGoCalendar: () => void;
  onViewProgress: () => void;
  onEdit: () => void;
  onReview: () => void;
  onCopyContext?: () => void;
  onOpenTask: (taskId: string) => void;
  onOpenProject?: (projectId: string) => void;
  onSetMilestone: (id: string) => void;
  onManageMilestones: () => void;
  onAddWeekWork: (title: string) => void;
  onCreateProject: () => void;
  onAddProcess: () => void;
  onEditProcess: (processId: string) => void;
};

export function GoalDetailView({
  goal,
  progress,
  loadingProgress,
  projects,
  tasks,
  blocks,
  now,
  outcomeText,
  currentMilestoneTitle,
  health,
  onBack,
  onGoCalendar,
  onViewProgress,
  onEdit,
  onReview,
  onCopyContext,
  onOpenTask,
  onOpenProject,
  onSetMilestone,
  onManageMilestones,
  onAddWeekWork,
  onCreateProject,
  onAddProcess,
  onEditProcess,
}: GoalDetailViewProps) {
  const [weekDraft, setWeekDraft] = useState("");
  const focus = goal.focusType ?? "FOCUS";
  const linked = projects.filter((p) => p.goalId === goal.id && p.active);
  const goalTasks = useMemo(() => tasksForGoal(goal, projects, tasks), [goal, projects, tasks]);
  const weekTasks = goalTasks.filter((t) =>
    t.status !== "done"
    && (t.dueHorizon === "week" || (t.dueAt && inProductWeek(parseDate(t.dueAt)!, now))),
  );
  const milestones = goal.milestones ?? [];
  const processes = progress?.progress.processes ?? [];
  const goalProcesses = goal.processes ?? [];
  const consistency = progress?.progress.consistency;
  const currentIdx = Math.max(0, milestones.findIndex((m) => m.status === "current"));
  const weekLabel = weekRangeLabel(now);

  const { days, protectedMinutes, unscheduledCount } = useMemo(
    () => buildCalendarStrip(goalTasks, blocks, now),
    [goalTasks, blocks, now],
  );

  const nextTask = weekTasks.find((t) => !blockForTask(t.id, blocks)) ?? weekTasks[0] ?? null;
  const nextBlock = nextTask ? blockForTask(nextTask.id, blocks) : undefined;

  const outcomeParts = (() => {
    if (!outcomeText) return null;
    if (outcomeText.includes("/")) {
      const [left, right] = outcomeText.split("/").map((part) => part.trim());
      return { kind: "ratio" as const, left, right };
    }
    if (outcomeText.includes("→")) {
      return { kind: "trend" as const, text: outcomeText };
    }
    return { kind: "plain" as const, text: outcomeText };
  })();

  const submitWeekWork = () => {
    if (!weekDraft.trim()) return;
    onAddWeekWork(weekDraft.trim());
    setWeekDraft("");
  };

  return (
    <div className="pos-goal-detail">
      <div className="pos-goal-detail-topbar">
        <BackButton label="Goals" onClick={onBack} />
        <GoalBadge focus={focus} />
        <div className="pos-goal-detail-topbar-spacer" />
        {health === "Review needed" && (
          <button type="button" className="pos-btn-warn" onClick={onReview}>
            Review needed
          </button>
        )}
        <button type="button" className="pos-btn-secondary indigo" onClick={onGoCalendar}>
          Open Calendar
        </button>
        <button type="button" className="pos-btn-secondary" onClick={onEdit}>
          Edit
        </button>
        <button type="button" className="pos-btn-secondary" onClick={onViewProgress} disabled={!progress && !loadingProgress}>
          View Progress
        </button>
        {onCopyContext ? (
          <button type="button" className="pos-btn-secondary" onClick={onCopyContext}>
            Copy context
          </button>
        ) : null}
        <button type="button" className="pos-btn-secondary" onClick={onReview}>
          Review
        </button>
      </div>

      <div className="pos-goal-detail-scroll">
        <header className="pos-goal-hero">
          <div className="pos-goal-hero-main">
            <h1 className="pos-display">{goal.title}</h1>
            {(goal.outcome || goal.description) && goal.outcome !== goal.title && (
              <p className="pos-goal-desc">{goal.outcome || goal.description}</p>
            )}
            {goal.why && <p className="pos-goal-why">&ldquo;{goal.why}&rdquo;</p>}
          </div>
          <div className="pos-goal-hero-side">
            {goal.targetDate && (
              <div className="pos-hero-chip">
                <span>Target</span>
                <strong className="pos-mono">
                  {parseDate(goal.targetDate)?.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </strong>
              </div>
            )}
            {consistency && consistency.totalWeeks > 0 && (
              <div className="pos-hero-chip">
                <span>Consistency</span>
                <ConsistencyDots met={consistency.metWeeks} total={consistency.totalWeeks} />
              </div>
            )}
          </div>
        </header>

        <div className="pos-metric-row">
          <MetricCard
            label="Outcome"
            value={
              outcomeParts?.kind === "ratio" ? (
                <>
                  <span className="pos-mono pos-metric-big">{outcomeParts.left}</span>
                  <span className="pos-metric-slash">/</span>
                  <span className="pos-mono pos-metric-mid">{outcomeParts.right}</span>
                </>
              ) : (
                <span className="pos-mono pos-metric-big">
                  {loadingProgress && !outcomeText ? "…" : outcomeText ?? "—"}
                </span>
              )
            }
            sub={goal.metric || undefined}
          />
          <MetricCard
            label="Current stage"
            value={
              currentMilestoneTitle ? (
                <span className="pos-stage-value">
                  <i />
                  {currentMilestoneTitle}
                </span>
              ) : (
                <span className="pos-metric-muted">No milestone</span>
              )
            }
            sub={milestones.length > 0 ? `Milestone ${currentIdx + 1} of ${milestones.length}` : undefined}
          />
          <MetricCard
            label="Time protected"
            value={
              <>
                <span className="pos-mono pos-metric-big indigo">{formatHoursFromMinutes(protectedMinutes)}</span>
                <span className="pos-metric-unit">h</span>
              </>
            }
            sub="this week on calendar"
          />
        </div>

        <div className="pos-goal-columns">
          <div className="pos-goal-main-col">
            <section>
              <SectionLabel right={`${weekLabel}`}>This week&rsquo;s process</SectionLabel>
              {loadingProgress ? (
                <p className="pos-muted">Loading evidence…</p>
              ) : processes.length === 0 ? (
                <EmptyState title="No process yet." sub="Add a process to measure weekly behavior." />
              ) : (
                <div className="pos-process-grid">
                  {processes.map((proc, index) => (
                    <ProcessBar
                      key={proc.id}
                      name={proc.name}
                      bucket={proc.thisWeek}
                      accentIndex={index}
                      measurementType={proc.measurementType}
                    />
                  ))}
                </div>
              )}
            </section>

            <section>
              <SectionLabel
                right={
                  <span className="pos-cal-legend">
                    <span><i className="os" /> Personal OS</span>
                    <span><i className="gcal" /> Google (read-only)</span>
                  </span>
                }
              >
                Calendar · {weekLabel}
              </SectionLabel>
              <CalendarStrip days={days} />
              <p className="pos-cal-footnote">
                {hoursLabel(protectedMinutes)} protected · {unscheduledCount} unscheduled ·{" "}
                <button type="button" className="pos-text-link" onClick={onGoCalendar}>
                  Open Calendar →
                </button>
              </p>
            </section>

            <section>
              <SectionLabel
                right={
                  <button type="button" className="pos-text-link" onClick={onManageMilestones}>
                    {milestones.length > 0 ? "Manage" : "Add milestones"}
                  </button>
                }
              >
                Goal journey
              </SectionLabel>
              {milestones.length > 0 ? (
                <div className="pos-journey-card">
                  <MilestoneTimeline milestones={milestones} onSetCurrent={onSetMilestone} />
                </div>
              ) : (
                <EmptyState title="No milestones yet." sub="Add checkpoints for this Goal’s journey." />
              )}
            </section>

            <section>
              <SectionLabel>Linked projects</SectionLabel>
              {linked.length === 0 ? (
                <EmptyState title="No linked projects yet." />
              ) : (
                <div className="pos-project-grid">
                  {linked.map((project, index) => {
                    const accent = processAccent(index);
                    const process = goalProcesses.find((p) => p.id === project.defaultGoalProcessId)
                      ?? processes.find((p) => p.id === project.defaultGoalProcessId);
                    const progressProc = process
                      ? progress?.progress.processes.find((p) => p.id === process.id)
                      : undefined;
                    const bucket = progressProc?.thisWeek ?? null;
                    const measurementType = progressProc?.measurementType
                      ?? goalProcesses.find((p) => p.id === process?.id)?.measurementType;
                    const projectWeek = weekTasks.filter((t) => t.projectId === project.id);
                    const next = projectWeek[0];
                    const nextBlk = next ? blockForTask(next.id, blocks) : undefined;
                    return (
                      <button
                        key={project.id}
                        type="button"
                        className="pos-project-card"
                        onClick={() => onOpenProject?.(project.id)}
                        aria-label={`Edit project ${project.title}`}
                      >
                        <div className="pos-project-card-top">
                          <div>
                            <strong>
                              {project.title}
                              {project.projectType === "HABIT" ? (
                                <em className="pos-habit-badge">Habit</em>
                              ) : null}
                            </strong>
                            {process && <span>{process.name}</span>}
                          </div>
                          <span className="pos-btn-ghost pos-system-edit" aria-hidden="true">Edit</span>
                        </div>
                        {bucket && (
                          <div className="pos-project-week">
                            <div className="pos-project-week-nums pos-mono" style={{ color: accent.color }}>
                              {formatProcessRatio(bucket.completed, bucket.target, bucket.unit, measurementType)}
                            </div>
                            <div className="pos-process-track thin" aria-hidden="true">
                              <div
                                className="pos-process-completed-fill"
                                style={{
                                  width: `${Math.min((bucket.completed / Math.max(bucket.target, 0.0001)) * 100, 100)}%`,
                                  backgroundColor: accent.color,
                                }}
                              />
                            </div>
                          </div>
                        )}
                        {next && (
                          <div className="pos-project-next">
                            <p>{next.title}</p>
                            {nextBlk ? (
                              <ScheduledBadge label={formatBlockChip(nextBlk) ?? "Scheduled"} />
                            ) : (
                              <UnscheduledBadge />
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              <button type="button" className="pos-btn-ghost" onClick={onCreateProject}>
                + Add Project
              </button>
            </section>
          </div>

          <aside className="pos-goal-side-col">
            <div className="pos-next-action">
              <div className="pos-next-action-label">Next action</div>
              {nextTask ? (
                <>
                  <p className="pos-next-action-title">{nextTask.title}</p>
                  <div className="pos-next-action-meta">
                    <span>
                      {nextTask.duration ? `${nextTask.duration} min · ` : ""}
                      This week ·{" "}
                    </span>
                    {nextBlock ? (
                      <span className="ok">{formatBlockTimeRange(nextBlock)}</span>
                    ) : (
                      <span className="warn">Unscheduled</span>
                    )}
                  </div>
                  <div className="pos-next-action-actions">
                    {!nextBlock && (
                      <button type="button" className="pos-btn-on-indigo" onClick={onGoCalendar}>
                        Schedule session
                      </button>
                    )}
                    <button type="button" className="pos-btn-ghost-on-indigo" onClick={() => onOpenTask(nextTask.id)}>
                      Open task
                    </button>
                  </div>
                </>
              ) : (
                <p className="pos-next-action-empty">No open work for this week.</p>
              )}
            </div>

            <div className="pos-side-card">
              <div className="pos-side-card-label">Remaining this week</div>
              {weekTasks.length === 0 ? (
                <p className="pos-muted">No open work for this week.</p>
              ) : (
                <ul className="pos-remaining-list">
                  {weekTasks.map((task) => {
                    const block = blockForTask(task.id, blocks);
                    return (
                      <li key={task.id}>
                        <button type="button" onClick={() => onOpenTask(task.id)}>
                          <span className="pos-check" aria-hidden="true" />
                          <span>
                            <strong>{task.title}</strong>
                            <em>
                              {block ? formatBlockChip(block) : "Unscheduled"}
                              {task.dueHorizon ? ` · ${task.dueHorizon.toUpperCase()}` : ""}
                            </em>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="pos-inline-add">
                <input
                  value={weekDraft}
                  onChange={(e) => setWeekDraft(e.target.value)}
                  placeholder="Add remaining work"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitWeekWork();
                    }
                  }}
                />
                <button type="button" className="pos-btn-ghost" onClick={submitWeekWork}>
                  Add
                </button>
              </div>
            </div>

            <div className="pos-side-card">
              <div className="pos-side-card-label">Processes</div>
              <p className="pos-side-card-hint">Measurement / quota used for Goal progress.</p>
              {goalProcesses.length === 0 ? (
                <p className="pos-muted">No processes defined. Processes measure repeated Goal progress.</p>
              ) : (
                <ul className="pos-systems-list pos-systems-overview">
                  {goalProcesses.map((proc, index) => {
                    const accent = processAccent(index);
                    const progressProc = processes.find((p) => p.id === proc.id);
                    const bucket = progressProc?.thisWeek;
                    const pct = bucket && bucket.target > 0
                      ? Math.min((bucket.completed / bucket.target) * 100, 100)
                      : 0;
                    return (
                      <li key={proc.id}>
                        <i style={{ backgroundColor: accent.color }} />
                        <div>
                          <div className="pos-systems-row">
                            <span>{proc.name}</span>
                            {bucket && (
                              <span className="pos-mono">
                                {formatProcessRatio(
                                  bucket.completed,
                                  bucket.target,
                                  bucket.unit,
                                  progressProc?.measurementType ?? proc.measurementType,
                                )}
                              </span>
                            )}
                          </div>
                          <div className="pos-muted">
                            {proc.targetValue}{proc.unit ? ` ${proc.unit}` : ""} / {proc.period.toLowerCase()}
                          </div>
                          {bucket && (
                            <div className="pos-process-track thin" aria-hidden="true">
                              <div
                                className="pos-process-completed-fill"
                                style={{ width: `${pct}%`, backgroundColor: accent.color }}
                              />
                            </div>
                          )}
                          <button
                            type="button"
                            className="pos-btn-ghost pos-system-edit"
                            onClick={() => onEditProcess(proc.id)}
                          >
                            Edit
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <button type="button" className="pos-btn-ghost" onClick={onAddProcess}>
                + Add Process
              </button>
            </div>

            <div className="pos-side-links">
              <ArrowLink onClick={onViewProgress}>View full Progress</ArrowLink>
              <ArrowLink onClick={onGoCalendar}>Open Calendar</ArrowLink>
              <ArrowLink onClick={onReview}>Review / Close goal</ArrowLink>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
