/** Client-side Session Outcome helpers (mirrors backend domain). */

export type SessionOutcomeType = "NONE" | "CHECKLIST" | "QUANTITY";

export type SessionOutcomeChecklistItem = {
  id: string;
  text: string;
  done: boolean;
};

export type SessionOutcome = {
  type: SessionOutcomeType;
  items: SessionOutcomeChecklistItem[];
  target: number | null;
  actual: number | null;
  unit: string | null;
  completedCount?: number;
  totalCount?: number;
  progressLabel?: string | null;
};

export function emptySessionOutcome(): SessionOutcome {
  return {
    type: "NONE",
    items: [],
    target: null,
    actual: null,
    unit: null,
    completedCount: 0,
    totalCount: 0,
    progressLabel: null,
  };
}

export function sessionOutcomeProgressLabel(outcome?: SessionOutcome | null): string | null {
  if (!outcome || outcome.type === "NONE") return null;
  if (outcome.progressLabel) return outcome.progressLabel;
  if (outcome.type === "CHECKLIST") {
    const total = outcome.items.length;
    if (!total) return null;
    const done = outcome.items.filter((item) => item.done).length;
    return `${done} / ${total}`;
  }
  const target = outcome.target ?? 0;
  const actual = outcome.actual ?? 0;
  const unit = outcome.unit ? ` ${outcome.unit}` : "";
  return `${actual} / ${target}${unit}`;
}

/** Copy outcome structure for a new week; clear progress (actual / checklist ticks). */
export function resetSessionOutcomeForPaste(outcome?: SessionOutcome | null): SessionOutcome | null {
  if (!outcome || outcome.type === "NONE") return null;
  if (outcome.type === "CHECKLIST") {
    return {
      type: "CHECKLIST",
      items: outcome.items.map((item) => ({ ...item, done: false })),
      target: null,
      actual: null,
      unit: null,
    };
  }
  return {
    type: "QUANTITY",
    items: [],
    target: outcome.target ?? 0,
    actual: 0,
    unit: outcome.unit ?? null,
  };
}

export function newChecklistItem(text: string): SessionOutcomeChecklistItem {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return { id, text, done: false };
}
