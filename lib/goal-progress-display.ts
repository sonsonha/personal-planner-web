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
  measurementType?: string;
  thisWeek: ProcessBucketView;
  thisMonth: ProcessBucketView;
  allTime: ProcessBucketView;
};

const PERIOD_LABEL: Record<ProgressViewPeriod, string> = {
  week: "This week",
  month: "This month",
  all: "All time",
};

const HOUR_UNITS = new Set(["h", "hr", "hrs", "hour", "hours"]);

/** Normalize process units for display. DURATION → h; COUNT/BINARY with no unit → sessions. */
export function normalizeProcessUnit(
  unit?: string | null,
  measurementType?: string | null,
): string | undefined {
  const raw = unit?.trim();
  if (raw) {
    if (HOUR_UNITS.has(raw.toLowerCase())) return "h";
    return raw;
  }
  if (measurementType === "DURATION") return "h";
  if (measurementType === "COUNT" || measurementType === "BINARY") return "sessions";
  return undefined;
}

export function isHoursProcessUnit(unit?: string | null, measurementType?: string | null) {
  return normalizeProcessUnit(unit, measurementType) === "h";
}

function formatNumber(value: number) {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 10) / 10);
}

/** Always include a unit when known — e.g. 4.8h, 120h, 2 sessions. */
export function formatProcessValue(
  value: number,
  unit?: string | null,
  measurementType?: string | null,
) {
  const normalized = normalizeProcessUnit(unit, measurementType);
  const num = formatNumber(value);
  if (!normalized) return num;
  if (normalized === "h") return `${num}h`;
  return `${num} ${normalized}`;
}

export function formatProcessRatio(
  completed: number,
  target: number,
  unit?: string | null,
  measurementType?: string | null,
) {
  return `${formatProcessValue(completed, unit, measurementType)} / ${formatProcessValue(target, unit, measurementType)}`;
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

export function processBucketCompact(
  bucket: ProcessBucketView,
  measurementType?: string | null,
) {
  const unit = bucket.unit;
  const targetLine = `${formatProcessRatio(bucket.completed, bucket.target, unit, measurementType)} target`;
  const plannedLine = bucket.planned > 0
    ? `${formatProcessValue(bucket.planned, unit, measurementType)} planned`
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
