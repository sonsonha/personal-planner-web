import type { ApiGoal, ApiProject } from "@/lib/planner-api";

/**
 * Owner priority for Projects page Goal groups (not alphabetical).
 * Work / Personal unlinked sections always come first.
 */
export const GOAL_GROUP_PRIORITY_TITLES = [
  "Obtain a strong Software Engineer / Backend-focused job",
  "Achieve IELTS 7.0",
  "Maintain Good Health",
  "Continuous Learning & Intellectual Development",
  "Maintain Personal Financial Awareness & Control",
  "Education & Opportunity Exploration",
] as const;

const FOCUS_SECTION_ORDER = ["FOCUS", "MAINTAIN", "EXPLORE"] as const;

export type ProjectSection = {
  key: string;
  label: string;
  projects: ApiProject[];
};

function goalPriorityIndex(title: string): number {
  const idx = GOAL_GROUP_PRIORITY_TITLES.findIndex((t) => t === title);
  return idx === -1 ? GOAL_GROUP_PRIORITY_TITLES.length + 1 : idx;
}

export function buildProjectSections(projects: ApiProject[], goals: ApiGoal[]): ProjectSection[] {
  const byTitle = (a: ApiProject, b: ApiProject) => a.title.localeCompare(b.title);

  const work = projects
    .filter((p) => !p.goalId && (p.projectContext ?? "PERSONAL") === "WORK")
    .sort(byTitle);
  const personalUnlinked = projects
    .filter((p) => !p.goalId && (p.projectContext ?? "PERSONAL") !== "WORK")
    .sort(byTitle);

  const linkedByGoal = new Map<string, ApiProject[]>();
  for (const project of projects) {
    if (!project.goalId) continue;
    const list = linkedByGoal.get(project.goalId) ?? [];
    list.push(project);
    linkedByGoal.set(project.goalId, list);
  }

  const sections: ProjectSection[] = [];
  if (work.length > 0) {
    sections.push({ key: "work", label: "Work", projects: work });
  }
  if (personalUnlinked.length > 0) {
    sections.push({ key: "personal", label: "Personal", projects: personalUnlinked });
  }

  const linkedGoals = goals
    .filter((g) => g.status === "ACTIVE" && linkedByGoal.has(g.id))
    .sort((a, b) => {
      const focusA = FOCUS_SECTION_ORDER.indexOf((a.focusType ?? "FOCUS") as (typeof FOCUS_SECTION_ORDER)[number]);
      const focusB = FOCUS_SECTION_ORDER.indexOf((b.focusType ?? "FOCUS") as (typeof FOCUS_SECTION_ORDER)[number]);
      const fa = focusA === -1 ? 99 : focusA;
      const fb = focusB === -1 ? 99 : focusB;
      if (fa !== fb) return fa - fb;
      const pa = goalPriorityIndex(a.title);
      const pb = goalPriorityIndex(b.title);
      if (pa !== pb) return pa - pb;
      return a.title.localeCompare(b.title);
    });

  for (const goal of linkedGoals) {
    const linked = (linkedByGoal.get(goal.id) ?? []).sort(byTitle);
    if (linked.length === 0) continue;
    const focus = goal.focusType ?? "FOCUS";
    const focusLabel = focus === "FOCUS" ? "Focus" : focus === "MAINTAIN" ? "Maintain" : "Explore";
    sections.push({
      key: `goal-${goal.id}`,
      label: `${focusLabel} · ${goal.title}`,
      projects: linked,
    });
  }

  const shown = new Set(sections.flatMap((s) => s.projects.map((p) => p.id)));
  const orphanLinked = projects.filter((p) => p.goalId && !shown.has(p.id)).sort(byTitle);
  if (orphanLinked.length > 0) {
    sections.push({ key: "other-linked", label: "Other linked", projects: orphanLinked });
  }

  return sections;
}
