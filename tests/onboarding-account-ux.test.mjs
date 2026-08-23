import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  captureReturnPath,
  consumeReturnPath,
  isAllowlistedReturnPath,
} from "../lib/auth-return.ts";
import {
  calendarErrorCopy,
  formatLastSynced,
  statusLabel,
} from "../lib/calendar-integration-copy.ts";

describe("auth return path allowlist", () => {
  it("accepts planner routes only", () => {
    assert.equal(isAllowlistedReturnPath("/calendar"), true);
    assert.equal(isAllowlistedReturnPath("/goals/abc"), true);
    assert.equal(isAllowlistedReturnPath("/tasks"), true);
    assert.equal(isAllowlistedReturnPath("https://evil.example/calendar"), false);
    assert.equal(isAllowlistedReturnPath("//evil.example"), false);
    assert.equal(isAllowlistedReturnPath("/login"), false);
  });

  it("stores and consumes safe return paths", () => {
    captureReturnPath("/projects/p1");
    assert.equal(consumeReturnPath("/calendar"), "/projects/p1");
    assert.equal(consumeReturnPath("/calendar"), "/calendar");
  });
});

describe("calendar integration copy", () => {
  it("maps backend codes to user-facing text", () => {
    assert.match(calendarErrorCopy("GOOGLE_RECONNECT_REQUIRED"), /reconnected/i);
    assert.match(calendarErrorCopy("account_mismatch"), /same Google account/i);
    assert.match(calendarErrorCopy("GOOGLE_FORBIDDEN"), /permission/i);
    assert.match(calendarErrorCopy("missing_refresh_token"), /offline/i);
    assert.match(calendarErrorCopy("GOOGLE_UPSTREAM_ERROR"), /unavailable/i);
  });

  it("labels UI states without raw codes", () => {
    assert.equal(statusLabel("DISCONNECTED"), "Not connected");
    assert.equal(statusLabel("SYNCED"), "Synced");
    assert.equal(statusLabel("SYNC_FAILED"), "Sync needs attention");
    assert.equal(statusLabel("RECONNECT_REQUIRED"), "Reconnect required");
    assert.equal(statusLabel("ACCOUNT_MISMATCH"), "Wrong Google account");
  });

  it("formats last sync relative time from real timestamps", () => {
    const now = Date.parse("2026-08-23T12:00:00.000Z");
    assert.equal(
      formatLastSynced("2026-08-23T11:56:00.000Z", now),
      "Last synced 4 min ago",
    );
  });
});
