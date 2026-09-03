export type ProgressViewPeriod = "week" | "month" | "all";

export type ProcessBucketView = {
  completed: number;
  target: number;
  planned: number;
  unit?: string;
};

export type ProcessSummary = {
  id: string;
  name: string;
  thisWeek: ProcessBucketView;
  thisMonth: ProcessBucketView;
  allTime: ProcessBucketView;
};

const PERIOD_LABEL: Record<ProgressViewPeriod, string> = {
  week: "This week",
  month: "This month",
  all: "All time",
};

export function formatProcessValue(value: number, unit?: string) {
  if (unit === "h") return `${value}h`;
  if (Number.isInteger(value)) return `${value}`;
  return `${Math.round(value * 10) / 10}`;
}

export function formatProcessRatio(completed: number, target: number, unit?: string) {
  const left = Number.isInteger(completed) ? String(completed) : String(Math.round(completed * 10) / 10);
  return `${left} / ${formatProcessValue(target, unit)}`;
}

export function progressPeriodLabel(period: ProgressViewPeriod) {
  return PERIOD_LABEL[period];
}

export function processBucketForPeriod(process: ProcessSummary, period: ProgressViewPeriod): ProcessBucketView {
  if (period === "month") return process.thisMonth;
  if (period === "all") return process.allTime;
  return process.thisWeek;
}

export function processOnTargetSummary(
  processes: ProcessSummary[],
  period: ProgressViewPeriod,
  threshold = 0.8,
) {
  if (processes.length === 0) return null;
  const onTarget = processes.filter((item) => {
    const bucket = processBucketForPeriod(item, period);
    return bucket.target > 0 && bucket.completed / bucket.target >= threshold;
  }).length;
  const noun = processes.length === 1 ? "process" : "processes";
  const qualifier = period === "week" ? " currently" : "";
  return `${onTarget} of ${processes.length} ${noun}${qualifier} on target`;
}

export function processBucketCompact(bucket: ProcessBucketView) {
  const targetLine = `${formatProcessRatio(bucket.completed, bucket.target, bucket.unit)} target`;
  const plannedLine = bucket.planned > 0
    ? `${formatProcessValue(bucket.planned, bucket.unit)} planned`
    : null;
  return { targetLine, plannedLine };
}

export function formatObservationEntry(obs: { observedAt: string; value: number; label?: string | null }) {
  const month = new Date(obs.observedAt).toLocaleDateString("en-US", {
    month: "long",
    timeZone: "UTC",
  });
  let detail = obs.label?.trim();
  if (detail) {
    detail = detail.replace(new RegExp(`^${month}\\s*[—–-]\\s*`, "i"), "").trim();
  } else {
    detail = String(obs.value);
  }
  return { month, detail };
}

export function isVagueGoalOutcome(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.length < 10) return true;
  const words = trimmed.split(/\s+/);
  if (words.length <= 2 && !/\d/.test(trimmed)) return true;
  if (words.length <= 5 && !/\d/.test(trimmed) && !/\b(by|before|reach|get|achieve|offer|score|job|lease|submit)\b/i.test(trimmed)) {
    return true;
  }
  return false;
}
