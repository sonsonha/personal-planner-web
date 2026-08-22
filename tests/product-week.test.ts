import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isDayOverdue,
  projectWeekSummary,
  startOfProductWeek,
  thisWeekLabel,
  weekCompletedForProject,
  weekOpenForProject,
} from "../lib/product-week.ts";

const NOW = new Date("2026-08-19T07:00:00.000Z"); // Wednesday 14:00 VN
const TODAY = new Date("2026-08-19T00:00:00+07:00");

describe("product week window", () => {
  it("starts Monday in Asia/Ho_Chi_Minh", () => {
    assert.equal(startOfProductWeek(NOW).toISOString(), "2026-08-16T17:00:00.000Z");
  });
});

describe("project this week vs lifetime", () => {
  it("does not treat 16 historical WEEK dones as this week", () => {
    const tasks = Array.from({ length: 16 }, (_, index) => {
      const weekOffset = index + 1;
      const completed = new Date(Date.UTC(2026, 3, 6 + weekOffset * 7, 10, 0) - 7 * 3600_000);
      return {
        id: `hist-${index}`,
        title: `Apply ${index + 1}`,
        projectId: "proj-apps",
        status: "done",
        dueHorizon: "week",
        dueAt: completed.toISOString(),
        completedAt: completed.toISOString(),
      };
    });

    const summary = projectWeekSummary("proj-apps", tasks, NOW);
    assert.equal(summary.weekDone.length, 0);
    assert.equal(summary.weekOpen.length, 0);
    assert.equal(summary.lifetimeDone, 16);
    assert.equal(summary.lifetimeTotal, 16);
    assert.equal(thisWeekLabel(summary.weekDone.length, summary.weekOpen.length), "No work planned");
  });

  it("counts only current-week completedAt and dueAt", () => {
    const tasks = [
      {
        id: "old",
        projectId: "p",
        status: "done",
        dueHorizon: "week",
        dueAt: "2026-08-10T00:00:00+07:00",
        completedAt: "2026-08-10T10:00:00+07:00",
      },
      {
        id: "done-now",
        projectId: "p",
        status: "done",
        dueHorizon: "week",
        dueAt: "2026-08-17T00:00:00+07:00",
        completedAt: "2026-08-18T10:00:00+07:00",
      },
      {
        id: "open-now",
        projectId: "p",
        status: "inbox",
        dueHorizon: "week",
        dueAt: "2026-08-17T00:00:00+07:00",
        completedAt: null,
      },
      {
        id: "open-old-week",
        projectId: "p",
        status: "inbox",
        dueHorizon: "week",
        dueAt: "2026-08-10T00:00:00+07:00",
        completedAt: null,
      },
    ];
    assert.equal(weekCompletedForProject("p", tasks, NOW).map((t) => t.id).join(","), "done-now");
    assert.equal(weekOpenForProject("p", tasks, NOW).map((t) => t.id).join(","), "open-now");
  });
});

describe("isDayOverdue", () => {
  it("does not mark a WEEK task with Monday dueAt as overdue", () => {
    const task = {
      dueHorizon: "week",
      dueAt: "2026-08-17T00:00:00+07:00",
      status: "inbox",
    };
    assert.equal(isDayOverdue(task, TODAY), false);
  });

  it("does not mark missing dueHorizon with a Monday dueAt as overdue", () => {
    const task = {
      dueHorizon: null,
      dueAt: "2026-08-17T00:00:00+07:00",
      status: "inbox",
    };
    assert.equal(isDayOverdue(task, TODAY), false);
  });

  it("marks an incomplete DAY task after its due date as overdue", () => {
    const task = {
      dueHorizon: "day",
      dueAt: "2026-08-17T00:00:00+07:00",
      status: "inbox",
    };
    assert.equal(isDayOverdue(task, TODAY), true);
  });
});
