"use client";

import type { ApiGoal, ApiProject } from "@/lib/planner-api";
import { formatProcessValue, type ProcessBucketView } from "@/lib/goal-progress-display";
import { projectWeekSummary, thisWeekLabel } from "@/lib/product-week";
import {
  EmptyState,
  GoalBadge,
  ScheduledBadge,
  UnscheduledBadge,
} from "./shared";
import { processAccent } from "./utils";
import type { WorkspaceBlock, WorkspaceTask } from "@/app/goal-project-workspaces";
import {
  formatShortDate,
  isRecurringProject,
} from "@/app/goal-project-workspaces";

function blockForTask(taskId: string, blocks: WorkspaceBlock[]) {
  return blocks.find((block) => block.taskId === taskId && block.type === "task");
}

function formatBlockChip(block: WorkspaceBlock) {
  if (!block.startAt) return null;
  return new Date(block.startAt).toLocaleDateString("en-US", { weekday: "short" });
}

function ProjectRow({
  project,
  goal,
  tasks,
  blocks,
  now,
  processInfo,
  onOpen,
}: {
  project: ApiProject;
  goal?: ApiGoal;
  tasks: WorkspaceTask[];
  blocks: WorkspaceBlock[];
  now: Date;
  processInfo: { name: string; thisWeek: ProcessBucketView } | null;
  onOpen: () => void;
}) {
  const week = projectWeekSummary(project.id, tasks, now);
  const open = tasks.filter((t) => t.projectId === project.id && t.status !== "done");
  const nextOpen = week.weekOpen[0] ?? open[0];
  const nextBlock = nextOpen ? blockForTask(nextOpen.id, blocks) : undefined;
  const processHeavy = Boolean(processInfo) || isRecurringProject(project, tasks);
  const accent = processAccent(0);

  return (
    <button type="button" className="pos-proj-row" onClick={onOpen}>
      <div className="pos-proj-row-name">
        <div className="pos-proj-row-title-line">
          <i className="pos-proj-dot" style={{ background: project.color }} />
          <span className="pos-proj-row-title">{project.title}</span>
        </div>
        <div className="pos-proj-row-meta">
          {goal && <GoalBadge focus={goal.focusType ?? "FOCUS"} size="xs" />}
          {processInfo && <span className="pos-proj-process-label">{processInfo.name}</span>}
        </div>
      </div>

      <div className="pos-proj-row-week">
        {processHeavy && processInfo ? (
          <div className="pos-proj-week-process">
            <div className="pos-proj-week-nums">
              <span className="pos-mono" style={{ color: accent.color }}>
                {formatProcessValue(processInfo.thisWeek.completed, processInfo.thisWeek.unit)}
              </span>
              <span className="pos-mono pos-muted">
                /{formatProcessValue(processInfo.thisWeek.target, processInfo.thisWeek.unit)}
              </span>
            </div>
            <div className="pos-process-track thin" aria-hidden="true">
              <div
                className="pos-process-completed-fill"
                style={{
                  width: `${Math.min(
                    (processInfo.thisWeek.completed / Math.max(processInfo.thisWeek.target, 0.0001)) * 100,
                    100,
                  )}%`,
                  backgroundColor: accent.color,
                }}
              />
            </div>
            {week.lifetimeTotal > 0 && (
              <span className="pos-proj-lifetime">
                All-time · {week.lifetimeDone}/{week.lifetimeTotal}
              </span>
            )}
          </div>
        ) : (
          <div className="pos-proj-week-process">
            <div className="pos-proj-week-nums">
              <span className="pos-mono">{week.lifetimeDone}</span>
              <span className="pos-mono pos-muted">/{week.lifetimeTotal} tasks</span>
            </div>
            <div className="pos-process-track thin" aria-hidden="true">
              <div
                className="pos-process-completed-fill"
                style={{
                  width: `${Math.min(
                    (week.lifetimeDone / Math.max(week.lifetimeTotal, 1)) * 100,
                    100,
                  )}%`,
                  backgroundColor: "#9ca3af",
                }}
              />
            </div>
            {(week.weekDone.length > 0 || week.weekOpen.length > 0) && (
              <span className="pos-proj-lifetime">
                {thisWeekLabel(week.weekDone.length, week.weekOpen.length)}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="pos-proj-row-next">
        {nextOpen ? (
          <>
            <p>{nextOpen.title}</p>
            {nextBlock ? (
              <ScheduledBadge label={formatBlockChip(nextBlock) ?? "Scheduled"} />
            ) : (
              <UnscheduledBadge />
            )}
          </>
        ) : (
          <span className="pos-muted">—</span>
        )}
      </div>

      <div className="pos-proj-row-deadline">
        {project.targetDate ? (
          <span className="pos-mono pos-proj-deadline-chip">
            {formatShortDate(project.targetDate)}
          </span>
        ) : (
          <span className="pos-muted">—</span>
        )}
      </div>
    </button>
  );
}

export type ProjectsOverviewViewProps = {
  projects: ApiProject[];
  completed: ApiProject[];
  goals: ApiGoal[];
  tasks: WorkspaceTask[];
  blocks: WorkspaceBlock[];
  now: Date;
  processByProjectId: Record<string, { name: string; thisWeek: ProcessBucketView } | null>;
  weekLabel: string;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onGoCalendar: () => void;
};

export function ProjectsOverviewView({
  projects,
  completed,
  goals,
  tasks,
  blocks,
  now,
  processByProjectId,
  weekLabel,
  onOpen,
  onCreate,
  onGoCalendar,
}: ProjectsOverviewViewProps) {
  const empty = projects.length === 0 && completed.length === 0;
  const goalById = Object.fromEntries(goals.map((g) => [g.id, g]));

  return (
    <div className="pos-proj">
      <div className="pos-proj-topbar pos-overview-actions">
        <div className="pos-proj-topbar-spacer" />
        <button type="button" className="pos-btn-secondary indigo" onClick={onGoCalendar}>
          Open Calendar
        </button>
        <button type="button" className="pos-btn-primary" onClick={onCreate}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
            <path d="M6.5 2v9M2 6.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          New Project
        </button>
      </div>

      <div className="pos-proj-scroll">
        <div className="pos-proj-week-head">
          <span className="pos-proj-week-title">Active projects</span>
          <span className="pos-muted">· {weekLabel}</span>
        </div>

        {empty ? (
          <EmptyState
            title="Projects are finite bodies of work"
            sub="Create one when something needs multiple tasks to finish."
          />
        ) : (
          <>
            {projects.length > 0 && (
              <div className="pos-proj-table">
                <div className="pos-proj-table-head">
                  <span>Project</span>
                  <span>This week</span>
                  <span>Next action</span>
                  <span>Deadline</span>
                </div>
                {projects.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    goal={project.goalId ? goalById[project.goalId] : undefined}
                    tasks={tasks}
                    blocks={blocks}
                    now={now}
                    processInfo={processByProjectId[project.id] ?? null}
                    onOpen={() => onOpen(project.id)}
                  />
                ))}
              </div>
            )}

            {completed.length > 0 && (
              <section className="pos-proj-completed">
                <h2>Completed</h2>
                <ul>
                  {completed.map((project) => (
                    <li key={project.id}>
                      <button type="button" onClick={() => onOpen(project.id)}>
                        <i className="pos-proj-dot" style={{ background: project.color }} />
                        <span>{project.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {empty && (
          <div className="pos-proj-empty-cta">
            <button type="button" className="pos-btn-primary" onClick={onCreate}>
              Create project
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
