export type PlannerSection = "calendar" | "tasks" | "projects" | "goals" | "progress";

const SECTION_PATH: Record<PlannerSection, string> = {
  calendar: "/calendar",
  tasks: "/tasks",
  projects: "/projects",
  goals: "/goals",
  progress: "/progress",
};

export function plannerPath(section: PlannerSection, entityId?: string | null) {
  const base = SECTION_PATH[section];
  if (!entityId) return base;
  return `${base}/${encodeURIComponent(entityId)}`;
}

export function parsePlannerPath(pathname: string): {
  section: PlannerSection;
  entityId: string | null;
} {
  const parts = pathname.split("/").filter(Boolean);
  const root = parts[0];
  const entityId = parts[1] ? decodeURIComponent(parts[1]) : null;
  if (root === "tasks") return { section: "tasks", entityId: null };
  if (root === "projects") return { section: "projects", entityId };
  if (root === "goals") return { section: "goals", entityId };
  if (root === "progress") return { section: "progress", entityId };
  return { section: "calendar", entityId: null };
}
