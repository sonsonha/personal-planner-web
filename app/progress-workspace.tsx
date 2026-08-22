"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchGoalProgress,
  type ApiGoal,
  type ApiGoalProgress,
  type ApiProject,
} from "@/lib/planner-api";
import { processBucketCompact } from "@/lib/goal-progress-display";
import { isDayOverdue } from "@/lib/product-week";
import { GlobalProgressView, type AttentionItemData } from "@/components/planner/GlobalProgressView";
import { weekRangeLabel } from "@/components/planner/utils";
import {
  GoalProgressView,
  GoalReviewModal,
  weekCompletedForProject,
  weekTasksForProject,
  type WorkspaceBlock,
  type WorkspaceTask,
} from "./goal-project-workspaces";

type ProgressTask = WorkspaceTask & {
  color?: string;
  updatedAt?: string | null;
};

type ProgressBlock = WorkspaceBlock & { day?: number };

function blockDate(block: ProgressBlock, weekStart: Date) {
  if (block.startAt) {
    const date = new Date(block.startAt);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof block.day === "number") {
    return new Date(weekStart.getTime() + block.day * 86_400_000);
  }
  return null;
}

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function startOfLocalWeek(value: Date) {
  const day = startOfLocalDay(value);
  const weekday = day.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  day.setDate(day.getDate() + diff);
  return day;
}

function addLocalDays(value: Date, amount: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
}

function inWeek(date: Date, start: Date) {
  const end = addLocalDays(start, 7);
  return date.getTime() >= start.getTime() && date.getTime() < end.getTime();
}

function processBelowTarget(progress?: ApiGoalProgress | null) {
  return (progress?.progress.processes ?? []).filter((item) => {
    const bucket = item.thisWeek;
    return bucket.target > 0 && bucket.completed / bucket.target < 0.8;
  });
}

function goalIdForTask(task: ProgressTask, projects: ApiProject[]) {
  if (task.goalId) return task.goalId;
  const project = projects.find((item) => item.id === task.projectId);
  return project?.goalId ?? null;
}

