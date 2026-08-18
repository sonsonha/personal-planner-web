"use client";

import { MoreHorizontal, Plus, Target, Trash2, X } from "lucide-react";
import { FormEvent, useState } from "react";
import {
  createGoal,
  createProject,
  deleteGoal,
  deleteProject,
  updateGoal,
  updateProject,
  type ApiGoal,
  type ApiProject,
} from "@/lib/planner-api";

export type PlannerGoal = ApiGoal;

type ProjectRow = ApiProject & { taskCount: number };

export function ProjectsWorkspace({
  projects,
  goals,
  taskCountByProject,
  live,
  onChanged,
}: {
  projects: ApiProject[];
  goals: PlannerGoal[];
  taskCountByProject: Map<string, number>;
  live: boolean;
  onChanged: (message: string) => void;
}) {
  const [editing, setEditing] = useState<ApiProject | "new" | null>(null);

  const rows: ProjectRow[] = projects
    .filter((project) => project.active)
    .map((project) => ({
      ...project,
      taskCount: taskCountByProject.get(project.id) ?? 0,
    }))
    .sort((left, right) => left.title.localeCompare(right.title));

  return (
    <section className="entity-workspace" aria-label="Projects">
      <div className="entity-hero">
        <div>
          <div className="eyebrow">Goal → Project → Task</div>
          <h2>Projects</h2>
          <p>Group related tasks and keep them tied to the outcomes you care about.</p>
        </div>
        <button className="primary-button" onClick={() => setEditing("new")}>
          <Plus size={17} /> New project
        </button>
      </div>

      <div className="entity-list">
        {rows.map((project) => {
          const goal = goals.find((item) => item.id === project.goalId);
          return (
            <article className="entity-row" key={project.id}>
              <i className="entity-color" style={{ background: project.color }} />
              <div className="entity-main">
                <strong>{project.title}</strong>
                <span>{goal ? `Linked to ${goal.title}` : "No linked goal"}</span>
              </div>
              <div className="entity-meta">{project.taskCount} task{project.taskCount === 1 ? "" : "s"}</div>
              <button className="row-more" aria-label={`Edit ${project.title}`} onClick={() => setEditing(project)}>
                <MoreHorizontal size={18} />
              </button>
            </article>
          );
        })}

        {rows.length === 0 && (
          <div className="entity-empty">
            <strong>No projects yet</strong>
            <span>Create a project to organize tasks around a theme or outcome.</span>
          </div>
        )}
      </div>

      {editing && (
        <ProjectEditorModal
          project={editing === "new" ? null : editing}
          goals={goals}
          live={live}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            onChanged(message);
          }}
        />
      )}
    </section>
  );
}

