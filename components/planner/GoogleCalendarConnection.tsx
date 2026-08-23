"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  calendarErrorCopy,
  formatLastSynced,
  statusLabel,
  type CalendarUiState,
} from "@/lib/calendar-integration-copy";

export type { CalendarUiState };
export { calendarErrorCopy, statusLabel };

type GoogleCalendarConnectionProps = {
  state: CalendarUiState;
  email: string | null;
  lastSyncAt: string | null;
  errorCode?: string | null;
  syncDisabled?: boolean;
  compact?: boolean;
  onConnect: () => void;
  onSync: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
};

export function GoogleCalendarConnection({
  state,
  email,
  lastSyncAt,
  errorCode,
  syncDisabled,
  compact,
  onConnect,
  onSync,
  onReconnect,
  onDisconnect,
}: GoogleCalendarConnectionProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (confirmDisconnect && !dialog.open) dialog.showModal();
    if (!confirmDisconnect && dialog.open) dialog.close();
  }, [confirmDisconnect]);

  const label = statusLabel(state);
  const lastSynced = formatLastSynced(lastSyncAt);
  const detail =
    state === "ACCOUNT_MISMATCH" || state === "SYNC_FAILED" || state === "RECONNECT_REQUIRED"
      ? calendarErrorCopy(
        errorCode
          ?? (state === "ACCOUNT_MISMATCH"
            ? "account_mismatch"
            : state === "RECONNECT_REQUIRED"
              ? "GOOGLE_RECONNECT_REQUIRED"
              : null),
      )
      : null;

  const connectedish =
    state === "CONNECTED"
    || state === "SYNCING"
    || state === "SYNCED"
    || state === "SYNC_FAILED"
    || state === "RECONNECT_REQUIRED";

  return (
    <div className={compact ? "pos-gcal-conn pos-gcal-conn-compact" : "pos-gcal-conn"}>
      <div className="pos-gcal-conn-head">
        <span className="pos-gcal-conn-title">Google Calendar</span>
        <span className={`pos-gcal-conn-status pos-gcal-conn-${state.toLowerCase()}`}>
          <i className="pos-gcal-conn-dot" aria-hidden />
          {label}
        </span>
      </div>

      {email && connectedish ? (
        <p className="pos-gcal-conn-email">{email}</p>
      ) : null}
      {lastSynced && (state === "SYNCED" || state === "CONNECTED") ? (
        <p className="pos-gcal-conn-meta">{lastSynced}</p>
      ) : null}
      {detail ? (
        <p className="pos-gcal-conn-detail" role="status">
          {detail}
        </p>
      ) : null}
      {state === "SYNCED" || state === "CONNECTED" ? (
        <p className="pos-gcal-conn-hint">
          Scheduled Personal OS work is added to your Personal OS calendar.
        </p>
      ) : null}

      <div className="pos-gcal-conn-actions">
        {state === "DISCONNECTED" || state === "ACCOUNT_MISMATCH" ? (
          <button type="button" className="pos-btn-primary pos-btn-sm" onClick={onConnect}>
            {state === "ACCOUNT_MISMATCH" ? "Try again" : "Connect"}
          </button>
        ) : null}
        {state === "CONNECTING" ? (
          <button type="button" className="pos-btn-primary pos-btn-sm" disabled>
            Connecting…
          </button>
        ) : null}
        {state === "RECONNECT_REQUIRED" ? (
          <button type="button" className="pos-btn-primary pos-btn-sm" onClick={onReconnect}>
            Reconnect
          </button>
        ) : null}
        {state === "SYNC_FAILED" ? (
          <button
            type="button"
            className="pos-btn-primary pos-btn-sm"
            disabled={syncDisabled}
            onClick={onSync}
          >
            Retry sync
          </button>
        ) : null}
        {(state === "SYNCED" || state === "CONNECTED" || state === "SYNCING") ? (
          <button
            type="button"
            className="pos-btn-secondary pos-btn-sm"
            disabled={syncDisabled || state === "SYNCING"}
            onClick={onSync}
          >
            {state === "SYNCING" ? "Syncing…" : "Sync now"}
          </button>
        ) : null}

        {connectedish ? (
          <div className="pos-gcal-conn-more">
            <button
              type="button"
              className="icon-button"
              aria-label="More Google Calendar options"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              ⋯
            </button>
            {menuOpen ? (
              <div className="pos-account-menu" role="menu">
                {state !== "RECONNECT_REQUIRED" ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onReconnect();
                    }}
                  >
                    Reconnect
                  </button>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmDisconnect(true);
                  }}
                >
                  Disconnect
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <dialog
        ref={dialogRef}
        className="pos-confirm-dialog"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClose={() => setConfirmDisconnect(false)}
        onCancel={(event) => {
          event.preventDefault();
          setConfirmDisconnect(false);
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) setConfirmDisconnect(false);
        }}
      >
        <form
          method="dialog"
          className="pos-confirm-dialog-body"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <h2 id={titleId}>Disconnect Google Calendar?</h2>
          <p id={descId}>
            Personal OS will stop syncing Google events. Your Goals, Projects, Tasks and
            scheduled Personal OS work will remain. Existing events previously created in
            Google Calendar will not be deleted.
          </p>
          <div className="pos-confirm-dialog-actions">
            <button
              type="button"
              className="pos-btn-secondary"
              onClick={() => setConfirmDisconnect(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="pos-btn-danger"
              onClick={() => {
                setConfirmDisconnect(false);
                onDisconnect();
              }}
            >
              Disconnect
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
