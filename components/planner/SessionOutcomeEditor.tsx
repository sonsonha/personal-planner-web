"use client";

import { useEffect, useState } from "react";
import { cn } from "../utils";
import {
  emptySessionOutcome,
  newChecklistItem,
  sessionOutcomeProgressLabel,
  type SessionOutcome,
  type SessionOutcomeType,
} from "@/lib/session-outcome";

const MODES: Array<{ id: SessionOutcomeType; label: string }> = [
  { id: "NONE", label: "None" },
  { id: "CHECKLIST", label: "Checklist" },
  { id: "QUANTITY", label: "Quantity" },
];

export type SessionOutcomeEditorProps = {
  value?: SessionOutcome | null;
  disabled?: boolean;
  compact?: boolean;
  onChange: (next: SessionOutcome) => void;
};

export function SessionOutcomeEditor({
  value,
  disabled = false,
  compact = false,
  onChange,
}: SessionOutcomeEditorProps) {
  const [draft, setDraft] = useState<SessionOutcome>(value ?? emptySessionOutcome());
  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    setDraft(value ?? emptySessionOutcome());
  }, [value]);

  const commit = (next: SessionOutcome) => {
    setDraft(next);
    onChange(next);
  };

  return (
    <div className={cn("pos-session-outcome", compact && "compact")}>
      <div className="pos-session-outcome-modes" role="tablist" aria-label="Outcome tracking">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            role="tab"
            aria-selected={draft.type === mode.id}
            className={cn("pos-session-outcome-mode", draft.type === mode.id && "active")}
            disabled={disabled}
            onClick={() => {
              if (mode.id === "NONE") {
                commit(emptySessionOutcome());
                return;
              }
              if (mode.id === "CHECKLIST") {
                commit({
                  ...emptySessionOutcome(),
                  type: "CHECKLIST",
                  items: draft.type === "CHECKLIST" ? draft.items : [],
                });
                return;
              }
              commit({
                ...emptySessionOutcome(),
                type: "QUANTITY",
                target: draft.type === "QUANTITY" ? (draft.target ?? 0) : 1,
                actual: draft.type === "QUANTITY" ? (draft.actual ?? 0) : 0,
                unit: draft.type === "QUANTITY" ? draft.unit : "",
              });
            }}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {draft.type === "CHECKLIST" && (
        <div className="pos-session-outcome-checklist">
          <p className="pos-session-outcome-progress pos-mono">
            {sessionOutcomeProgressLabel(draft) ?? "0 / 0"}
          </p>
          <ul>
            {draft.items.map((item) => (
              <li key={item.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={item.done}
                    disabled={disabled}
                    onChange={(event) => {
                      commit({
                        ...draft,
                        items: draft.items.map((candidate) => (
                          candidate.id === item.id
                            ? { ...candidate, done: event.target.checked }
                            : candidate
                        )),
                      });
                    }}
                  />
                  <span>{item.text}</span>
                </label>
              </li>
            ))}
          </ul>
          {!compact && (
            <div className="pos-session-outcome-add">
              <input
                value={newItem}
                disabled={disabled}
                placeholder="Add checklist item"
                onChange={(event) => setNewItem(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  const text = newItem.trim();
                  if (!text) return;
                  commit({ ...draft, items: [...draft.items, newChecklistItem(text)] });
                  setNewItem("");
                }}
              />
              <button
                type="button"
                disabled={disabled || !newItem.trim()}
                onClick={() => {
                  const text = newItem.trim();
                  if (!text) return;
                  commit({ ...draft, items: [...draft.items, newChecklistItem(text)] });
                  setNewItem("");
                }}
              >
                Add
              </button>
            </div>
          )}
        </div>
      )}

      {draft.type === "QUANTITY" && (
        <div className="pos-session-outcome-quantity">
          <label>
            <span>Actual</span>
            <input
              type="number"
              min={0}
              value={draft.actual ?? 0}
              disabled={disabled}
              onChange={(event) => {
                commit({
                  ...draft,
                  actual: Math.max(0, Math.floor(Number(event.target.value) || 0)),
                });
              }}
            />
          </label>
          <label>
            <span>Target</span>
            <input
              type="number"
              min={0}
              value={draft.target ?? 0}
              disabled={disabled}
              onChange={(event) => {
                commit({
                  ...draft,
                  target: Math.max(0, Math.floor(Number(event.target.value) || 0)),
                });
              }}
            />
          </label>
          {!compact && (
            <label>
              <span>Unit</span>
              <input
                value={draft.unit ?? ""}
                disabled={disabled}
                placeholder="applications"
                onChange={(event) => commit({ ...draft, unit: event.target.value })}
              />
            </label>
          )}
          <p className="pos-session-outcome-progress pos-mono">
            {sessionOutcomeProgressLabel(draft)}
          </p>
        </div>
      )}
    </div>
  );
}
