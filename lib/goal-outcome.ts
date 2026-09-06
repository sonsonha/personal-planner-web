import type { ApiGoal, ApiGoalProgress } from "@/lib/planner-api";

const OUTCOME_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  ACHIEVED_ON_TIME: "Achieved on time",
  ACHIEVED_LATE: "Achieved late",
  PARTIALLY_ACHIEVED: "Partially achieved",
  NOT_ACHIEVED: "Not achieved by target date",
  STOPPED_INTENTIONALLY: "Stopped intentionally",
  NO_LONGER_RELEVANT: "No longer relevant",
};

function extractMetricCandidates(text: string): number[] {
  const cleaned = text
    .replace(/\b20\d{2}[-/.]\d{1,2}([-/.]\d{1,2})?\b/g, " ")
    .replace(/\b(19|20)\d{2}\b/g, " ");
  return [...cleaned.matchAll(/(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1]));
}

/** Finance freshness / stale-threshold text is not an outcome target. */
export function isTrackingStatusMetric(goal: ApiGoal): boolean {
  const text = `${goal.metric ?? ""} ${goal.outcome ?? ""} ${goal.title}`.toLowerCase();
  return /freshness|stale threshold|tracking status|integration pending|lastfinanceactivity|finance tracking/.test(text)
    && !/offer|ielts|band|signed/.test(text);
}

/**
 * Prefer an explicit "Target: N" line. Never treat "Current: 0" as the outcome target
 * (AI structure used to format metric text with both Current and Target).
 */
export function parseTargetNumber(goal: ApiGoal): number | null {
  if (isTrackingStatusMetric(goal)) return null;

  const metricText = goal.metric ?? "";
  const targetLine = metricText.match(/target\s*[:=]?\s*>=?\s*(\d+(?:\.\d+)?)/i);
  if (targetLine) {
    const n = Number(targetLine[1]);
    if (Number.isFinite(n)) return n;
  }

  const metric = metricText.toLowerCase();
  if (metric.includes("offer")) {
    const withoutCurrent = metricText.replace(/current\s*[:=][^\n]*/gi, " ");
    const fromMetric = extractMetricCandidates(withoutCurrent);
    const positive = fromMetric.find((n) => n > 0);
    if (positive != null) return positive;
    return 1;
  }

  const preferBand = /band|ielts|score|gpa|level/.test(
    `${goal.metric ?? ""} ${goal.outcome ?? ""} ${goal.title}`.toLowerCase(),
  );

  const sources = [
    metricText.replace(/current\s*[:=][^\n]*/gi, " "),
    goal.outcome,
    goal.title,
  ];
  for (const source of sources) {
    if (!source?.trim()) continue;
    const numbers = extractMetricCandidates(source);
    if (!numbers.length) continue;
    if (preferBand) {
      const band = numbers.find((n) => n > 0 && n <= 9.5);
      if (band != null) return band;
    }
    const positive = numbers.find((n) => n > 0);
    if (positive != null) return positive;
    return numbers[0]!;
  }
  return null;
}

/** Rewrite or append the Target line in a free-text metric definition. */
export function withMetricTarget(metric: string, target: number, unitHint?: string | null): string {
  const unit = unitHint?.trim() ? ` ${unitHint.trim()}` : "";
  const line = `Target: ${target}${unit}`;
  if (/target\s*:/i.test(metric)) {
    return metric.replace(/target\s*:[^\n]*/i, line).trim();
  }
  const base = metric.trim();
  return base ? `${base}\n${line}` : line;
}

export type OutcomeSnapshot = {
  line: string | null;
  current: number | null;
  target: number | null;
  metricMet: boolean;
  formallyAchieved: boolean;
  achieved: boolean;
  statusLabel: string;
};

function isBandLikeGoal(goal: ApiGoal): boolean {
  return /band|ielts|score|gpa|level/.test(
    `${goal.metric ?? ""} ${goal.outcome ?? ""} ${goal.title}`.toLowerCase(),
  );
}

function formatTargetDisplay(goal: ApiGoal, target: number): string {
  if (isBandLikeGoal(goal) && target > 0 && target <= 9.5) {
    return target.toFixed(1);
  }
  return Number.isInteger(target) ? String(target) : String(target);
}

function formatCurrentDisplay(goal: ApiGoal, current: number): string {
  if (isBandLikeGoal(goal) && current >= 0 && current <= 9.5) {
    return Number.isInteger(current) ? current.toFixed(1) : String(current);
  }
  return String(current);
}

export function getOutcomeSnapshot(goal: ApiGoal, progress?: ApiGoalProgress | null): OutcomeSnapshot {
  const latest = progress?.progress.latestObservation
    ?? [...(goal.metricObservations ?? [])].sort((a, b) => a.observedAt.localeCompare(b.observedAt)).at(-1)
    ?? null;
  const trackingStatus = isTrackingStatusMetric(goal);
  const target = trackingStatus ? null : parseTargetNumber(goal);
  const current = latest?.value ?? null;
  const metric = (goal.metric ?? "").toLowerCase();
  const formallyAchieved =
    goal.outcomeStatus === "ACHIEVED_ON_TIME"
    || goal.outcomeStatus === "ACHIEVED_LATE"
    || goal.status === "COMPLETED";
  const metricMet = current != null && target != null && current >= target;
  const achieved = formallyAchieved || metricMet;

  let line: string | null = null;
  if (trackingStatus) {
    line = "Integration pending";
  } else if (metric.includes("offer")) {
    // Job Goal: signed-offer count may legitimately start at 0.
    line = `${current ?? 0} / ${target && target > 0 ? formatTargetDisplay(goal, target) : "1"} offers`;
  } else if (current != null && target != null) {
    line = `${formatCurrentDisplay(goal, current)} / ${formatTargetDisplay(goal, target)}`;
  } else if (target != null && current == null) {
    // Unknown baseline — never invent 0 (IELTS etc.).
    line = `— / ${formatTargetDisplay(goal, target)}`;
  } else if (current != null) {
    line = formatCurrentDisplay(goal, current);
  }

  let statusLabel = OUTCOME_STATUS_LABEL[goal.outcomeStatus ?? "ACTIVE"] ?? "Active";
  if (goal.outcomeStatus && goal.outcomeStatus !== "ACTIVE") {
    statusLabel = OUTCOME_STATUS_LABEL[goal.outcomeStatus] ?? statusLabel;
  } else if (metricMet) {
    statusLabel = "Outcome met";
  } else if (goal.status === "COMPLETED") {
    statusLabel = "Achieved";
  }

  return { line, current, target, metricMet, formallyAchieved, achieved, statusLabel };
}

export function outcomeLine(goal: ApiGoal, progress?: ApiGoalProgress | null) {
  return getOutcomeSnapshot(goal, progress).line;
}

export function isOutcomeAchieved(goal: ApiGoal, progress?: ApiGoalProgress | null) {
  return getOutcomeSnapshot(goal, progress).achieved;
}
