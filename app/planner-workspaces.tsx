"use client";

import type { ApiGoal } from "@/lib/planner-api";

export type PlannerGoal = ApiGoal;
export type HorizonScope = "day" | "week" | "month" | "all";

const HORIZON_TABS: { id: HorizonScope; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "all", label: "All" },
];

export function HorizonTabs({
  value,
  onChange,
}: {
  value: HorizonScope;
  onChange: (value: HorizonScope) => void;
}) {
  return (
    <div className="pos-task-horizon-tabs" role="tablist" aria-label="Time horizon">
      {HORIZON_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          className={value === tab.id ? "pos-task-horizon-tab active" : "pos-task-horizon-tab"}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export { GoalsWorkspace, ProjectsWorkspace } from "./goal-project-workspaces";
export { ProgressWorkspace } from "./progress-workspace";
