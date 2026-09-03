export type ApiTaskStatus = "INBOX" | "SCHEDULED" | "DONE";
export type ApiPriority =
  | "LOW"
  | "NORMAL"
  | "HIGH"
  | "DROP"
  | "P1"
  | "P2"
  | "P3"
  | "P4";

export type ApiSeriesScope = "THIS_INSTANCE" | "THIS_AND_FUTURE";
export type ApiTimeBlockStatus = "PLANNED" | "DONE";
export type ApiProjectType = "STANDARD" | "HABIT";

export type ApiTask = {
  id: string;
  title: string;
  notes: string;
  projectId: string | null;
  goalId?: string | null;
  goalProcessId?: string | null;
  dueAt: string | null;
  dueHorizon?: "DAY" | "WEEK" | "MONTH" | null;
  durationMinutes: number;
  priority: ApiPriority;
  status: ApiTaskStatus;
  completedAt?: string | null;
  repeatSeriesId?: string | null;
  carryOverFromTaskId?: string | null;
  carryOverNote?: string | null;
  revision: number;
  updatedAt?: string;
};

export type GoalFocusType = "FOCUS" | "MAINTAIN" | "EXPLORE";

export type GoalMilestone = {
  id: string;
  title: string;
  status: "pending" | "current" | "done";
};

export type GoalSystem = {
  id: string;
  title: string;
  targetType?: "COUNT" | "DURATION";
  targetValue?: number;
  unit?: string | null;
  period?: "WEEK";
  durationWeeks?: number;
  startDate?: string | null;
  preferredDays?: number[] | null;
  preferredTime?: string | null;
  status?: "ACTIVE" | "PAUSED" | "COMPLETED";
  cadence?: string;
};

export type GoalProcess = {
  id: string;
  name: string;
  measurementType: "COUNT" | "DURATION" | "BINARY" | "CUSTOM_METRIC";
  targetValue: number;
  unit?: string;
  period: "DAY" | "WEEK" | "MONTH";
  active: boolean;
};

export type GoalMetricObservation = {
  id: string;
  observedAt: string;
  value: number;
  note?: string;
  label?: string;
};

export type GoalReflection = {
  seriousAttempt?: "NOT_REALLY" | "PARTLY" | "YES" | null;
  worked?: string;
  didntWork?: string;
  outsideControl?: string;
  learned?: string;
  differently?: string;
  nextAction?: "ARCHIVE" | "EXTEND" | "REVISE" | "FOLLOW_UP" | "MAINTAIN" | "STOP" | null;
  reviewedAt?: string | null;
};

export type GoalOutcomeStatus =
  | "ACTIVE"
  | "ACHIEVED_ON_TIME"
  | "ACHIEVED_LATE"
  | "PARTIALLY_ACHIEVED"
  | "NOT_ACHIEVED"
  | "STOPPED_INTENTIONALLY"
  | "NO_LONGER_RELEVANT";

export type GoalReviewSnapshot = {
  generatedAt: string;
  outcomeStatus: GoalOutcomeStatus;
  targetDate: string | null;
  achievedAt: string | null;
  processSummary: Array<{
    processId: string;
    name: string;
    completed: number;
    planned: number;
    target: number;
    unit?: string;
  }>;
  consistency: { metWeeks: number; totalWeeks: number; threshold: number };
  milestones: Array<{ id: string; title: string; status: string }>;
  latestObservation?: GoalMetricObservation | null;
};

export type ApiProject = {
  id: string;
  title: string;
  goalId: string | null;
  defaultGoalProcessId?: string | null;
  color: string;
  lifeArea?: string;
  description?: string;
  targetDate?: string | null;
  active: boolean;
  projectType?: ApiProjectType;
  revision?: number;
};

export type ApiGoal = {
  id: string;
  title: string;
  horizon: string;
  lifeArea?: string;
  status: string;
  targetDate: string | null;
  parentId: string | null;
  description?: string;
  successCriteria?: string;
  outcome?: string;
  why?: string;
  metric?: string;
  focusType?: GoalFocusType;
  outcomeStatus?: GoalOutcomeStatus;
  achievedAt?: string | null;
  closedAt?: string | null;
  currentMilestoneId?: string | null;
  milestones?: GoalMilestone[];
  systems?: GoalSystem[];
  processes?: GoalProcess[];
  metricObservations?: GoalMetricObservation[];
  reflection?: GoalReflection | null;
  reviewSnapshot?: GoalReviewSnapshot | null;
  revision?: number;
};

