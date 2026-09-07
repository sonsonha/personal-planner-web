import assert from "node:assert/strict";
import test from "node:test";
import {
  appendCarryOverNote,
  buildCarryOverNote,
  deriveTaskProgressFromSessions,
  directTaskCompletePolicy,
  formatSessionProgressLabel,
  futureWeekOffsets,
  resolveRepeatWeekCount,
  resolveTaskStatusFromEvidence,
  shiftEpochByWeeks,
} from "../lib/session-evidence.ts";

test("derives multi-session progress and DONE only when all sessions complete", () => {
  const blocks = [
    { id: "1", status: "DONE" },
    { id: "2", status: "DONE" },
    { id: "3", status: "PLANNED" },
    { id: "4", status: "PLANNED" },
    { id: "5", status: "PLANNED" },
  ];
  const progress = deriveTaskProgressFromSessions(blocks);
  assert.equal(progress.completedCount, 2);
  assert.equal(progress.activeCount, 5);
  assert.equal(progress.progressPercent, 40);
  assert.equal(progress.progressState, "PARTIAL");
  assert.equal(progress.derivedTaskStatus, "SCHEDULED");
  assert.equal(formatSessionProgressLabel(progress), "2 / 5 sessions done · 40%");

  const allDone = blocks.map((b) => ({ ...b, status: "DONE" }));
  assert.equal(deriveTaskProgressFromSessions(allDone).derivedTaskStatus, "DONE");
  assert.equal(deriveTaskProgressFromSessions(allDone).progressPercent, 100);
});

test("reopens when one session is undone from full completion", () => {
  const blocks = [
    { id: "1", status: "DONE" },
    { id: "2", status: "DONE" },
    { id: "3", status: "DONE" },
    { id: "4", status: "DONE" },
    { id: "5", status: "PLANNED" },
  ];
  const progress = deriveTaskProgressFromSessions(blocks);
  assert.equal(progress.completedCount, 4);
  assert.equal(progress.progressPercent, 80);
  assert.equal(progress.progressState, "PARTIAL");
  assert.equal(progress.derivedTaskStatus, "SCHEDULED");
});

test("gates direct Task complete: zero / one / many sessions", () => {
  assert.equal(directTaskCompletePolicy([]).allow, false);
  assert.deepEqual(directTaskCompletePolicy([{ id: "1", status: "PLANNED" }]), {
    allow: true,
    mode: "SINGLE_SESSION",
  });
  assert.equal(
    directTaskCompletePolicy([
      { id: "1", status: "PLANNED" },
      { id: "2", status: "PLANNED" },
    ]).allow,
    false,
  );
});

test("Definition of Done: all Sessions done does not force Task outcome DONE", () => {
  const sessions = deriveTaskProgressFromSessions([
    { id: "1", status: "DONE" },
    { id: "2", status: "DONE" },
  ]);
  assert.equal(sessions.derivedTaskStatus, "DONE");
  assert.equal(
    resolveTaskStatusFromEvidence({
      definitionOfDone: "- shipped",
      outcomeAchieved: false,
      sessionDerived: sessions.derivedTaskStatus,
    }),
    "SCHEDULED",
  );
  assert.equal(
    resolveTaskStatusFromEvidence({
      definitionOfDone: "- shipped",
      outcomeAchieved: true,
      sessionDerived: "SCHEDULED",
    }),
    "DONE",
  );
  assert.deepEqual(
    directTaskCompletePolicy([{ id: "1", status: "PLANNED" }], {
      definitionOfDone: "- criteria",
    }),
    { allow: false, reason: "REQUIRES_OUTCOME" },
  );
});

test("routines without DoD still complete from Sessions", () => {
  assert.equal(
    resolveTaskStatusFromEvidence({
      definitionOfDone: null,
      outcomeAchieved: false,
      sessionDerived: "DONE",
    }),
    "DONE",
  );
});

test("zero sessions are unscheduled", () => {
  const progress = deriveTaskProgressFromSessions([]);
  assert.equal(progress.progressState, "UNSCHEDULED");
  assert.equal(progress.derivedTaskStatus, "INBOX");
});

test("caps weeks and builds future offsets excluding source week", () => {
  assert.equal(resolveRepeatWeekCount({ weeks: 4, fromEpochMs: 0 }), 4);
  assert.equal(resolveRepeatWeekCount({ weeks: 999, fromEpochMs: 0 }), 52);
  assert.deepEqual(futureWeekOffsets(4), [1, 2, 3, 4]);
  assert.equal(shiftEpochByWeeks(1_000, 2), 1_000 + 14 * 86_400_000);
});

test("appends carry-over note without overwriting existing notes", () => {
  const note = buildCarryOverNote({ completedCount: 3, activeCount: 4, progressPercent: 75 });
  assert.match(note, /3\/4/);
  assert.equal(appendCarryOverNote("User plan", note), `User plan\n\n${note}`);
  assert.equal(appendCarryOverNote(note, note), note);
});
