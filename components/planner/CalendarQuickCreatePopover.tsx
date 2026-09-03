"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { positionPopover } from "./calendar/BlockPopover";

export type QuickCreateTaskOption = {
  id: string;
  title: string;
  projectId: string | null;
  project: string;
  color: string;
  duration: number;
  status: string;
  dueHorizon?: "day" | "week" | "month" | null;
};

export type CalendarQuickCreatePopoverProps = {
  day: number;
  start: number;
  duration: number;
  slotLabel: string;
  tasks: QuickCreateTaskOption[];
  projects: Array<{ id: string | null; title: string }>;
  anchor: DOMRect;
  live: boolean;
  onClose: () => void;
  onSaveExisting: (taskId: string, note: string, duration: number) => void | Promise<void>;
  onSaveNew: (input: {
    title: string;
    projectId: string | null;
    duration: number;
    note: string;
  }) => void | Promise<void>;
  /** Called when user pastes a Session template into this draft. */
  onPasteSession?: () => void | Promise<void>;
};

export function CalendarQuickCreatePopover({
  day: _day,
  start: _start,
  duration,
  slotLabel,
  tasks,
  projects,
  anchor,
  live,
  onClose,
  onSaveExisting,
  onSaveNew,
  onPasteSession,
}: CalendarQuickCreatePopoverProps) {
  const [title, setTitle] = useState("");
  const [taskId, setTaskId] = useState("");
  const [projectId, setProjectId] = useState<string | null>(projects[0]?.id ?? null);
  const [note, setNote] = useState("");
  const [sessionDuration, setSessionDuration] = useState(duration);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const pos = useMemo(() => positionPopover(anchor, 420, 420), [anchor]);

  const openTasks = tasks.filter((task) => task.status !== "done");

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) {
        event.preventDefault();
        onClose();
        return;
      }
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const inField = tag === "input" || tag === "textarea" || target?.isContentEditable;
      if (inField) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "v" && onPasteSession) {
        event.preventDefault();
        void onPasteSession();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPasteSession, saving]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      if (taskId) {
        await onSaveExisting(taskId, note.trim(), sessionDuration);
      } else {
        if (!title.trim()) {
          setSaving(false);
          titleRef.current?.focus();
          return;
        }
        await onSaveNew({
          title: title.trim(),
          projectId,
          duration: sessionDuration,
          note: note.trim(),
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button type="button" className="pos-cal-popover-dismiss" aria-label="Close" onClick={onClose} />
      <form
        className="pos-cal-quick-create"
        role="dialog"
        aria-modal="true"
        aria-label="Add session"
        style={{ left: pos.left, top: pos.top }}
        onSubmit={(event) => { void submit(event); }}
      >
        <div className="pos-cal-quick-create-header">
          <input
            ref={titleRef}
            value={taskId ? (openTasks.find((t) => t.id === taskId)?.title ?? title) : title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (taskId) setTaskId("");
            }}
            placeholder="Add title"
            disabled={saving || Boolean(taskId)}
          />
          <button type="button" className="pos-qa-close" onClick={onClose} aria-label="Close" disabled={saving}>
            ×
          </button>
        </div>
        <p className="pos-cal-quick-create-when pos-mono">{slotLabel}</p>

        <label className="pos-cal-quick-create-field">
          <span>Task</span>
          <select
            value={taskId}
            onChange={(event) => {
              const next = event.target.value;
              setTaskId(next);
            }}
            disabled={saving}
          >
            <option value="">Create new task…</option>
            {openTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
                {task.dueHorizon ? ` · ${task.dueHorizon.toUpperCase()}` : ""}
              </option>
            ))}
          </select>
        </label>

        {!taskId && (
          <label className="pos-cal-quick-create-field">
            <span>Project</span>
            <select
              value={projectId ?? ""}
              onChange={(event) => setProjectId(event.target.value || null)}
              disabled={saving}
            >
              {projects.map((project) => (
                <option key={project.id ?? "inbox"} value={project.id ?? ""}>
                  {project.title}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="pos-cal-quick-create-field">
          <span>Session length</span>
          <select
            value={sessionDuration}
            onChange={(event) => setSessionDuration(Number(event.target.value))}
            disabled={saving}
          >
            {[15, 30, 45, 60, 90, 120].map((mins) => (
              <option key={mins} value={mins}>{mins < 60 ? `${mins} min` : `${mins / 60}h`}</option>
            ))}
          </select>
        </label>

        <label className="pos-cal-quick-create-field">
          <span>Session note</span>
          <textarea
            ref={noteRef}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            placeholder="Optional"
            disabled={saving}
          />
        </label>

        <div className="pos-cal-quick-create-footer">
          <span className="pos-muted">{live ? "" : "Demo · "}Paste with ⌘V / Ctrl+V</span>
          <button type="submit" className="pos-btn-primary" disabled={saving || (!taskId && !title.trim())}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </>
  );
}