export function ProgressWorkspace({
  tasks,
  blocks,
  projects,
  goals,
  now,
  weekStart,
  evidenceEpoch = 0,
  live,
  initialGoalId = null,
  onClearGoal,
  onOpenGoal,
  onOpenTask,
  onOpenProject,
  onChanged,
}: {
  tasks: ProgressTask[];
  blocks: ProgressBlock[];
  projects: ApiProject[];
  goals: ApiGoal[];
  now: Date;
  weekStart: Date;
  evidenceEpoch?: number;
  live: boolean;
  initialGoalId?: string | null;
  onClearGoal?: () => void;
  onOpenGoal?: (goalId: string) => void;
  onOpenTask?: (taskId: string) => void;
  onOpenProject?: (projectId: string) => void;
  onChanged?: (message: string) => void;
}) {
  const [progressById, setProgressById] = useState<Record<string, ApiGoalProgress>>({});
  const [reviewing, setReviewing] = useState(false);
  const today = startOfLocalDay(now);
  const thisWeekStart = startOfLocalWeek(now);

  const activeGoals = useMemo(
    () => goals.filter((goal) => goal.status === "ACTIVE"),
    [goals],
  );
  const closedGoals = useMemo(
    () => goals.filter((goal) => goal.status === "COMPLETED" || (goal.outcomeStatus && goal.outcomeStatus !== "ACTIVE")),
    [goals],
  );
  const goalIdsKey = [...activeGoals, ...closedGoals].map((goal) => goal.id).join(",");

  useEffect(() => {
    if (!goalIdsKey) {
      setProgressById({});
      return;
    }
    let cancelled = false;
    const ids = goalIdsKey.split(",");
    Promise.all(ids.map((id) =>
      fetchGoalProgress(id, now.toISOString())
        .then((progress) => [id, progress] as const)
        .catch(() => [id, null] as const),
    )).then((entries) => {
      if (cancelled) return;
      const next: Record<string, ApiGoalProgress> = {};
      for (const [id, progress] of entries) {
        if (progress) next[id] = progress;
      }
      setProgressById(next);
    });
    return () => { cancelled = true; };
  }, [goalIdsKey, now, evidenceEpoch]);

  const focusGoal = initialGoalId ? goals.find((goal) => goal.id === initialGoalId) ?? null : null;
  const focusProgress = focusGoal ? progressById[focusGoal.id] ?? null : null;

  const taskBlocksThisWeek = blocks.filter((block) => {
    if (block.type !== "task") return false;
    const start = blockDate(block, weekStart);
    return start ? inWeek(start, thisWeekStart) : false;
  });
  const countedBlockIds = new Set<string>();
  const timeByGoal = new Map<string, number>();
  let protectedMinutes = 0;
  for (const block of taskBlocksThisWeek) {
    if (countedBlockIds.has(block.id)) continue;
    countedBlockIds.add(block.id);
    protectedMinutes += block.duration;
    const task = tasks.find((item) => item.id === block.taskId);
    const goalId = task ? goalIdForTask(task, projects) : null;
    if (goalId) timeByGoal.set(goalId, (timeByGoal.get(goalId) ?? 0) + block.duration);
  }

  const open = tasks.filter((task) => task.status !== "done");
  const overdueTasks = open.filter((task) => isDayOverdue(task, today));

  const reviewGoals = activeGoals.filter((goal) => {
    if (!goal.targetDate) return false;
    const target = new Date(goal.targetDate.length <= 10 ? `${goal.targetDate}T12:00:00` : goal.targetDate);
    return target.getTime() < now.getTime();
  });

  const processAlerts = activeGoals.flatMap((goal) =>
    processBelowTarget(progressById[goal.id]).map((item) => ({
      goal,
      process: item,
    })),
  );

  const atRiskProjects = projects.filter((project) => {
    if (!project.active || !project.targetDate) return false;
    const target = new Date(project.targetDate.length <= 10 ? `${project.targetDate}T12:00:00` : project.targetDate);
    const openCount = tasks.filter((task) => task.projectId === project.id && task.status !== "done").length;
    const soon = target.getTime() <= addLocalDays(today, 7).getTime();
    return openCount > 0 && soon;
  });

  const goalsWithWork = activeGoals.filter((goal) => {
    const progress = progressById[goal.id];
    const processWork = (progress?.progress.processes ?? []).some((item) => item.thisWeek.planned > 0 || item.thisWeek.completed > 0);
    return processWork || (timeByGoal.get(goal.id) ?? 0) > 0;
  });

  if (focusGoal) {
    return (
      <section className="progress-workspace pos-pw-goal-page" aria-label="Goal progress">
        {focusProgress ? (
          <GoalProgressView
            goal={focusGoal}
            data={focusProgress}
            layout="page"
            protectedMinutes={timeByGoal.get(focusGoal.id) ?? 0}
            onClose={onClearGoal}
            onOpenTask={onOpenTask}
            onReview={() => setReviewing(true)}
          />
        ) : (
          <p className="gp-muted">{live ? "Loading evidence…" : "Progress is unavailable in demo mode."}</p>
        )}
        {reviewing && (
          <GoalReviewModal
            goal={focusGoal}
            progress={focusProgress}
            live={live}
            onClose={() => setReviewing(false)}
            onSaved={(message) => {
              setReviewing(false);
              onChanged?.(message);
              onClearGoal?.();
            }}
          />
        )}
      </section>
    );
  }

  const focusCards = activeGoals
    .filter((goal) => (goal.focusType ?? "FOCUS") === "FOCUS")
    .map((goal) => ({
      goal,
      progress: progressById[goal.id] ?? null,
      protectedMinutes: timeByGoal.get(goal.id) ?? 0,
    }));
  const maintainCards = activeGoals
    .filter((goal) => goal.focusType === "MAINTAIN")
    .map((goal) => ({
      goal,
      progress: progressById[goal.id] ?? null,
      protectedMinutes: timeByGoal.get(goal.id) ?? 0,
    }));
  const exploreCards = activeGoals
    .filter((goal) => goal.focusType === "EXPLORE")
    .map((goal) => ({
      goal,
      progress: progressById[goal.id] ?? null,
      protectedMinutes: timeByGoal.get(goal.id) ?? 0,
    }));

  const timeRows = [...timeByGoal.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([goalId, minutes], index) => ({
      goalId,
      title: goals.find((goal) => goal.id === goalId)?.title ?? "Goal",
      minutes,
      color: index === 0 ? "#4338CA" : index === 1 ? "#0891B2" : "#6B7280",
    }));

  const projectRows = projects.filter((project) => project.active).map((project) => {
    const weekOpen = weekTasksForProject(project.id, tasks, now);
    const weekDone = weekCompletedForProject(project.id, tasks, now);
    const goal = goals.find((item) => item.id === project.goalId);
    const process = goal && project.defaultGoalProcessId
      ? progressById[goal.id]?.progress.processes.find((item) => item.id === project.defaultGoalProcessId) ?? null
      : null;
    return {
      project,
      goal,
      nextTitle: weekOpen[0]?.title ?? null,
      processThisWeek: process
        ? { name: process.name, thisWeek: process.thisWeek }
        : null,
      weekDone: weekDone.length,
      weekOpen: weekOpen.length,
    };
  });

  const attentionItems: AttentionItemData[] = [
    ...overdueTasks.map((task) => ({
      id: `overdue-${task.id}`,
      kind: "overdue" as const,
      title: task.title,
      sub: "Overdue day task",
      actionLabel: "Open task",
      severity: "warn" as const,
      onAction: () => onOpenTask?.(task.id),
    })),
    ...processAlerts.map((item) => ({
      id: `process-${item.goal.id}-${item.process.id}`,
      kind: "process" as const,
      title: `${item.process.name} below target`,
      sub: `${processBucketCompact(item.process.thisWeek).targetLine} · ${item.goal.title}`,
      actionLabel: "Open goal",
      severity: "warn" as const,
      onAction: () => onOpenGoal?.(item.goal.id),
    })),
    ...reviewGoals.map((goal) => ({
      id: `review-${goal.id}`,
      kind: "review" as const,
      title: "Goal review due",
      sub: `${goal.title} — target date passed${goal.targetDate ? ` (${goal.targetDate})` : ""}`,
      actionLabel: "Review",
      severity: "info" as const,
      onAction: () => onOpenGoal?.(goal.id),
    })),
    ...atRiskProjects.map((project) => ({
      id: `project-${project.id}`,
      kind: "project" as const,
      title: `${project.title} at risk`,
      sub: "Deadline within 7 days with open tasks",
      actionLabel: "Open project",
      severity: "warn" as const,
      onAction: () => onOpenProject?.(project.id),
    })),
  ];

  const belowNames = processAlerts.slice(0, 3).map((item) => item.process.name).join(" · ");

  return (
    <section className="progress-workspace pos-pw-root" aria-label="Progress">
      <GlobalProgressView
        weekLabel={weekRangeLabel(now)}
        goalsWithWorkCount={goalsWithWork.length}
        goalsWithWorkSub={
          goalsWithWork.length > 0
            ? goalsWithWork.slice(0, 2).map((g) => g.title).join(" + ") + " received time"
            : "No scheduled goal work yet"
        }
        protectedMinutes={protectedMinutes}
        processesBelowTargetCount={processAlerts.length}
        processesBelowTargetSub={belowNames || "All processes on target"}
        focusGoals={focusCards}
        maintainGoals={maintainCards}
        exploreGoals={exploreCards}
        timeByGoal={timeRows}
        projects={projectRows}
        attentionItems={attentionItems}
        onOpenGoal={(id) => onOpenGoal?.(id)}
        onOpenProject={(id) => onOpenProject?.(id)}
        totalProjectCount={projectRows.length}
      />
    </section>
  );
}
