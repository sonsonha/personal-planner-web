export type CalendarUiState =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "SYNCING"
  | "SYNCED"
  | "SYNC_FAILED"
  | "RECONNECT_REQUIRED"
  | "ACCOUNT_MISMATCH";

export function calendarErrorCopy(code: string | null | undefined): string {
  switch (code) {
    case "GOOGLE_RECONNECT_REQUIRED":
    case "reconnect_required":
      return "Google Calendar needs to be reconnected.";
    case "GOOGLE_ACCOUNT_MISMATCH":
    case "account_mismatch":
      return "Connect the same Google account you use to sign in to Personal OS.";
    case "identity_unavailable":
    case "CALENDAR_IDENTITY_UNAVAILABLE":
      return "Could not verify the Google account for Calendar. Try Connect again.";
    case "missing_refresh_token":
    case "MISSING_REFRESH_TOKEN":
      return "Google did not grant offline Calendar access. Reconnect and approve all permissions.";
    case "insufficient_scopes":
    case "GOOGLE_FORBIDDEN":
      return "Personal OS does not have the required Calendar permission.";
    case "GOOGLE_UPSTREAM_ERROR":
      return "Google Calendar is temporarily unavailable.";
    default:
      return "Google Calendar needs attention.";
  }
}

export function statusLabel(state: CalendarUiState): string {
  switch (state) {
    case "DISCONNECTED":
      return "Not connected";
    case "CONNECTING":
      return "Connecting…";
    case "CONNECTED":
      return "Connected";
    case "SYNCING":
      return "Syncing…";
    case "SYNCED":
      return "Synced";
    case "SYNC_FAILED":
      return "Sync needs attention";
    case "RECONNECT_REQUIRED":
      return "Reconnect required";
    case "ACCOUNT_MISMATCH":
      return "Wrong Google account";
    default:
      return "Unknown";
  }
}

export function formatLastSynced(iso: string | null, nowMs = Date.now()): string | null {
  if (!iso) return null;
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return null;
  const deltaSec = Math.max(0, Math.round((nowMs - at) / 1000));
  if (deltaSec < 60) return "Last synced just now";
  const mins = Math.round(deltaSec / 60);
  if (mins < 60) return `Last synced ${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `Last synced ${hours}h ago`;
  return `Last synced ${new Date(iso).toLocaleString()}`;
}