export type ApiGoalProgress = {
  goal: ApiGoal;
  progress: {
    processes: Array<{
      id: string;
      name: string;
      measurementType: GoalProcess["measurementType"];
      period: GoalProcess["period"];
      unit?: string;
      thisWeek: { target: number; planned: number; completed: number; unit?: string };
      thisMonth: { target: number; planned: number; completed: number; unit?: string };
      allTime: { target: number; planned: number; completed: number; unit?: string };
    }>;
    consistency: {
      threshold: number;
      weeks: Array<{ startAt: string; ratio: number; met: boolean }>;
      metWeeks: number;
      totalWeeks: number;
    };
    latestObservation: GoalMetricObservation | null;
    observationTrend: "improving" | "stable" | "declining" | "insufficient_data";
    activity: Array<{
      taskId: string;
      title: string;
      processId: string | null;
      completedAt: string | null;
      plannedMinutes: number;
    }>;
    insight: {
      processState: "none" | "low" | "mixed" | "strong";
      outcomeState: "none" | "insufficient_data" | "improving" | "stable" | "declining";
      message: string;
    };
  };
};

export type ApiTimeBlock = {
  id: string;
  taskId: string | null;
  projectId: string | null;
  title: string;
  startAt: string;
  endAt: string;
  color: string;
  ownership: "PLANNER";
  googleEventId: string | null;
  syncStatus: "PENDING" | "SYNCED" | "FAILED";
  reminderMinutes: number | null;
  notes?: string | null;
  status?: ApiTimeBlockStatus;
  completedAt?: string | null;
  repeatSeriesId?: string | null;
  revision: number;
};

export type ApiExternalEvent = {
  id: string;
  googleEventId: string | null;
  calendarId: string;
  title: string;
  startAt: string;
  endAt: string;
  location: string | null;
  ownership: "EXTERNAL";
};

export type PlannerAggregate = {
  tasks: ApiTask[];
  projects: ApiProject[];
  goals: ApiGoal[];
  timeBlocks: ApiTimeBlock[];
  externalEvents: ApiExternalEvent[];
};

export type GoogleIntegrationStatus = {
  provider: "google_calendar";
  connected: boolean;
  healthy?: boolean;
  reconnectRequired?: boolean;
  mode: "fake" | "live" | "none";
  googleAccountEmail?: string | null;
  writeCalendarId?: string | null;
  lastSyncAt: string | null;
  lastReplanAt?: string | null;
  calendarChanged?: boolean;
  lastError?: {
    code: string;
    message: string;
    googleStatus: number | null;
    at: string;
  } | null;
  lastErrorCode?: string | null;
};

export type CalendarSyncSummary = {
  fetched: number;
  upserted: number;
  removed: number;
  ownedUpdated: number;
  ownedRemoved: number;
  connected: boolean;
  retry: { attempted: number; synced: number; failed: number };
  errorCode?: string | null;
  errorMessage?: string | null;
  googleStatus?: number | null;
  reconnectRequired?: boolean;
};

export class PlannerApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as {
    error?: { code?: string; message?: string };
  } & T;
  if (!response.ok) {
    throw new PlannerApiError(
      payload.error?.message ?? "Planner request failed",
      response.status,
      payload.error?.code ?? "PLANNER_REQUEST_FAILED",
    );
  }
  return payload;
}

export function fetchPlanner(from: string, to: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ from, to });
  return requestJson<PlannerAggregate>(`/api/planner?${query}`, { signal });
}

