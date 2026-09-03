import { requestJson } from "@/lib/planner-api";

export type AiConfidence = "HIGH" | "MEDIUM" | "LOW";

export type GoalStructureSuggestion = {
  outcome?: {
    statement: string;
    confidence: AiConfidence;
  };
  metrics: Array<{
    name: string;
    metricType: "COUNT" | "DURATION" | "NUMBER" | "BOOLEAN" | "PERCENTAGE" | "CUSTOM";
    currentValue?: number | null;
    targetValue?: number | null;
    unit?: string | null;
    rationale?: string;
    confidence: AiConfidence;
    needsUserDecision?: boolean;
    possibleAlternatives?: string[];
  }>;
  milestones: Array<{
    title: string;
    description?: string;
    rationale?: string;
  }>;
  processes: Array<{
    name: string;
    metricType: "COUNT" | "DURATION";
    targetValue: number;
    period: "WEEK";
    unit?: string;
    rationale?: string;
    confidence: AiConfidence;
  }>;
  systems?: Array<{
    title: string;
    targetType: "COUNT" | "DURATION";
    targetValue: number;
    unit?: string | null;
    period: "WEEK";
    durationWeeks: number;
    startDate?: string | null;
    preferredDays?: number[] | null;
    preferredTime?: string | null;
    rationale?: string | null;
  }>;
  projects: Array<{
    title: string;
    purpose?: string;
    suggestedDefaultProcessName?: string | null;
    rationale?: string;
  }>;
  timeProtectedMinutesPerWeek?: number | null;
  nextActions: Array<{
    title: string;
    estimatedMinutes?: number | null;
    projectTitle?: string | null;
  }>;
  reviewCadence?: "WEEKLY" | "MONTHLY" | "MILESTONE";
  assumptions: string[];
  questionsForUser?: string[];
};

export function fetchAiContext() {
  return requestJson<{ aiContext: string; isDefaultSeed: boolean }>("/api/ai/context");
}

export function saveAiContext(aiContext: string) {
  return requestJson<{ aiContext: string }>("/api/ai/context", {
    method: "PUT",
    body: JSON.stringify({ aiContext }),
  });
}

export function resetAiContext() {
  return requestJson<{ aiContext: string }>("/api/ai/context/reset", {
    method: "POST",
    body: "{}",
  });
}

export function suggestGoalStructure(input: {
  title: string;
  description?: string;
  why?: string;
  targetDate?: string | null;
}) {
  return requestJson<{ suggestion: GoalStructureSuggestion }>("/api/ai/goal-structure", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function acceptGoalStructure(input: {
  title: string;
  why?: string;
  targetDate?: string | null;
  focusType?: "FOCUS" | "MAINTAIN" | "EXPLORE";
  suggestion: GoalStructureSuggestion;
  selectedNextActionIndexes?: number[];
}) {
  return requestJson<{
    goal: { id: string; title: string };
    projects: Array<{ id: string; title: string }>;
    tasks: Array<{ id: string; title: string }>;
  }>("/api/ai/goal-structure/accept", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function exportGoalStructureSuggestion(input: {
  title: string;
  why?: string;
  targetDate?: string | null;
  suggestion: GoalStructureSuggestion;
}) {
  return requestJson<{ markdown: string }>("/api/ai/goal-structure/export", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function exportGoalFullContext(goalId: string) {
  return requestJson<{ markdown: string }>(`/api/goals/${goalId}/context-export`);
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
