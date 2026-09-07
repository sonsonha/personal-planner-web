"use client";

import { useEffect, useState } from "react";
import { cn } from "../utils";
import { isSessionDone } from "@/lib/session-evidence";
import {
  type ClockFormat,
  formatMinuteRange,
} from "@/lib/clock-format";
import { SessionOutcomeEditor } from "../SessionOutcomeEditor";
import {
  emptySessionOutcome,
  sessionOutcomeProgressLabel,
  type SessionOutcome,
} from "@/lib/session-outcome";

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
  sessionOutcome?: SessionOutcome | null;
  isDailyFocus?: boolean;
};

function formatRange(start: number, duration: number, format: ClockFormat = "24h") {
  return formatMinuteRange(start, duration, format);
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

export function positionPopover(anchor: DOMRect, width = 400, height = 480) {
  const left = Math.min(anchor.right + 8, Math.max(12, window.innerWidth - width - 12));
  const top = Math.min(anchor.top, Math.max(12, window.innerHeight - height - 12));
  return { left, top };
}

export type PersonalOsBlockPopoverProps = {
  block: CalendarPopoverBlock;
  sessionDone: boolean;
  anchor: DOMRect;
  clockFormat?: ClockFormat;
  saving?: boolean;
  onClose: () => void;
  onSaveNotes: (notes: string) => void;
  onSaveOutcome?: (outcome: SessionOutcome) => void;
  onRepeatSession?: (weeks: number) => void;
  onUnschedule: () => void;
  onRetrySync?: () => void;
};

export function PersonalOsBlockPopover({
  block,
  sessionDone,
  anchor,
  clockFormat = "24h",
  saving = false,
  onClose,
  onSaveNotes,
  onSaveOutcome,
  onRepeatSession,
  onUnschedule,
  onRetrySync,
}: PersonalOsBlockPopoverProps) {
  const { left, top } = positionPopover(anchor);
  const failed = block.syncStatus === "FAILED";
  const [notes, setNotes] = useState(block.notes ?? "");
  const [repeatWeeks, setRepeatWeeks] = useState("8");
  const [showRepeat, setShowRepeat] = useState(false);
  const outcome = block.sessionOutcome ?? emptySessionOutcome();
  const progress = sessionOutcomeProgressLabel(outcome);
  const isDailyFocus = Boolean(block.isDailyFocus);

  useEffect(() => {
    setNotes(block.notes ?? "");
  }, [block.id, block.notes]);

  return (
    <PopoverShell left={left} top={top} onClose={onClose}>
      <header className="pos-cal-popover-head">
        <div className="pos-cal-popover-title-row">
          <p className="pos-cal-popover-title">{block.title}</p>
          {isDailyFocus && (
            <span className="pos-cal-popover-focus" title="Daily Focus">
              ★ Focus
            </span>
          )}
        </div>
        <div className="pos-cal-popover-meta">
          {block.meta && <span>{block.meta}</span>}
          {block.meta && <span className="pos-cal-popover-meta-sep" aria-hidden="true">·</span>}
          <span className="pos-mono">{formatRange(block.start, block.duration, clockFormat)}</span>
          {sessionDone && (
            <>
              <span className="pos-cal-popover-meta-sep" aria-hidden="true">·</span>
              <span className="pos-cal-popover-done">Done</span>
            </>
          )}
        </div>
        {progress && (
          <p className="pos-cal-popover-progress pos-mono">{progress}</p>
        )}
        {failed && (
          <div className="pos-cal-popover-sync-fail" role="status">
            <strong>Saved locally · Google sync failed</strong>
            <span>This block is still on your Personal OS calendar.</span>
          </div>
        )}
      </header>

      <div className="pos-cal-popover-body">
        <section className="pos-cal-popover-section">
          <label className="pos-cal-popover-notes">
            <span className="pos-cal-popover-section-label">Session note</span>
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
        </section>

        {onSaveOutcome && (
          <section className="pos-cal-popover-section pos-cal-popover-outcome">
            <span className="pos-cal-popover-section-label">Outcome</span>
            <SessionOutcomeEditor
              value={outcome}
              disabled={saving}
              compact
              onChange={onSaveOutcome}
            />
          </section>
        )}

        {failed && onRetrySync && (
          <section className="pos-cal-popover-section">
            <button
              type="button"
              className="pos-cal-popover-action amber"
              onClick={() => { onRetrySync(); onClose(); }}
            >
              Retry sync
            </button>
          </section>
        )}

        <section className="pos-cal-popover-section pos-cal-popover-more">
          <details className="pos-cal-popover-more-details">
            <summary className="pos-cal-popover-more-summary">More actions</summary>
            <div className="pos-cal-popover-more-body">
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

              <button
                type="button"
                className="pos-cal-popover-action destructive"
                onClick={() => { onUnschedule(); onClose(); }}
              >
                <span>Remove session</span>
                <small>Drop this TimeBlock · keep the Task</small>
              </button>
            </div>
          </details>
        </section>
      </div>
    </PopoverShell>
  );
}

export type GoogleEventPopoverProps = {
  block: CalendarPopoverBlock;
  anchor: DOMRect;
  clockFormat?: ClockFormat;
  onClose: () => void;
};

export function GoogleEventPopover({ block, anchor, clockFormat = "24h", onClose }: GoogleEventPopoverProps) {
  const { left, top } = positionPopover(anchor, 280, 160);
  return (
    <PopoverShell left={left} top={top} onClose={onClose} className="google">
      <header className="pos-cal-popover-head">
        <p className="pos-cal-popover-title">{block.title}</p>
        <div className="pos-cal-popover-meta">
          <span>{block.meta ?? "Google Calendar"}</span>
          <span className="pos-cal-popover-meta-sep" aria-hidden="true">·</span>
          <span className="pos-mono">{formatRange(block.start, block.duration, clockFormat)}</span>
        </div>
      </header>
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
