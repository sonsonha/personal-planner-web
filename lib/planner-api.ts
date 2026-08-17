export type ApiTaskStatus = "INBOX" | "SCHEDULED" | "DONE";
export type ApiPriority = "LOW" | "NORMAL" | "HIGH";

export type ApiTask = {
  id: string;
  title: string;
  notes: string;
  projectId: string | null;
  dueAt: string | null;
  durationMinutes: number;
  priority: ApiPriority;
  status: ApiTaskStatus;
  revision: number;
};

export type ApiProject = {
  id: string;
  title: string;
  goalId: string | null;
  color: string;
  active: boolean;
};

export type ApiGoal = {
  id: string;
  title: string;
  horizon: string;
  status: string;
  targetDate: string | null;
  parentId: string | null;
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
  mode: "fake" | "live" | "none";
  lastSyncAt: string | null;
  lastReplanAt: string | null;
  calendarChanged: boolean;
};

export type CalendarSyncSummary = {
  fetched: number;
  upserted: number;
  removed: number;
  ownedUpdated: number;
  ownedRemoved: number;
  connected: boolean;
  retry: { attempted: number; synced: number; failed: number };
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

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
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
  dueAt?: string | null;
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
  dueAt: string | null;
  durationMinutes: number;
  priority: ApiPriority;
  status: ApiTaskStatus;
}>) {
  return requestJson<ApiTask>(
    `/api/tasks/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export function fetchTaskTimeBlocks(id: string, signal?: AbortSignal) {
  return requestJson<ApiTimeBlock[]>(
    `/api/tasks/${encodeURIComponent(id)}/time-blocks`,
    { signal },
  );
}

export function deleteTask(id: string) {
  return requestJson<{ id: string; deleted: true; removedTimeBlocks: number }>(
    `/api/tasks/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export function createTimeBlock(input: {
  taskId: string | null;
  projectId: string | null;
  title: string;
  startAt: string;
  endAt: string;
  color: string;
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
  }>,
) {
  return requestJson<ApiTimeBlock>(`/api/time-blocks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteTimeBlock(id: string) {
  return requestJson<{ id: string; deleted: true }>(
    `/api/time-blocks/${encodeURIComponent(id)}`,
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
  return requestJson<{ ok: true; summary: CalendarSyncSummary }>(
    "/api/calendar/sync",
    { method: "POST", body: JSON.stringify({}) },
  );
}