export function createTask(input: {
  title: string;
  notes?: string;
  projectId: string | null;
  goalId?: string | null;
  goalProcessId?: string | null;
  dueAt?: string | null;
  dueHorizon?: "DAY" | "WEEK" | "MONTH" | null;
  durationMinutes: number;
  priority: ApiPriority;
}) {
  return requestJson<ApiTask>("/api/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTask(id: string, input: Partial<{
  title: string;
  notes: string;
  projectId: string | null;
  goalId: string | null;
  goalProcessId: string | null;
  dueAt: string | null;
  dueHorizon: "DAY" | "WEEK" | "MONTH" | null;
  durationMinutes: number;
  priority: ApiPriority;
  status: ApiTaskStatus;
  seriesScope: ApiSeriesScope;
  repeatSeriesId: string | null;
  carryOverFromTaskId: string | null;
  carryOverNote: string | null;
}>) {
  return requestJson<ApiTask>(
    `/api/tasks/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export function repeatTask(id: string, input: { weeks?: number; until?: string } = {}) {
  return requestJson<{
    seriesId: string;
    sourceTaskId: string;
    createdTaskIds: string[];
    weeks: number;
  }>(
    `/api/tasks/${encodeURIComponent(id)}/repeat`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function fetchTaskTimeBlocks(id: string, signal?: AbortSignal) {
  return requestJson<ApiTimeBlock[]>(
    `/api/tasks/${encodeURIComponent(id)}/time-blocks`,
    { signal },
  );
}

export function deleteTask(id: string, opts?: { seriesScope?: ApiSeriesScope }) {
  const query = opts?.seriesScope
    ? `?seriesScope=${encodeURIComponent(opts.seriesScope)}`
    : "";
  return requestJson<{
    id: string;
    deleted: true;
    removedTimeBlocks: number;
    removedTaskCount?: number;
  }>(
    `/api/tasks/${encodeURIComponent(id)}${query}`,
    { method: "DELETE" },
  );
}

export function createTimeBlock(input: {
  taskId?: string | null;
  projectId?: string | null;
  title: string;
  startAt: string;
  endAt: string;
  color?: string;
  notes?: string | null;
  status?: ApiTimeBlockStatus;
  seriesScope?: ApiSeriesScope;
}) {
  return requestJson<ApiTimeBlock>("/api/time-blocks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTimeBlock(
  id: string,
  input: Partial<{
    taskId: string | null;
    projectId: string | null;
    title: string;
    startAt: string;
    endAt: string;
    color: string;
    reminderMinutes: number | null;
    notes: string | null;
    status: ApiTimeBlockStatus;
    seriesScope: ApiSeriesScope;
  }>,
) {
  return requestJson<ApiTimeBlock>(`/api/time-blocks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function completeSession(id: string, done: boolean) {
  return requestJson<ApiTimeBlock>(
    `/api/time-blocks/${encodeURIComponent(id)}/complete`,
    { method: "POST", body: JSON.stringify({ done }) },
  );
}

export function repeatSession(id: string, input: { weeks?: number; until?: string } = {}) {
  return requestJson<{
    taskSeriesId: string;
    sessionSeriesId: string;
    sourceBlockId: string;
    createdTaskIds: string[];
    createdBlockIds: string[];
    weeks: number;
  }>(
    `/api/time-blocks/${encodeURIComponent(id)}/repeat`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function carryOverSession(id: string, targetStartAt: string) {
  return requestJson<{
    sourceTaskId: string;
    newTaskId: string;
    timeBlockId: string;
    carryOverNote: string;
  }>(
    `/api/time-blocks/${encodeURIComponent(id)}/carry-over`,
    { method: "POST", body: JSON.stringify({ targetStartAt }) },
  );
}

export function deleteTimeBlock(id: string, opts?: { seriesScope?: ApiSeriesScope }) {
  const query = opts?.seriesScope
    ? `?seriesScope=${encodeURIComponent(opts.seriesScope)}`
    : "";
  return requestJson<{ id: string; deleted: true; removedCount?: number }>(
    `/api/time-blocks/${encodeURIComponent(id)}${query}`,
    { method: "DELETE" },
  );
}

export type ApiTaskRepeatSummary = {
  seriesId: string;
  cadence: "WEEKLY";
  instanceCount: number;
  weekCount: number;
  startsAt: string | null;
  endsAt: string | null;
};

export function fetchTaskRepeatSummary(id: string) {
  return requestJson<ApiTaskRepeatSummary | null>(
    `/api/tasks/${encodeURIComponent(id)}/repeat`,
    { method: "GET" },
  );
}

export function updateTaskRepeat(
  id: string,
  input: { weeks?: number; until?: string | null; stopAfterThis?: boolean },
) {
  return requestJson<{
    seriesId: string;
    action: string;
    weekCount?: number;
    createdTaskIds?: string[];
    removed?: number;
    detached?: number;
  }>(
    `/api/tasks/${encodeURIComponent(id)}/repeat`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export function createProject(input: {
  title: string;
  goalId?: string | null;
  defaultGoalProcessId?: string | null;
  color?: string;
  lifeArea?: string;
  description?: string;
  active?: boolean;
  targetDate?: string | null;
  projectType?: ApiProjectType;
}) {
  return requestJson<ApiProject>("/api/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateProject(
  id: string,
  input: Partial<{
    title: string;
    goalId: string | null;
    defaultGoalProcessId: string | null;
    color: string;
    lifeArea: string;
    description: string;
    active: boolean;
    targetDate: string | null;
    projectType: ApiProjectType;
  }>,
) {
  return requestJson<ApiProject>(`/api/projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteProject(id: string) {
  return requestJson<{ id: string; deleted: true }>(
    `/api/projects/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export function createGoal(input: {
  title: string;
  horizon?: string;
  lifeArea?: string;
  parentId?: string | null;
  targetDate?: string | null;
  description?: string;
  successCriteria?: string;
  status?: string;
  outcome?: string;
  why?: string;
  metric?: string;
  focusType?: GoalFocusType;
  outcomeStatus?: GoalOutcomeStatus;
  achievedAt?: string | null;
  closedAt?: string | null;
  currentMilestoneId?: string | null;
  milestones?: GoalMilestone[];
  /** Dormant — web no longer sends systems on create. Kept for type compatibility. */
  systems?: GoalSystem[];
  processes?: GoalProcess[];
  metricObservations?: GoalMetricObservation[];
  reflection?: GoalReflection | null;
  reviewSnapshot?: GoalReviewSnapshot | null;
}) {
  const { systems: _systems, ...body } = input;
  return requestJson<ApiGoal>("/api/goals", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateGoal(
  id: string,
  input: Partial<{
    title: string;
    horizon: string;
    lifeArea: string;
    parentId: string | null;
    targetDate: string | null;
    description: string;
    successCriteria: string;
    status: string;
    outcome: string;
    why: string;
    metric: string;
    focusType: GoalFocusType;
    outcomeStatus: GoalOutcomeStatus;
    achievedAt: string | null;
    closedAt: string | null;
    currentMilestoneId: string | null;
    milestones: GoalMilestone[];
    /** Dormant — web no longer sends systems on update. Kept for type compatibility. */
    systems: GoalSystem[];
    processes: GoalProcess[];
    metricObservations: GoalMetricObservation[];
    reflection: GoalReflection | null;
    reviewSnapshot: GoalReviewSnapshot | null;
  }>,
) {
  const { systems: _systems, ...body } = input;
  return requestJson<ApiGoal>(`/api/goals/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function fetchGoalProgress(id: string, now?: string) {
  const query = now ? `?${new URLSearchParams({ now }).toString()}` : "";
  return requestJson<ApiGoalProgress>(`/api/goals/${encodeURIComponent(id)}/progress${query}`);
}

export function deleteGoal(id: string) {
  return requestJson<{ id: string; deleted: true }>(
    `/api/goals/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export async function fetchGoogleIntegration(signal?: AbortSignal) {
  const result = await requestJson<{ providers: GoogleIntegrationStatus[] }>(
    "/api/integrations/status",
    { signal },
  );
  return result.providers.find((provider) => provider.provider === "google_calendar") ?? null;
}

export function getGoogleAuthUrl() {
  return requestJson<{ mode: "oauth" | "fake"; url: string | null; redirectUri?: string }>(
    "/api/integrations/google/auth-url",
  );
}

export function syncGoogleCalendar() {
  return requestJson<{ ok: boolean; summary: CalendarSyncSummary }>(
    "/api/calendar/sync",
    { method: "POST", body: JSON.stringify({}) },
  );
}

export function disconnectGoogleCalendar() {
  return requestJson<{ connected: false }>(
    "/api/integrations/google",
    { method: "DELETE" },
  );
}
