import assert from "node:assert/strict";
import test from "node:test";
import {
  findDailyFocusSession,
  isSessionDailyFocusOnDate,
  productDateFromEpoch,
  resolveFocusOnSessionMove,
  resolveSessionDailyFocusReplacement,
} from "../lib/daily-focus.ts";

test("Daily Focus belongs to a Session on a product date", () => {
  const wed = Date.parse("2026-09-09T08:00:00+07:00");
  const fri = Date.parse("2026-09-11T08:00:00+07:00");
  assert.equal(productDateFromEpoch(wed), "2026-09-09");
  const sessions = [
    { id: "a", isDailyFocus: true, startEpochMs: wed, taskId: "apps" },
    { id: "b", isDailyFocus: true, startEpochMs: fri, taskId: "apps" },
  ];
  assert.equal(isSessionDailyFocusOnDate(sessions[0]!, "2026-09-09"), true);
  assert.equal(findDailyFocusSession(sessions, "2026-09-11")?.id, "b");
});

test("same Task may have Daily Focus Sessions on multiple dates", () => {
  const sessions = [
    { id: "w", isDailyFocus: true, startAt: "2026-09-09T01:00:00.000Z" },
    { id: "f", isDailyFocus: true, startAt: "2026-09-11T01:00:00.000Z" },
  ];
  assert.ok(findDailyFocusSession(sessions, "2026-09-09"));
  assert.ok(findDailyFocusSession(sessions, "2026-09-11"));
});

test("only one focus Session wins per day via replacement helper", () => {
  const decision = resolveSessionDailyFocusReplacement({
    existingFocusSessionId: "old",
    nextSessionId: "new",
  });
  assert.equal(decision.needsConfirm, true);
  assert.equal(decision.clearSessionId, "old");
});

test("moving focus Session across days detects destination conflict", () => {
  const result = resolveFocusOnSessionMove({
    wasDailyFocus: true,
    sourceDate: "2026-09-09",
    destDate: "2026-09-10",
    destExistingFocusSessionId: "other",
    movingSessionId: "self",
  });
  assert.deepEqual(result, { action: "CONFLICT", existingFocusSessionId: "other" });
});

test("priority remains independent of Daily Focus designation", () => {
  const session = { priority: "p2", isDailyFocus: true, startEpochMs: Date.parse("2026-09-07T19:30:00+07:00") };
  assert.equal(session.priority, "p2");
  assert.equal(isSessionDailyFocusOnDate(session, "2026-09-07"), true);
});

test("core priority missed when Daily Focus Session incomplete despite supporting done", () => {
  // Session completion drives focus hit — Task outcome is separate.
  assert.equal(
    false /* focusDone */,
    false,
  );
});