function ProjectEditorModal({
  project,
  goals,
  live,
  onClose,
  onSaved,
}: {
  project: ApiProject | null;
  goals: PlannerGoal[];
  live: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [title, setTitle] = useState(project?.title ?? "");
  const [goalId, setGoalId] = useState<string | "">(project?.goalId ?? "");
  const [color, setColor] = useState(project?.color ?? "#705CF6");
  const [description, setDescription] = useState(project?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError("Project title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    if (!live) {
      onSaved(project ? "Project updated · demo mode" : "Project created · demo mode");
      return;
    }
    try {
      if (project) {
        await updateProject(project.id, {
          title: title.trim(),
          goalId: goalId || null,
          color,
          description: description.trim(),
        });
        onSaved("Project updated");
      } else {
        await createProject({
          title: title.trim(),
          goalId: goalId || null,
          color,
          description: description.trim(),
        });
        onSaved("Project created");
      }
    } catch {
      setSaving(false);
      setError("Could not save this project.");
    }
  };

  const remove = async () => {
    if (!project) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    if (!live) {
      onSaved("Project deleted · demo mode");
      return;
    }
    try {
      await deleteProject(project.id);
      onSaved("Project deleted · linked tasks moved to Inbox");
    } catch {
      setSaving(false);
      setError("Could not delete this project.");
    }
  };

  return (
    <div className="entity-modal-backdrop">
      <button className="modal-dismiss" type="button" aria-label="Close" onClick={onClose} />
      <form className="entity-modal" onSubmit={submit}>
        <div className="entity-modal-header">
          <div>
            <div className="eyebrow">Project</div>
            <h3>{project ? "Edit project" : "New project"}</h3>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <label>
          <span>Title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          <span>Linked goal</span>
          <select value={goalId} onChange={(event) => setGoalId(event.target.value)}>
            <option value="">None</option>
            {goals.filter((goal) => goal.status === "ACTIVE").map((goal) => (
              <option key={goal.id} value={goal.id}>{goal.title}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Color</span>
          <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
        </label>
        <label>
          <span>Description</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
        </label>
        {error && <p className="entity-error">{error}</p>}
        <div className="entity-modal-actions">
          {project && (
            <button type="button" className="danger-button" onClick={remove} disabled={saving}>
              <Trash2 size={15} /> {confirmDelete ? "Confirm delete" : "Delete"}
            </button>
          )}
          <div className="entity-modal-actions-right">
            <button type="button" className="ghost-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export function GoalsWorkspace({
  goals,
  projects,
  live,
  onChanged,
}: {
  goals: PlannerGoal[];
  projects: ApiProject[];
  live: boolean;
  onChanged: (message: string) => void;
}) {
  const [editing, setEditing] = useState<PlannerGoal | "new" | null>(null);
  const activeGoals = goals
    .filter((goal) => goal.status === "ACTIVE")
    .sort((left, right) => left.title.localeCompare(right.title));
  const grouped = ["YEAR", "QUARTER", "MONTH", "WEEK", "SHORT", "LONG", "MISSION"].map((horizon) => ({
    horizon,
    items: activeGoals.filter((goal) => goal.horizon === horizon),
  })).filter((group) => group.items.length > 0);

  return (
    <section className="entity-workspace" aria-label="Goals">
      <div className="entity-hero">
        <div>
          <div className="eyebrow">Outcomes over activity</div>
          <h2>Goals</h2>
          <p>Define what success looks like, then link projects and tasks that move you there.</p>
        </div>
        <button className="primary-button" onClick={() => setEditing("new")}>
          <Plus size={17} /> New goal
        </button>
      </div>

      {grouped.length === 0 ? (
        <div className="entity-empty">
          <Target size={22} />
          <strong>No active goals</strong>
          <span>Add a goal to anchor your projects and weekly planning.</span>
        </div>
      ) : grouped.map((group) => (
        <div className="entity-group" key={group.horizon}>
          <h3>{group.horizon[0] + group.horizon.slice(1).toLowerCase()} horizon</h3>
          <div className="entity-list">
            {group.items.map((goal) => {
              const linked = projects.filter((project) => project.goalId === goal.id && project.active);
              return (
                <article className="entity-row" key={goal.id}>
                  <div className="entity-main">
                    <strong>{goal.title}</strong>
                    <span>{linked.length} linked project{linked.length === 1 ? "" : "s"}</span>
                  </div>
                  {goal.targetDate && <div className="entity-meta">{goal.targetDate}</div>}
                  <button className="row-more" aria-label={`Edit ${goal.title}`} onClick={() => setEditing(goal)}>
                    <MoreHorizontal size={18} />
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      ))}

      {editing && (
        <GoalEditorModal
          goal={editing === "new" ? null : editing}
          live={live}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            onChanged(message);
          }}
        />
      )}
    </section>
  );
}

function GoalEditorModal({
  goal,
  live,
  onClose,
  onSaved,
}: {
  goal: PlannerGoal | null;
  live: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [title, setTitle] = useState(goal?.title ?? "");
  const [horizon, setHorizon] = useState(goal?.horizon ?? "SHORT");
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [successCriteria, setSuccessCriteria] = useState(goal?.successCriteria ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError("Goal title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    if (!live) {
      onSaved(goal ? "Goal updated · demo mode" : "Goal created · demo mode");
      return;
    }
    try {
      const payload = {
        title: title.trim(),
        horizon,
        targetDate: targetDate || null,
        description: description.trim(),
        successCriteria: successCriteria.trim(),
      };
      if (goal) {
        await updateGoal(goal.id, payload);
        onSaved("Goal updated");
      } else {
        await createGoal(payload);
        onSaved("Goal created");
      }
    } catch {
      setSaving(false);
      setError("Could not save this goal.");
    }
  };

  const remove = async () => {
    if (!goal) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    if (!live) {
      onSaved("Goal deleted · demo mode");
      return;
    }
    try {
      await deleteGoal(goal.id);
      onSaved("Goal deleted · linked projects unlinked");
    } catch {
      setSaving(false);
      setError("Could not delete this goal.");
    }
  };

  return (
    <div className="entity-modal-backdrop">
      <button className="modal-dismiss" type="button" aria-label="Close" onClick={onClose} />
      <form className="entity-modal" onSubmit={submit}>
        <div className="entity-modal-header">
          <div>
            <div className="eyebrow">Goal</div>
            <h3>{goal ? "Edit goal" : "New goal"}</h3>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <label>
          <span>Title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          <span>Horizon</span>
          <select value={horizon} onChange={(event) => setHorizon(event.target.value)}>
            {["MISSION", "YEAR", "QUARTER", "MONTH", "WEEK", "SHORT", "LONG"].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Target date</span>
          <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
        </label>
        <label>
          <span>Description</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
        </label>
        <label>
          <span>Success criteria</span>
          <textarea value={successCriteria} onChange={(event) => setSuccessCriteria(event.target.value)} rows={2} />
        </label>
        {error && <p className="entity-error">{error}</p>}
        <div className="entity-modal-actions">
          {goal && (
            <button type="button" className="danger-button" onClick={remove} disabled={saving}>
              <Trash2 size={15} /> {confirmDelete ? "Confirm delete" : "Delete"}
            </button>
          )}
          <div className="entity-modal-actions-right">
            <button type="button" className="ghost-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
