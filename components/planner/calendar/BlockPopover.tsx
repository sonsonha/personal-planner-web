"use client";

import { useEffect, useState } from "react";
import { cn } from "../utils";
import { isSessionDone } from "@/lib/session-evidence";

export type CalendarPopoverBlock = {
  id: string;
  title: string;
  meta?: string;
  type: "task" | "external";
  start: number;
  duration: number;
  syncStatus?: "PENDING" | "SYNCED" | "FAILED";
  taskId?: string;
  notes?: string | null;
  status?: string | null;
  repeatSeriesId?: string | null;
};

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const twelve = hours % 12 || 12;
  return mins === 0
    ? `${twelve} ${suffix}`
    : `${twelve}:${String(mins).padStart(2, "0")} ${suffix}`;
}

function formatRange(start: number, duration: number) {
  return `${formatMinutes(start)} – ${formatMinutes(start + duration)}`;
}

type PopoverShellProps = {
  left: number;
  top: number;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
};

function PopoverShell({ left, top, onClose, children, className }: PopoverShellProps) {
  return (
    <>
      <button type="button" className="pos-cal-popover-dismiss" aria-label="Close" onClick={onClose} />
      <div
        className={cn("pos-cal-popover", className)}
        role="dialog"
        aria-modal="true"
        style={{ left, top }}
      >
        {children}
      </div>
    </>
  );
}

export function positionPopover(anchor: DOMRect, width = 260, height = 380) {
  const left = Math.min(anchor.right + 8, Math.max(12, window.innerWidth - width - 12));
  const top = Math.min(anchor.top, Math.max(12, window.innerHeight - height - 12));
  return { left, top };
}

export type PersonalOsBlockPopoverProps = {
  block: CalendarPopoverBlock;
  /** Session done (block.status), not only task done. */
  sessionDone: boolean;
  anchor: DOMRect;
  saving?: boolean;
  onClose: () => void;
  onSaveNotes: (notes: string) => void;
  onRepeatSession?: (weeks: number) => void;
  onUnschedule: () => void;
  onRetrySync?: () => void;
};

export function PersonalOsBlockPopover({
  block,
  sessionDone,
  anchor,
  saving = false,
  onClose,
  onSaveNotes,
  onRepeatSession,
  onUnschedule,
  onRetrySync,
}: PersonalOsBlockPopoverProps) {
  const { left, top } = positionPopover(anchor);
  const failed = block.syncStatus === "FAILED";
  const [notes, setNotes] = useState(block.notes ?? "");
  const [repeatWeeks, setRepeatWeeks] = useState("8");
  const [showRepeat, setShowRepeat] = useState(false);

  useEffect(() => {
    setNotes(block.notes ?? "");
  }, [block.id, block.notes]);

  return (
    <PopoverShell left={left} top={top} onClose={onClose}>
      <div className="pos-cal-popover-head">
        <p className="pos-cal-popover-title">{block.title}</p>
        {block.meta && <p className="pos-cal-popover-sub">{block.meta}</p>}
        <p className="pos-cal-popover-time pos-mono">{formatRange(block.start, block.duration)}</p>
        {sessionDone && <p className="pos-cal-popover-sub">Session done</p>}
        {failed && (
          <div className="pos-cal-popover-sync-fail" role="status">
            <strong>Saved locally · Google sync failed</strong>
            <span>This block is still on your Personal OS calendar.</span>
          </div>
        )}
      </div>

      <div className="pos-cal-popover-actions">
        <label className="pos-cal-popover-notes">
          <span>Session note</span>
          <textarea
            value={notes}
            rows={2}
            disabled={saving}
            placeholder="What happened in this session…"
            onChange={(event) => setNotes(event.target.value)}
            onBlur={() => {
              if ((block.notes ?? "") !== notes) onSaveNotes(notes);
            }}
          />
        </label>

        {failed && onRetrySync && (
          <button type="button" className="pos-cal-popover-action amber" onClick={() => { onRetrySync(); onClose(); }}>
            Retry sync
          </button>
        )}

        {onRepeatSession && !block.repeatSeriesId && (
          showRepeat ? (
            <div className="pos-cal-popover-repeat">
              <label>
                <span>Repeat weekly for</span>
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={repeatWeeks}
                  disabled={saving}
                  onChange={(event) => setRepeatWeeks(event.target.value)}
                />
                <span>weeks</span>
              </label>
              <button
                type="button"
                className="pos-cal-popover-action"
                disabled={saving}
                onClick={() => {
                  const weeks = Math.max(1, Math.min(52, Number(repeatWeeks) || 8));
                  onRepeatSession(weeks);
                  onClose();
                }}
              >
                Create repeats
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="pos-cal-popover-action"
              disabled={saving}
              onClick={() => setShowRepeat(true)}
            >
              <span>Repeat session</span>
              <small>Copy this session into future weeks</small>
            </button>
          )
        )}

        <div className="pos-cal-popover-divider" />
        <button type="button" className="pos-cal-popover-action muted" onClick={() => { onUnschedule(); onClose(); }}>
          <span>Remove session</span>
          <small>Drop this TimeBlock · keep the Task</small>
        </button>
      </div>
    </PopoverShell>
  );
}

export type GoogleEventPopoverProps = {
  block: CalendarPopoverBlock;
  anchor: DOMRect;
  onClose: () => void;
};

export function GoogleEventPopover({ block, anchor, onClose }: GoogleEventPopoverProps) {
  const { left, top } = positionPopover(anchor, 220, 160);
  return (
    <PopoverShell left={left} top={top} onClose={onClose} className="google">
      <div className="pos-cal-popover-head">
        <p className="pos-cal-popover-title">{block.title}</p>
        <p className="pos-cal-popover-sub">{block.meta ?? "Google Calendar"}</p>
        <p className="pos-cal-popover-time pos-mono">{formatRange(block.start, block.duration)}</p>
      </div>
      <div className="pos-cal-popover-readonly">
        <svg width="10" height="11" viewBox="0 0 10 11" fill="none" aria-hidden="true">
          <rect x="0.5" y="4.5" width="9" height="6" rx="1" stroke="currentColor" strokeWidth="1" />
          <path d="M2.5 4.5V3a2.5 2.5 0 015 0v1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </svg>
        <span>Read-only external event</span>
      </div>
    </PopoverShell>
  );
}

/** @deprecated Prefer sessionDone from block.status */
export function isBlockSessionDone(block: { status?: string | null }) {
  return isSessionDone(block.status);
}
