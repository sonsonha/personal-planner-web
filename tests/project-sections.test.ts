import assert from "node:assert/strict";
import test from "node:test";
import { buildProjectSections } from "../lib/project-sections.ts";
import type { ApiGoal, ApiProject } from "../lib/planner-api.ts";

function goal(partial: Partial<ApiGoal> & Pick<ApiGoal, "id" | "title">): ApiGoal {
  return {
    lifeArea: "LIFE",
    description: "",
    horizon: "SHORT",
    status: "ACTIVE",
    targetDate: null,
    parentId: null,
    successCriteria: "",
    outcome: partial.title,
    why: "",
    metric: "",
    focusType: "FOCUS",
    outcomeStatus: "ACTIVE",
    achievedAt: null,
    closedAt: null,
    currentMilestoneId: null,
    milestones: [],
    systems: [],
    processes: [],
    metricObservations: [],
    reflection: {},
    reviewSnapshot: {},
    revision: 1,
    updatedAt: new Date().toISOString(),
    ...partial,
  } as ApiGoal;
}

function project(partial: Partial<ApiProject> & Pick<ApiProject, "id" | "title">): ApiProject {
  return {
    description: "",
    goalId: null,
    lifeArea: "LIFE",
    color: "#000",
    active: true,
    projectType: "STANDARD",
    projectContext: "PERSONAL",
    revision: 1,
    updatedAt: new Date().toISOString(),
    ...partial,
  } as ApiProject;
}

test("project sections follow Work → Personal → priority Goal order", () => {
  const goals = [
    goal({ id: "explore", title: "Education & Opportunity Exploration", focusType: "EXPLORE" }),
    goal({ id: "ielts", title: "Achieve IELTS 7.0", focusType: "FOCUS" }),
    goal({ id: "job", title: "Obtain a strong Software Engineer / Backend-focused job", focusType: "FOCUS" }),
    goal({ id: "health", title: "Maintain Good Health", focusType: "MAINTAIN" }),
    goal({ id: "learn", title: "Continuous Learning & Intellectual Development", focusType: "MAINTAIN" }),
    goal({ id: "finance", title: "Maintain Personal Financial Awareness & Control", focusType: "MAINTAIN" }),
  ];
  const projects = [
    project({ id: "w1", title: "Landfill Rover", projectContext: "WORK" }),
    project({ id: "p1", title: "Personal OS Review & Planning", projectType: "HABIT" }),
    project({ id: "e1", title: "Opportunity Exploration", goalId: "explore", projectType: "STANDARD" }),
    project({ id: "i1", title: "IELTS Writing Improvement", goalId: "ielts" }),
    project({ id: "j1", title: "Backend Interview Preparation", goalId: "job" }),
    project({ id: "h1", title: "Exercise & Movement", goalId: "health", projectType: "HABIT" }),
    project({ id: "l1", title: "Reading", goalId: "learn", projectType: "HABIT" }),
    project({ id: "f1", title: "Financial Tracking & Review", goalId: "finance", projectType: "HABIT" }),
  ];

  const sections = buildProjectSections(projects, goals);
  assert.deepEqual(
    sections.map((s) => s.label),
    [
      "Work",
      "Personal",
      "Focus · Obtain a strong Software Engineer / Backend-focused job",
      "Focus · Achieve IELTS 7.0",
      "Maintain · Maintain Good Health",
      "Maintain · Continuous Learning & Intellectual Development",
      "Maintain · Maintain Personal Financial Awareness & Control",
      "Explore · Education & Opportunity Exploration",
    ],
  );
  assert.equal(sections.find((s) => s.key === "goal-explore")?.projects[0]?.projectType, "STANDARD");
});
