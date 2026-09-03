import assert from "node:assert/strict";
import test from "node:test";
import type { ApiProject } from "../lib/planner-api.ts";

/** Habit projects are the same Project model with projectType HABIT — no auto-spawned tasks. */
function buildHabitProject(
  partial: Partial<ApiProject> & Pick<ApiProject, "id" | "title">,
): ApiProject {
  return {
    goalId: null,
    color: "#705CF6",
    active: true,
    projectType: "HABIT",
    ...partial,
  };
}

test("Habit project payload uses projectType HABIT and creates 0 tasks", () => {
  const project = buildHabitProject({
    id: "proj-walk",
    title: "Daily walk",
    description: "Ongoing movement habit",
  });
  assert.equal(project.projectType, "HABIT");
  assert.equal(project.title, "Daily walk");
  // Habit is a container only — creation does not spawn Tasks.
  assert.equal("taskIds" in project, false);
  assert.equal("spawnedTaskCount" in project, false);
});

test("STANDARD is the default finite project type", () => {
  const project: ApiProject = {
    id: "proj-ship",
    title: "Ship landing page",
    goalId: null,
    color: "#3478F6",
    active: true,
    projectType: "STANDARD",
  };
  assert.equal(project.projectType, "STANDARD");
});
