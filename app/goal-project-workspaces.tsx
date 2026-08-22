"use client";

import {
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createGoal,
  createProject,
  deleteProject,
  fetchGoalProgress,
  updateGoal,
  updateProject,
  type ApiGoal,
  type ApiGoalProgress,
  type ApiProject,
  type GoalFocusType,
  type GoalMilestone,
  type GoalOutcomeStatus,
  type GoalProcess,
  type GoalReflection,
  type GoalSystem,
} from "@/lib/planner-api";
import {
  inProductWeek,
  weekCompletedForProject,
  weekOpenForProject,
} from "@/lib/product-week";
import {
  formatObservationEntry,
  formatProcessRatio,
  formatProcessValue,
  isVagueGoalOutcome,
  processBucketCompact,
  processBucketForPeriod,
  processOnTargetSummary,
  progressPeriodLabel,
  type ProcessBucketView,
  type ProgressViewPeriod,
} from "@/lib/goal-progress-display";
import { GoalDetailView } from "@/components/planner/GoalDetailView";
import { GoalProgressPageView } from "@/components/planner/GoalProgressPageView";
import { GoalReviewView } from "@/components/planner/GoalReviewView";
import { GoalsOverviewView } from "@/components/planner/GoalsOverviewView";
import { ProjectDetailView } from "@/components/planner/ProjectDetailView";
import { ProjectsOverviewView } from "@/components/planner/ProjectsOverviewView";
import { weekRangeLabel } from "@/components/planner/utils";
type HorizonScope = "day" | "week" | "month" | "all";

const HORIZON_TABS: { id: HorizonScope; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "all", label: "All" },
];

