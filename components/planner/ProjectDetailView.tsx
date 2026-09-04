"use client";

import type { ApiGoal, ApiProject } from "@/lib/planner-api";
import type { ProcessBucketView } from "@/lib/goal-progress-display";
import { inProductWeek, projectWeekSummary } from "@/lib/product-week";
import {
  ArrowLink,
  BackButton,
  EmptyState,
  GoalBadge,
  ProcessBar,
  ScheduledBadge,
  SectionLabel,
  UnscheduledBadge,
} from "./shared";
import { formatHoursFromMinutes } from "./utils";
import type { WorkspaceBlock, WorkspaceTask } from "@/app/goal-project-workspaces";
import {
  formatShortDate,
  isRecurringProject,
  weekTasksForProject,
} from "@/app/goal-project-workspaces";

function blockForTask(taskId: string, blocks: WorkspaceBlock[]) {
  return blocks.find((block) => block.taskId === taskId && block.type === "task");
}

function formatBlockTime(block?: WorkspaceBlock) {
  if (!block?.startAt) return null;
  const date = new Date(block.startAt);
  const day = date.toLocaleDateString("en-US", { weekday: "short" });
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} ${time}`;
}

function formatBlockChip(block: WorkspaceBlock) {
  if (!block.startAt) return null;
  return new Date(block.startAt).toLocaleDateString("en-US", { weekday: "short" });
}

export type ProjectDetailViewProps = {
  project: ApiProject;
  goal?: ApiGoal;
  tasks: WorkspaceTask[];
  blocks: WorkspaceBlock[];
  now: Date;
  weekLabel: string;
  processThisWeek?: { name: string; thisWeek: ProcessBucketView; measurementType?: string } | null;
  onBack: () => void;
  onEdit: () => void;
  onComplete: () => void;
  onOpenTask: (taskId: string) => void;
  onGoCalendar: () => void;
  onOpenGoal?: (goalId: string) => void;
};

export function ProjectDetailView({
  project,
  goal,
  tasks,
  blocks,
  now,
  weekLabel,
  processThisWeek = null,
  onBack,
  onEdit,
  onComplete,
  onOpenTask,
  onGoCalendar,
  onOpenGoal,
}: ProjectDetailViewProps) {
  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const open = projectTasks.filter((t) => t.status !== "done");
  const week = projectWeekSummary(project.id, tasks, now);
  const weekOpenIds = new Set(weekTasksForProject(project.id, tasks, now).map((t) => t.id));
  const weekOpen = open.filter((t) => weekOpenIds.has(t.id));
  const next = weekOpen[0] ?? open[0] ?? null;
  const nextBlock = next ? blockForTask(next.id, blocks) : undefined;
  const recurring = Boolean(processThisWeek) || isRecurringProject(project, tasks);

  const projectTaskIds = new Set(projectTasks.map((t) => t.id));
  let plannedMin = 0;
  for (const block of blocks) {
    if (block.type !== "task" || !block.taskId || !projectTaskIds.has(block.taskId) || !block.startAt) {
      continue;
    }
    if (inProductWeek(new Date(block.startAt), now)) plannedMin += block.duration;
  }

  return (
    <div className="pos-proj-detail">
      <div className="pos-proj-detail-topbar">
        <BackButton label="Projects" onClick={onBack} />
        {goal && (
          <button
            type="button"
            className="pos-proj-goal-link"
            onClick={() => onOpenGoal?.(goal.id)}
          >
            <GoalBadge focus={goal.focusType ?? "FOCUS"} size="xs" />
            <span>{goal.title}</span>
          </button>
        )}
        <div className="pos-proj-detail-topbar-spacer" />
        <button type="button" className="pos-btn-secondary indigo" onClick={onGoCalendar}>
          Open Calendar
        </button>
        <button type="button" className="pos-btn-secondary" onClick={onEdit}>
          Edit
        </button>
        {project.active && (
          <button type="button" className="pos-btn-ghost" onClick={onComplete}>
            Mark complete
          </button>
        )}
      </div>

      <div className="pos-proj-detail-scroll">
        <div className="pos-proj-detail-inner">
          <header className="pos-proj-detail-hero">
            <h1 className="pos-display">
              {project.title}
              {project.projectType === "HABIT" ? <em className="pos-habit-badge">Habit</em> : null}
            </h1>
            <div className="pos-proj-detail-meta">
              {goal && <GoalBadge focus={goal.focusType ?? "FOCUS"} />}
              {processThisWeek && (
                <span className="pos-muted">→ {processThisWeek.name}</span>
              )}
              {project.targetDate && (
                <span className="pos-mono pos-proj-deadline-chip">
                  {formatShortDate(project.targetDate)}
                </span>
              )}
            </div>
          </header>

          <div className="pos-next-action">
            <div className="pos-next-action-label">Next action</div>
            {next ? (
              <>
                <p className="pos-next-action-title">{next.title}</p>
                <div className="pos-next-action-meta">
                  {next.duration > 0 && <span>{next.duration} min · </span>}
                  {nextBlock ? (
                    <span className="ok">{formatBlockTime(nextBlock)}</span>
                  ) : (
                    <span className="warn">Unscheduled</span>
                  )}
                </div>
                <div className="pos-next-action-actions">
                  {!nextBlock && (
                    <button type="button" className="pos-btn-on-indigo" onClick={onGoCalendar}>
                      Schedule
                    </button>
                  )}
                  <button
                    type="button"
                    className="pos-btn-ghost-on-indigo"
                    onClick={() => onOpenTask(next.id)}
                  >
                    Open task
                  </button>
                </div>
              </>
            ) : (
              <p className="pos-next-action-empty">No open work for this project.</p>
            )}
          </div>

          {processThisWeek && (
            <section>
              <SectionLabel right={weekLabel}>This week</SectionLabel>
              <ProcessBar
                name={processThisWeek.name}
                bucket={processThisWeek.thisWeek}
                measurementType={processThisWeek.measurementType}
              />
            </section>
          )}

          <section>
            <SectionLabel>Open tasks</SectionLabel>
            {open.length === 0 ? (
              <EmptyState title="No open tasks." />
            ) : (
              <ul className="pos-proj-task-list">
                {open.map((task) => {
                  const block = blockForTask(task.id, blocks);
                  return (
                    <li key={task.id}>
                      <button type="button" onClick={() => onOpenTask(task.id)}>
                        <span className="pos-check" aria-hidden="true" />
                        <span className="pos-proj-task-main">
                          <strong>{task.title}</strong>
                          <span className="pos-proj-task-meta">
                            {task.duration > 0 && (
                              <em className="pos-mono">{task.duration}m</em>
                            )}
                            {block ? (
                              <ScheduledBadge label={formatBlockChip(block) ?? "Scheduled"} />
                            ) : (
                              <UnscheduledBadge />
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {project.targetDate && (
            <section>
              <SectionLabel>Deadline</SectionLabel>
              <div className="pos-gp-card">
                <span className="pos-mono">{formatShortDate(project.targetDate)}</span>
              </div>
            </section>
          )}

          <section>
            <SectionLabel>
              {recurring ? "Project progress (secondary)" : "Project progress"}
            </SectionLabel>
            <div className={recurring ? "pos-gp-card pos-proj-progress secondary" : "pos-gp-card pos-proj-progress"}>
              <div className="pos-proj-progress-nums">
                <span className="pos-mono pos-gp-outcome-big">{week.lifetimeDone}</span>
                <span className="pos-mono pos-gp-outcome-mid">/ {week.lifetimeTotal}</span>
              </div>
              <p className="pos-muted">tasks completed (lifetime)</p>
              <div className="pos-process-track" aria-hidden="true">
                <div
                  className="pos-process-completed-fill"
                  style={{
                    width: `${Math.min((week.lifetimeDone / Math.max(week.lifetimeTotal, 1)) * 100, 100)}%`,
                    backgroundColor: "#9ca3af",
                  }}
                />
              </div>
              {plannedMin > 0 && (
                <p className="pos-proj-planned-note">
                  <span className="pos-mono">{formatHoursFromMinutes(plannedMin)}h</span> planned this week
                </p>
              )}
            </div>
          </section>

          {project.description && (
            <section>
              <SectionLabel>Notes</SectionLabel>
              <div className="pos-gp-card">
                <p className="pos-proj-notes">{project.description}</p>
              </div>
            </section>
          )}

          <div className="pos-side-links">
            <ArrowLink onClick={onGoCalendar}>Open Calendar</ArrowLink>
            {goal && onOpenGoal && (
              <ArrowLink onClick={() => onOpenGoal(goal.id)}>View linked goal</ArrowLink>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