function HorizonTabs({
  value,
  onChange,
}: {
  value: HorizonScope;
  onChange: (value: HorizonScope) => void;
}) {
  return (
    <div className="pos-task-horizon-tabs" role="tablist" aria-label="Time horizon">
      {HORIZON_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          className={value === tab.id ? "pos-task-horizon-tab active" : "pos-task-horizon-tab"}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export type WorkspaceTask = {
  id: string;
  title: string;
  projectId: string | null;
  goalId?: string | null;
  goalProcessId?: string | null;
  status: "inbox" | "scheduled" | "done";
  priority: "p1" | "p2" | "p3" | "p4";
  dueAt: string | null;
  dueHorizon?: "day" | "week" | "month" | null;
  completedAt?: string | null;
  duration: number;
};

export type WorkspaceBlock = {
  id: string;
  taskId?: string;
  startAt?: string;
  duration: number;
  type: "task" | "external";
};

const FOCUS_ORDER: GoalFocusType[] = ["FOCUS", "MAINTAIN", "EXPLORE"];
export const FOCUS_LABEL: Record<GoalFocusType, string> = {
  FOCUS: "Focus",
  MAINTAIN: "Maintain",
  EXPLORE: "Explore",
};

export const OUTCOME_STATUS_LABEL: Record<GoalOutcomeStatus, string> = {
  ACTIVE: "Active",
  ACHIEVED_ON_TIME: "Achieved on time",
  ACHIEVED_LATE: "Achieved late",
  PARTIALLY_ACHIEVED: "Partially achieved",
  NOT_ACHIEVED: "Not achieved by target date",
  STOPPED_INTENTIONALLY: "Stopped intentionally",
  NO_LONGER_RELEVANT: "No longer relevant",
};

function uid() {
  return crypto.randomUUID();
}

function goalOutcome(goal: ApiGoal) {
  return goal.outcome?.trim() || goal.title;
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value.length <= 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatShortDate(value: string | null | undefined) {
  const date = parseDate(value);
  if (!date) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function dateInWeek(date: Date, now: Date) {
  return inProductWeek(date, now);
}

export function currentMilestone(goal: ApiGoal): GoalMilestone | null {
  const milestones = goal.milestones ?? [];
  if (goal.currentMilestoneId) {
    return milestones.find((item) => item.id === goal.currentMilestoneId) ?? null;
  }
  return milestones.find((item) => item.status === "current")
    ?? milestones.find((item) => item.status === "pending")
    ?? null;
}

function goalBelongsToHorizon(goal: ApiGoal, horizon: HorizonScope, now: Date, projects: ApiProject[], tasks: WorkspaceTask[]) {
  if (horizon === "all") return true;
  const target = parseDate(goal.targetDate);
  if (target) {
    if (horizon === "day") {
      if (target.toDateString() === now.toDateString()) return true;
    } else if (horizon === "week") {
      if (dateInWeek(target, now)) return true;
    } else if (horizon === "month") {
      if (target.getFullYear() === now.getFullYear() && target.getMonth() === now.getMonth()) return true;
    }
  }
  if (horizon === "week" && goal.horizon === "WEEK") return true;
  if (horizon === "month" && (goal.horizon === "MONTH" || goal.horizon === "WEEK")) return true;
  return goalHasWorkInHorizon(goal, projects, tasks, horizon, now);
}

function tasksForGoal(goal: ApiGoal, projects: ApiProject[], tasks: WorkspaceTask[]) {
  const projectIds = new Set(projects.filter((p) => p.goalId === goal.id && p.active).map((p) => p.id));
  return tasks.filter((task) => task.goalId === goal.id || (task.projectId && projectIds.has(task.projectId)));
}

function goalHasWorkInHorizon(goal: ApiGoal, projects: ApiProject[], tasks: WorkspaceTask[], horizon: HorizonScope, now: Date) {
  if (horizon === "all") return true;
  return tasksForGoal(goal, projects, tasks).some((task) => {
    if (task.dueHorizon === horizon) return true;
    if (horizon === "month" && task.dueHorizon === "week") return true;
    const due = parseDate(task.dueAt);
    if (due) {
      if (horizon === "day") return due.toDateString() === now.toDateString();
      if (horizon === "week") return dateInWeek(due, now);
      if (horizon === "month") return due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth();
    }
    const completed = parseDate(task.completedAt);
    if (completed) {
      if (horizon === "day") return completed.toDateString() === now.toDateString();
      if (horizon === "week") return dateInWeek(completed, now);
      if (horizon === "month") return completed.getFullYear() === now.getFullYear() && completed.getMonth() === now.getMonth();
    }
    return false;
  });
}

export { weekCompletedForProject };

export function weekTasksForProject(projectId: string, tasks: WorkspaceTask[], now: Date) {
  return weekOpenForProject(projectId, tasks, now);
}

export {
  formatObservationEntry,
  formatProcessRatio,
  formatProcessValue,
  isVagueGoalOutcome,
  processBucketCompact,
  processBucketForPeriod,
  processOnTargetSummary,
  progressPeriodLabel,
  type ProcessBucketView,
  type ProgressViewPeriod,
};

function parseTargetNumber(goal: ApiGoal): number | null {
  const sources = [goal.outcome, goal.metric, goal.title];
  for (const source of sources) {
    const matches = source?.match(/(\d+(?:\.\d+)?)/g);
    if (matches?.length) return Number(matches[matches.length - 1]);
  }
  return null;
}

export function outcomeLine(goal: ApiGoal, progress?: ApiGoalProgress | null) {
  const latest = progress?.progress.latestObservation
    ?? [...(goal.metricObservations ?? [])].sort((a, b) => a.observedAt.localeCompare(b.observedAt)).at(-1)
    ?? null;
  const target = parseTargetNumber(goal);
  const metric = (goal.metric ?? "").toLowerCase();
  if (metric.includes("offer")) return `${latest?.value ?? 0} / ${target ?? 1} offers`;
  if (latest && target != null && latest.value !== target) return `${latest.value} → ${target}`;
  if (latest) return String(latest.value);
  return null;
}

export function isRecurringProject(project: ApiProject, tasks: WorkspaceTask[]) {
  if (project.defaultGoalProcessId) return true;
  return tasks.filter((task) => task.projectId === project.id).length >= 12;
}

export function healthLabel(goal: ApiGoal, now: Date) {
  const target = parseDate(goal.targetDate);
  if (goal.outcomeStatus && goal.outcomeStatus !== "ACTIVE") return OUTCOME_STATUS_LABEL[goal.outcomeStatus];
  if (goal.status === "COMPLETED") return "Achieved";
  if (target && target.getTime() < now.getTime()) return "Review needed";
  return null;
}

export function GoalsWorkspace({
  goals,
  projects,
  tasks,
  blocks,
  now,
  live,
  onChanged,
  onOpenTask,
  onGoCalendar,
  onAddWeekTask,
  onOpenProject,
  onViewFullProgress,
  evidenceEpoch = 0,
  initialDetailId = null,
  onOpenGoal,
  onDetailClose,
}: {
  goals: ApiGoal[];
  projects: ApiProject[];
  tasks: WorkspaceTask[];
  blocks: WorkspaceBlock[];
  now: Date;
  live: boolean;
  onChanged: (message: string) => void;
  onOpenTask: (taskId: string) => void;
  onGoCalendar: () => void;
  onAddWeekTask: (projectId: string | null, title: string) => void;
  onOpenProject?: (projectId: string) => void;
  onViewFullProgress?: (goalId: string) => void;
  evidenceEpoch?: number;
  initialDetailId?: string | null;
  onOpenGoal?: (goalId: string) => void;
  onDetailClose?: () => void;
}) {
  const [horizon, setHorizon] = useState<HorizonScope>("all");
  const [creating, setCreating] = useState(false);
  const [localDetailId, setLocalDetailId] = useState<string | null>(null);
  const [openReview, setOpenReview] = useState(false);
  const [progressById, setProgressById] = useState<Record<string, ApiGoalProgress>>({});
  const detailId = onOpenGoal ? initialDetailId : localDetailId;
  const openGoal = (id: string, review = false) => {
    setOpenReview(review);
    if (onOpenGoal) onOpenGoal(id);
    else setLocalDetailId(id);
  };
  const closeGoal = () => {
    setOpenReview(false);
    if (onOpenGoal) onDetailClose?.();
    else setLocalDetailId(null);
  };

  const activeGoals = useMemo(() => goals
    .filter((goal) => goal.status === "ACTIVE")
    .filter((goal) => goalBelongsToHorizon(goal, horizon, now, projects, tasks))
    .sort((a, b) => {
      const focus = FOCUS_ORDER.indexOf(a.focusType ?? "FOCUS") - FOCUS_ORDER.indexOf(b.focusType ?? "FOCUS");
      if (focus !== 0) return focus;
      const aDate = parseDate(a.targetDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bDate = parseDate(b.targetDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aDate - bDate;
    }), [goals, horizon, now, projects, tasks]);

  const grouped = FOCUS_ORDER.map((focus) => ({
    focus,
    items: activeGoals.filter((goal) => (goal.focusType ?? "FOCUS") === focus),
  })).filter((group) => group.items.length > 0);
  const focusCount = grouped.find((group) => group.focus === "FOCUS")?.items.length ?? 0;
  const goalIdsKey = activeGoals.map((goal) => goal.id).join(",");

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

  const detailGoal = detailId ? goals.find((g) => g.id === detailId) ?? null : null;

  if (detailGoal) {
    return (
      <section className="gp-workspace gp-workspace-detail" aria-label="Goal detail">
        <GoalDetailPage
          goal={detailGoal}
          projects={projects}
          tasks={tasks}
          blocks={blocks}
          now={now}
          live={live}
          onClose={closeGoal}
          onChanged={onChanged}
          onOpenTask={onOpenTask}
          onGoCalendar={onGoCalendar}
          onAddWeekTask={onAddWeekTask}
          onOpenProject={onOpenProject}
          onViewFullProgress={onViewFullProgress}
          evidenceEpoch={evidenceEpoch}
          openReview={openReview}
        />
      </section>
    );
  }

  return (
    <section className="gp-workspace gp-workspace-overview" aria-label="Goals">
      <GoalsOverviewView
        grouped={grouped}
        progressById={progressById}
        projects={projects}
        tasks={tasks}
        blocks={blocks}
        now={now}
        focusCount={focusCount}
        onOpenGoal={(id) => openGoal(id)}
        onReviewGoal={(id) => openGoal(id, true)}
        onCreate={() => setCreating(true)}
        horizonTabs={<HorizonTabs value={horizon} onChange={setHorizon} />}
      />

      {creating && (
        <GoalCreateFlow
          live={live}
          onClose={() => setCreating(false)}
          onSaved={(message) => {
            setCreating(false);
            onChanged(message);
          }}
          focusCount={focusCount}
        />
      )}
    </section>
  );
}

function GoalCreateFlow({
  live,
  onClose,
  onSaved,
  focusCount = 0,
}: {
  live: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
  focusCount?: number;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [outcome, setOutcome] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [metric, setMetric] = useState("");
  const [why, setWhy] = useState("");
  const [focusType, setFocusType] = useState<GoalFocusType>(focusCount >= 3 ? "MAINTAIN" : "FOCUS");
  const [milestones, setMilestones] = useState<GoalMilestone[]>([]);
  const [systems, setSystems] = useState<GoalSystem[]>([]);
  const [milestoneDraft, setMilestoneDraft] = useState("");
  const [systemDraft, setSystemDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addMilestone = () => {
    if (!milestoneDraft.trim()) return;
    setMilestones((current) => [
      ...current,
      { id: uid(), title: milestoneDraft.trim(), status: current.length === 0 ? "current" : "pending" },
    ]);
    setMilestoneDraft("");
  };

  const addSystem = () => {
    if (!systemDraft.trim()) return;
    setSystems((current) => [...current, { id: uid(), title: systemDraft.trim() }]);
    setSystemDraft("");
  };

  const save = async () => {
    if (!outcome.trim()) {
      setError("Describe the outcome you want to make true.");
      return;
    }
    setSaving(true);
    setError(null);
    const currentId = milestones.find((m) => m.status === "current")?.id ?? milestones[0]?.id ?? null;
    const payload = {
      title: outcome.trim(),
      outcome: outcome.trim(),
      targetDate: targetDate || null,
      metric: metric.trim(),
      why: why.trim(),
      focusType,
      milestones,
      systems,
      currentMilestoneId: currentId,
    };
    if (!live) {
      onSaved("Goal created · demo mode");
      return;
    }
    try {
      await createGoal(payload);
      onSaved("Goal created");
    } catch {
      setSaving(false);
      setError("Could not save this goal.");
    }
  };

  return (
    <div className="gp-panel-backdrop">
      <button className="modal-dismiss" type="button" aria-label="Close" onClick={onClose} />
      <div className="gp-panel gp-create-panel" role="dialog" aria-modal="true">
        <div className="gp-panel-header">
          <div>
            <div className="eyebrow">New goal · step {step} of 3</div>
            <h3>{step === 1 ? "What do you want to make true?" : step === 2 ? "Make it concrete" : "Optional path"}</h3>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {step === 1 && (
          <div className="gp-panel-body">
            <label className="gp-outcome-field">
              <span>Outcome</span>
              <textarea
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="Get a Backend Developer job before the end of November"
                rows={3}
                autoFocus
              />
              {isVagueGoalOutcome(outcome) && (
                <p className="gp-guidance">A Goal works best when the desired result is concrete.</p>
              )}
            </label>
            <label>
              <span>Deadline (optional)</span>
              <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
            </label>
            <label>
              <span>Focus type</span>
              <select value={focusType} onChange={(e) => setFocusType(e.target.value as GoalFocusType)}>
                <option value="FOCUS">Focus — actively progressing now (1–2)</option>
                <option value="MAINTAIN">Maintain — keep healthy</option>
                <option value="EXPLORE">Explore — investigate without full commitment</option>
              </select>
              {focusCount >= 3 && focusType === "FOCUS" && (
                <p className="gp-guidance">
                  You already have {focusCount} Focus goals. Focus works best when only a few outcomes compete for primary attention.
                </p>
              )}
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="gp-panel-body">
            <div className="gp-summary-box">
              <strong>{outcome || "—"}</strong>
              {targetDate && <span>Due {formatShortDate(targetDate)}</span>}
            </div>
            <label><span>Metric — how will you know it worked?</span>
              <input value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="Offer received" />
              {isVagueGoalOutcome(metric || outcome) && !isVagueGoalOutcome(outcome) && (
                <p className="gp-guidance">A Goal works best when the desired result is concrete.</p>
              )}
            </label>
            <label><span>Why — why does this matter?</span>
              <textarea value={why} onChange={(e) => setWhy(e.target.value)} rows={2} placeholder="Stable income + stronger career capital" />
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="gp-panel-body">
            <label><span>Milestones (optional)</span>
              <div className="gp-inline-add">
                <input value={milestoneDraft} onChange={(e) => setMilestoneDraft(e.target.value)} placeholder="Interview pipeline" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addMilestone())} />
                <button type="button" className="ghost-button" onClick={addMilestone}>Add</button>
              </div>
              {milestones.length > 0 && (
                <ul className="gp-chip-list">
                  {milestones.map((m) => <li key={m.id}>{m.title}{m.status === "current" ? " · current" : ""}</li>)}
                </ul>
              )}
            </label>
            <label><span>Systems / repeated behavior (optional)</span>
              <div className="gp-inline-add">
                <input value={systemDraft} onChange={(e) => setSystemDraft(e.target.value)} placeholder="5 quality applications/week" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSystem())} />
                <button type="button" className="ghost-button" onClick={addSystem}>Add</button>
              </div>
              {systems.length > 0 && (
                <ul className="gp-chip-list">
                  {systems.map((s) => <li key={s.id}>{s.title}</li>)}
                </ul>
              )}
            </label>
          </div>
        )}

        {error && <p className="entity-error">{error}</p>}

        <div className="gp-panel-footer">
          {step > 1 && <button type="button" className="ghost-button" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>Back</button>}
          <div className="gp-panel-footer-right">
            {step < 3 ? (
              <button type="button" className="primary-button" onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)} disabled={step === 1 && !outcome.trim()}>
                Continue
              </button>
            ) : (
              <button type="button" className="primary-button" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save goal"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function GoalDetailPage({
  goal,
  projects,
  tasks,
  blocks,
  now,
  live,
  onClose,
  onChanged,
  onOpenTask,
  onGoCalendar,
  onAddWeekTask,
  onOpenProject,
  onViewFullProgress,
  evidenceEpoch = 0,
  openReview = false,
}: {
  goal: ApiGoal;
  projects: ApiProject[];
  tasks: WorkspaceTask[];
  blocks: WorkspaceBlock[];
  now: Date;
  live: boolean;
  onClose: () => void;
  onChanged: (message: string) => void;
  onOpenTask: (taskId: string) => void;
  onGoCalendar: () => void;
  onAddWeekTask: (projectId: string | null, title: string) => void;
  onOpenProject?: (projectId: string) => void;
  onViewFullProgress?: (goalId: string) => void;
  evidenceEpoch?: number;
  openReview?: boolean;
}) {
  const [creatingProject, setCreatingProject] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [showReview, setShowReview] = useState(openReview);
  const [manageSystems, setManageSystems] = useState(false);
  const [progress, setProgress] = useState<ApiGoalProgress | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(live);
  const [processDraftName, setProcessDraftName] = useState("");
  const [processDraftType, setProcessDraftType] = useState<GoalProcess["measurementType"]>("COUNT");
  const [processDraftTarget, setProcessDraftTarget] = useState("5");
  const [processDraftPeriod, setProcessDraftPeriod] = useState<GoalProcess["period"]>("WEEK");
  const [processDraftUnit, setProcessDraftUnit] = useState("");
  const linked = projects.filter((p) => p.goalId === goal.id && p.active);
  const current = currentMilestone(goal);
  const health = healthLabel(goal, now);

  useEffect(() => {
    if (openReview) setShowReview(true);
  }, [openReview]);

  useEffect(() => {
    let cancelled = false;
    setLoadingProgress(true);
    fetchGoalProgress(goal.id, now.toISOString())
      .then((next) => {
        if (!cancelled) setProgress(next);
      })
      .catch(() => {
        if (!cancelled) setProgress(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingProgress(false);
      });
    return () => { cancelled = true; };
  }, [goal.id, now, evidenceEpoch]);

  const setMilestoneCurrent = async (id: string) => {
    const milestones = goal.milestones ?? [];
    const next = milestones.map((m) => ({
      ...m,
      status: m.id === id ? "current" as const : m.status === "current" ? "pending" as const : m.status,
    }));
    if (!live) {
      onChanged("Milestone updated · demo mode");
      return;
    }
    await updateGoal(goal.id, { milestones: next, currentMilestoneId: id });
    onChanged("Current milestone updated");
  };

  const addProcess = async () => {
    const processes = goal.processes ?? [];
    const target = Number(processDraftTarget);
    if (!processDraftName.trim() || !Number.isFinite(target)) return;
    const next = [
      ...processes,
      {
        id: uid(),
        name: processDraftName.trim(),
        measurementType: processDraftType,
        targetValue: target,
        unit: processDraftType === "DURATION" ? (processDraftUnit || "h") : (processDraftUnit || undefined),
        period: processDraftPeriod,
        active: true,
      },
    ];
    if (!live) {
      onChanged("Process added · demo mode");
      return;
    }
    await updateGoal(goal.id, { processes: next });
    onChanged("Goal process added");
    setProcessDraftName("");
    setProcessDraftTarget("5");
    setProcessDraftUnit("");
  };

  return (
    <div className="gp-detail-page pos-goal-detail-host">
      <GoalDetailView
        goal={goal}
        progress={progress}
        loadingProgress={loadingProgress}
        projects={projects}
        tasks={tasks}
        blocks={blocks}
        now={now}
        outcomeText={outcomeLine(goal, progress)}
        currentMilestoneTitle={current?.title ?? null}
        health={health}
        onBack={onClose}
        onGoCalendar={onGoCalendar}
        onViewProgress={() => {
          if (onViewFullProgress) onViewFullProgress(goal.id);
          else if (progress) setShowProgress(true);
        }}
        onReview={() => setShowReview(true)}
        onOpenTask={onOpenTask}
        onOpenProject={onOpenProject}
        onSetMilestone={setMilestoneCurrent}
        onAddWeekWork={(title) => {
          if (linked.length === 0) {
            onChanged("Link a project to this goal before adding weekly work");
            return;
          }
          onAddWeekTask(linked[0]!.id, title);
        }}
        onCreateProject={() => setCreatingProject(true)}
        manageSystems={manageSystems}
        onToggleManageSystems={() => setManageSystems((value) => !value)}
        systemsEditor={(
          <div className="gp-process-editor" style={{ marginTop: 12 }}>
            <p className="gp-muted">Repeated behavior measured from Tasks and Calendar — not entered as a score.</p>
            <div className="gp-process-form">
              <input value={processDraftName} onChange={(e) => setProcessDraftName(e.target.value)} placeholder="Applications" />
              <select value={processDraftType} onChange={(e) => setProcessDraftType(e.target.value as GoalProcess["measurementType"])}>
                <option value="COUNT">Count</option>
                <option value="DURATION">Duration</option>
                <option value="BINARY">Binary</option>
                <option value="CUSTOM_METRIC">Custom metric</option>
              </select>
              <input value={processDraftTarget} onChange={(e) => setProcessDraftTarget(e.target.value)} placeholder="5" />
              <input value={processDraftUnit} onChange={(e) => setProcessDraftUnit(e.target.value)} placeholder={processDraftType === "DURATION" ? "h" : "unit"} />
              <select value={processDraftPeriod} onChange={(e) => setProcessDraftPeriod(e.target.value as GoalProcess["period"])}>
                <option value="WEEK">Week</option>
                <option value="MONTH">Month</option>
                <option value="DAY">Day</option>
              </select>
              <button type="button" className="ghost-button" onClick={addProcess}>Add process</button>
            </div>
          </div>
        )}
      />

      {creatingProject && (
        <ProjectEditorModal
          project={null}
          goals={[goal]}
          prefillGoalId={goal.id}
          live={live}
          onClose={() => setCreatingProject(false)}
          onSaved={(message) => {
            setCreatingProject(false);
            onChanged(message);
          }}
        />
      )}

      {showProgress && progress && (
        <GoalProgressPanel goal={goal} data={progress} onClose={() => setShowProgress(false)} />
      )}

      {showReview && (
        <GoalReviewModal
          goal={goal}
          progress={progress}
          live={live}
          onClose={() => setShowReview(false)}
          onSaved={(message) => {
            setShowReview(false);
            onChanged(message);
            onClose();
          }}
        />
      )}
    </div>
  );
}

export function GoalProgressView({
  goal,
  data,
  layout = "page",
  protectedMinutes = 0,
  onClose,
  onOpenTask,
  onReview,
}: {
  goal: ApiGoal;
  data: ApiGoalProgress;
  layout?: "page" | "panel";
  protectedMinutes?: number;
  onClose?: () => void;
  onOpenTask?: (taskId: string) => void;
  onReview?: () => void;
}) {
  return (
    <GoalProgressPageView
      goal={goal}
      data={data}
      protectedMinutes={protectedMinutes}
      layout={layout}
      onBack={onClose}
      onOpenTask={onOpenTask}
      onReview={onReview}
    />
  );
}

function GoalProgressPanel({
  goal,
  data,
  onClose,
}: {
  goal: ApiGoal;
  data: ApiGoalProgress;
  onClose: () => void;
}) {
  return <GoalProgressView goal={goal} data={data} layout="panel" onClose={onClose} />;
}

export function GoalReviewModal({
  goal,
  progress,
  live,
  onClose,
  onSaved,
}: {
  goal: ApiGoal;
  progress: ApiGoalProgress | null;
  live: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const isClosed = Boolean(goal.outcomeStatus && goal.outcomeStatus !== "ACTIVE");
  const [outcomeStatus, setOutcomeStatus] = useState<GoalOutcomeStatus | null>(
    isClosed ? (goal.outcomeStatus ?? null) : null,
  );
  const [achievedAt, setAchievedAt] = useState(goal.achievedAt ? goal.achievedAt.slice(0, 10) : "");
  const [seriousAttempt, setSeriousAttempt] = useState<GoalReflection["seriousAttempt"]>(goal.reflection?.seriousAttempt ?? null);
  const [worked, setWorked] = useState(goal.reflection?.worked ?? "");
  const [didntWork, setDidntWork] = useState(goal.reflection?.didntWork ?? "");
  const [outsideControl, setOutsideControl] = useState(goal.reflection?.outsideControl ?? "");
  const [learned, setLearned] = useState(goal.reflection?.learned ?? "");
  const [differently, setDifferently] = useState(goal.reflection?.differently ?? "");
  const [nextAction, setNextAction] = useState<GoalReflection["nextAction"]>(goal.reflection?.nextAction ?? null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!outcomeStatus) return;
    const reviewSnapshot = progress ? {
      generatedAt: new Date().toISOString(),
      outcomeStatus,
      targetDate: goal.targetDate ?? null,
      achievedAt: achievedAt ? new Date(`${achievedAt}T12:00:00`).toISOString() : null,
      processSummary: progress.progress.processes.map((process) => ({
        processId: process.id,
        name: process.name,
        completed: process.thisMonth.completed,
        planned: process.thisMonth.planned,
        target: process.thisMonth.target,
        unit: process.thisMonth.unit,
      })),
      consistency: progress.progress.consistency,
      milestones: (goal.milestones ?? []).map((m) => ({ id: m.id, title: m.title, status: m.status })),
      latestObservation: progress.progress.latestObservation,
    } : null;
    if (!live) {
      onSaved("Goal review saved · demo mode");
      return;
    }
    setSaving(true);
    try {
      await updateGoal(goal.id, {
        status: outcomeStatus === "ACTIVE" ? "ACTIVE" : "COMPLETED",
        outcomeStatus,
        achievedAt: achievedAt ? new Date(`${achievedAt}T12:00:00`).toISOString() : null,
        closedAt: outcomeStatus === "ACTIVE" ? null : new Date().toISOString(),
        reflection: {
          seriousAttempt,
          worked,
          didntWork,
          outsideControl,
          learned,
          differently,
          nextAction,
          reviewedAt: new Date().toISOString(),
        },
        reviewSnapshot,
      });
      onSaved("Goal review saved");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="gp-panel-backdrop pos-gr-backdrop">
      <button className="modal-dismiss" type="button" aria-label="Close" onClick={onClose} />
      <div className="pos-gr-shell" role="dialog" aria-modal="true" aria-label="Goal review">
        <GoalReviewView
          goal={goal}
          progress={progress}
          outcomeStatus={outcomeStatus}
          onOutcomeStatus={setOutcomeStatus}
          achievedAt={achievedAt}
          onAchievedAt={setAchievedAt}
          seriousAttempt={seriousAttempt}
          onSeriousAttempt={setSeriousAttempt}
          worked={worked}
          onWorked={setWorked}
          didntWork={didntWork}
          onDidntWork={setDidntWork}
          outsideControl={outsideControl}
          onOutsideControl={setOutsideControl}
          learned={learned}
          onLearned={setLearned}
          differently={differently}
          onDifferently={setDifferently}
          nextAction={nextAction}
          onNextAction={setNextAction}
          saving={saving}
          onSave={save}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}

// ─── Projects Workspace ──────────────────────────────────────────────────────

export function ProjectsWorkspace({
  projects,
  goals,
  tasks,
  blocks,
  now,
  live,
  onChanged,
  onOpenTask,
  onGoCalendar,
  initialDetailId = null,
  onDetailClose,
  onOpenDetail,
  onOpenGoal,
  evidenceEpoch = 0,
}: {
  projects: ApiProject[];
  goals: ApiGoal[];
  tasks: WorkspaceTask[];
  blocks: WorkspaceBlock[];
  now: Date;
  live: boolean;
  onChanged: (message: string) => void;
  onOpenTask: (taskId: string) => void;
  onGoCalendar: () => void;
  initialDetailId?: string | null;
  onDetailClose?: () => void;
  onOpenDetail?: (projectId: string) => void;
  onOpenGoal?: (goalId: string) => void;
  evidenceEpoch?: number;
}) {
  const [creating, setCreating] = useState(false);
  const [localDetailId, setLocalDetailId] = useState<string | null>(null);
  const [prefillGoalId, setPrefillGoalId] = useState<string | null>(null);
  const [progressById, setProgressById] = useState<Record<string, ApiGoalProgress>>({});
  const detailId = onOpenDetail ? initialDetailId : localDetailId;

  const openDetail = (id: string) => onOpenDetail ? onOpenDetail(id) : setLocalDetailId(id);
  const closeDetail = () => {
    if (onOpenDetail) onDetailClose?.();
    else setLocalDetailId(null);
  };

  const active = projects.filter((p) => p.active).sort((a, b) => a.title.localeCompare(b.title));
  const completed = projects.filter((p) => !p.active);
  const detail = detailId ? projects.find((p) => p.id === detailId) ?? null : null;
  const goalIdsKey = [...new Set(projects.map((project) => project.goalId).filter(Boolean))].join(",");

  useEffect(() => {
    if (!goalIdsKey) {
      setProgressById({});
      return;
    }
    let cancelled = false;
    Promise.all(goalIdsKey.split(",").map((id) =>
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

  return (
    <section className="gp-workspace gp-workspace-overview" aria-label="Projects">
      <ProjectsOverviewView
        projects={active}
        completed={completed}
        goals={goals}
        tasks={tasks}
        blocks={blocks}
        now={now}
        processByProjectId={Object.fromEntries(
          active.map((project) => [project.id, linkedProcess(project, progressById)]),
        )}
        weekLabel={weekRangeLabel(now)}
        onOpen={(id) => openDetail(id)}
        onCreate={() => { setPrefillGoalId(null); setCreating(true); }}
        onGoCalendar={onGoCalendar}
      />

      {creating && (
        <ProjectEditorModal
          project={null}
          goals={goals}
          prefillGoalId={prefillGoalId}
          live={live}
          onClose={() => setCreating(false)}
          onSaved={(message) => { setCreating(false); onChanged(message); }}
        />
      )}

      {detail && (
        <ProjectDetailPanel
          project={detail}
          goal={goals.find((g) => g.id === detail.goalId)}
          goals={goals}
          tasks={tasks}
          blocks={blocks}
          now={now}
          live={live}
          processThisWeek={linkedProcess(detail, progressById)}
          onClose={closeDetail}
          onChanged={onChanged}
          onOpenTask={onOpenTask}
          onGoCalendar={onGoCalendar}
          onOpenGoal={onOpenGoal}
        />
      )}
    </section>
  );
}

function linkedProcess(project: ApiProject, progressById: Record<string, ApiGoalProgress>) {
  if (!project.defaultGoalProcessId || !project.goalId) return null;
  return progressById[project.goalId]?.progress.processes.find((item) => item.id === project.defaultGoalProcessId) ?? null;
}

function ProjectEditorModal({
  project,
  goals,
  prefillGoalId,
  live,
  onClose,
  onSaved,
}: {
  project: ApiProject | null;
  goals: ApiGoal[];
  prefillGoalId?: string | null;
  live: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [title, setTitle] = useState(project?.title ?? "");
  const [goalId, setGoalId] = useState<string | "">(project?.goalId ?? prefillGoalId ?? "");
  const [color, setColor] = useState(project?.color ?? "#705CF6");
  const [description, setDescription] = useState(project?.description ?? "");
  const [targetDate, setTargetDate] = useState(project?.targetDate ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) { setError("Project title is required."); return; }
    setSaving(true);
    setError(null);
    const payload = {
      title: title.trim(),
      goalId: goalId || null,
      color,
      description: description.trim(),
      targetDate: targetDate || null,
    };
    if (!live) { onSaved(project ? "Project updated · demo mode" : "Project created · demo mode"); return; }
    try {
      if (project) {
        await updateProject(project.id, payload);
        onSaved("Project updated");
      } else {
        await createProject(payload);
        onSaved("Project created");
      }
    } catch {
      setSaving(false);
      setError("Could not save this project.");
    }
  };

  const remove = async () => {
    if (!project) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setSaving(true);
    if (!live) { onSaved("Project deleted · demo mode"); return; }
    try {
      await deleteProject(project.id);
      onSaved("Project deleted · linked tasks moved to Inbox");
    } catch {
      setSaving(false);
      setError("Could not delete this project.");
    }
  };

  return (
    <div className="entity-modal-backdrop">
      <button className="modal-dismiss" type="button" aria-label="Close" onClick={onClose} />
      <form className="entity-modal gp-project-modal" onSubmit={submit}>
        <div className="entity-modal-header">
          <div><div className="eyebrow">Project</div><h3>{project ? "Edit project" : "New project"}</h3></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <label><span>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /></label>
        <label><span>Linked goal</span>
          <select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">None</option>
            {goals.filter((g) => g.status === "ACTIVE").map((g) => (
              <option key={g.id} value={g.id}>{goalOutcome(g)}</option>
            ))}
          </select>
        </label>
        <label><span>Deadline (optional)</span><input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></label>
        <label><span>Color</span><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
        <label><span>Notes</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></label>
        {error && <p className="entity-error">{error}</p>}
        <div className="entity-modal-actions">
          {project && <button type="button" className="danger-button" onClick={remove} disabled={saving}><Trash2 size={15} /> {confirmDelete ? "Confirm delete" : "Delete"}</button>}
          <div className="entity-modal-actions-right">
            <button type="button" className="ghost-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

function ProjectDetailPanel({
  project,
  goal,
  goals,
  tasks,
  blocks,
  now,
  live,
  processThisWeek = null,
  onClose,
  onChanged,
  onOpenTask,
  onGoCalendar,
  onOpenGoal,
}: {
  project: ApiProject;
  goal?: ApiGoal;
  goals: ApiGoal[];
  tasks: WorkspaceTask[];
  blocks: WorkspaceBlock[];
  now: Date;
  live: boolean;
  processThisWeek?: { name: string; thisWeek: ProcessBucketView } | null;
  onClose: () => void;
  onChanged: (message: string) => void;
  onOpenTask: (taskId: string) => void;
  onGoCalendar: () => void;
  onOpenGoal?: (goalId: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  const completeProject = async () => {
    if (!live) { onChanged("Project completed · demo mode"); onClose(); return; }
    await updateProject(project.id, { active: false });
    onChanged("Project marked complete");
    onClose();
  };

  return (
    <>
      <div className="gp-panel-backdrop pos-proj-detail-backdrop">
        <button className="modal-dismiss" type="button" aria-label="Close" onClick={onClose} />
        <aside className="pos-proj-detail-shell" role="dialog" aria-modal="true" aria-label={project.title}>
          <ProjectDetailView
            project={project}
            goal={goal}
            tasks={tasks}
            blocks={blocks}
            now={now}
            weekLabel={weekRangeLabel(now)}
            processThisWeek={processThisWeek}
            onBack={onClose}
            onEdit={() => setEditing(true)}
            onComplete={completeProject}
            onOpenTask={onOpenTask}
            onGoCalendar={onGoCalendar}
            onOpenGoal={onOpenGoal}
          />
        </aside>
      </div>

      {editing && (
        <ProjectEditorModal
          project={project}
          goals={goals}
          live={live}
          onClose={() => setEditing(false)}
          onSaved={(message) => { setEditing(false); onChanged(message); }}
        />
      )}
    </>
  );
}
