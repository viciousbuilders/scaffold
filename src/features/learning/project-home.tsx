"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink, Plus } from "lucide-react";
import type { Question } from "@/core/schemas";
import {
  learningSubjects,
  learningSubjectSchema,
  safeSource,
  suggestedQuestion,
  type LearningProject,
} from "@/core/learning-projects";
import { getDraft, updateSession, useSession } from "@/features/session/store";

type Props = { open: (q: Question) => void };
export function ProjectHome({ open }: Props) {
  const session = useSession();
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<"plan" | "notes" | "results">("plan");
  const [error, setError] = useState("");
  const projects = session.learningProjects || [];
  const active = projects.filter((p) => !p.archived);
  const project = projects.find((p) => p.id === selected);
  const nextProject = active.find((p) => p.steps.some((s) => !s.done)) ?? active[0];
  const draftFor = (q: Question) => getDraft(q, session);
  const current = session.questions[session.activeIndex];
  const next =
    current && !draftFor(current).completed
      ? current
      : suggestedQuestion(session.questions, draftFor);
  function patch(id: string, change: Partial<LearningProject>) {
    updateSession((previous) => ({
      ...previous,
      learningProjects: (previous.learningProjects || []).map((p) =>
        p.id === id ? { ...p, ...change } : p,
      ),
    }));
  }
  function create(form: HTMLFormElement) {
    const data = new FormData(form);
    const title = String(data.get("title") || "").trim();
    const source = String(data.get("source") || "").trim();
    if (!title || (source && !safeSource(source))) {
      setError("Enter a title and a valid http or https source URL.");
      return;
    }
    const subject = learningSubjectSchema.safeParse(data.get("subject"));
    if (!subject.success) {
      setError("Enter a subject of up to 120 characters.");
      return;
    }
    if (editing && project) {
      patch(project.id, {
        title,
        source,
        goal: String(data.get("goal") || "").trim(),
        subject: subject.data,
      });
      setEditing(false);
      setCreating(false);
      setError("");
      return;
    }
    const id = crypto.randomUUID();
    const newProject: LearningProject = {
      id,
      title,
      goal: String(data.get("goal") || "").trim(),
      source,
      subject: subject.data,
      notes: "",
      results: "",
      questionIds: [],
      createdAt: new Date().toISOString(),
      archived: false,
      steps: String(data.get("steps") || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 50)
        .map((title) => ({ id: crypto.randomUUID(), title: title.slice(0, 300), done: false })),
    };
    updateSession((previous) => ({
      ...previous,
      learningProjects: [...(previous.learningProjects || []), newProject],
    }));
    setSelected(id);
    setCreating(false);
    setError("");
    setTab("plan");
  }
  if (creating)
    return (
      <section className="project-create">
        <button
          className="text-button"
          onClick={() => {
            setCreating(false);
            setEditing(false);
            setError("");
          }}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <h2>{editing ? "Edit project" : "New project"}</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            create(event.currentTarget);
          }}
        >
          <label>
            Title
            <input
              name="title"
              defaultValue={editing ? project?.title : ""}
              required
              maxLength={160}
              placeholder="Learn conversational Spanish"
              autoFocus
            />
          </label>
          <label>
            Subject
            <input
              name="subject"
              defaultValue={editing ? project?.subject : newSubject}
              list="learning-subject-suggestions"
              placeholder="Any topic, e.g. Spanish, ecology or photography"
              required
              maxLength={120}
            />
            <datalist id="learning-subject-suggestions">
              {learningSubjects.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label>
            What do you want to be able to do?
            <textarea
              defaultValue={editing ? project?.goal : ""}
              name="goal"
              maxLength={4000}
              rows={2}
              placeholder="Introduce myself and hold a short conversation."
            />
          </label>
          <label>
            Source URL <span className="project-muted">(optional)</span>
            <input
              name="source"
              defaultValue={editing ? project?.source : ""}
              type="url"
              maxLength={2000}
              placeholder="https://…"
            />
          </label>
          {!editing && (
            <label>
              Steps <span className="project-muted">(one per line)</span>
              <textarea
                name="steps"
                rows={4}
                maxLength={15000}
                placeholder={
                  "Learn the essentials\nPractise with an example\nExplain it in my own words\nReview what I found difficult"
                }
              />
            </label>
          )}
          {error && <p role="alert">{error}</p>}
          <button className="button primary" disabled={!editing && projects.length >= 100}>
            {editing ? "Save changes" : "Create project"}
          </button>
          {projects.length >= 100 && <p>Project limit reached (100).</p>}
        </form>
      </section>
    );
  if (project) {
    const linked = project.questionIds.flatMap((id) =>
      session.questions.filter((q) => q.id === id),
    );
    const suggested = suggestedQuestion(linked, draftFor);
    const source = safeSource(project.source);
    return (
      <section className="project-detail">
        <div className="project-backbar">
          <button className="text-button" onClick={() => setSelected(null)}>
            <ArrowLeft size={14} /> All projects
          </button>
          <button
            className="text-button"
            onClick={() => {
              setEditing(true);
              setCreating(true);
            }}
          >
            Edit project
          </button>
        </div>
        <div className="project-title">
          <div>
            <p className="project-muted">{project.subject}</p>
            <h2>{project.title}</h2>
          </div>
          <button
            className="text-button"
            onClick={() => patch(project.id, { archived: !project.archived })}
          >
            {project.archived ? "Restore project" : "Archive project"}
          </button>
        </div>
        {project.goal && <p className="project-goal">{project.goal}</p>}
        {source && (
          <a className="source-reference" href={source} target="_blank" rel="noreferrer">
            Read source <ExternalLink size={13} />
          </a>
        )}
        <nav className="project-tabs" aria-label="Project workspace">
          {(["plan", "notes", "results"] as const).map((t) => (
            <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t === "plan" ? "Plan" : t === "notes" ? "Notes & questions" : "Results"}
            </button>
          ))}
        </nav>
        {tab !== "plan" ? (
          <label className="project-notebook">
            {tab === "notes" ? "Notes & questions" : "Results & conclusions"}
            <textarea
              rows={14}
              maxLength={40000}
              value={project[tab]}
              onChange={(e) => patch(project.id, { [tab]: e.target.value })}
              placeholder={
                tab === "notes"
                  ? "Explain the idea in your words. What is still unclear?"
                  : "Record what you tried, what you learned and what to practise next."
              }
            />
            <span className="project-muted">Saved with your workspace progress.</span>
          </label>
        ) : (
          <>
            <div className="project-section-title">
              <h3>Steps</h3>
              <span className="project-muted">
                {project.steps.filter((s) => s.done).length}/{project.steps.length} recorded by you
              </span>
            </div>
            {project.steps.map((step) => (
              <label className="project-step" key={step.id}>
                <input
                  type="checkbox"
                  checked={step.done}
                  onChange={(e) =>
                    patch(project.id, {
                      steps: project.steps.map((s) =>
                        s.id === step.id ? { ...s, done: e.target.checked } : s,
                      ),
                    })
                  }
                />
                <span>{step.title}</span>
              </label>
            ))}
            <form
              className="project-add-step"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const title = String(new FormData(form).get("step") || "").trim();
                if (title && project.steps.length < 50) {
                  patch(project.id, {
                    steps: [...project.steps, { id: crypto.randomUUID(), title, done: false }],
                  });
                  form.reset();
                }
              }}
            >
              <input
                name="step"
                aria-label="New step"
                placeholder="Add a step"
                maxLength={300}
                required
              />
              <button className="button secondary" disabled={project.steps.length >= 50}>
                Add
              </button>
            </form>
            <div className="project-section-title">
              <h3>Practice</h3>
              {suggested && (
                <button className="text-button" onClick={() => open(suggested)}>
                  Continue practice <ArrowRight size={14} />
                </button>
              )}
            </div>
            <p className="project-muted">Link exercises that support this project.</p>
            <details className="project-link-exercises">
              <summary>Choose exercises ({linked.length} linked)</summary>
              {session.questions.map((q) => (
                <label className="project-step" key={q.id}>
                  <input
                    type="checkbox"
                    checked={project.questionIds.includes(q.id)}
                    onChange={(e) =>
                      patch(project.id, {
                        questionIds: e.target.checked
                          ? [...project.questionIds, q.id]
                          : project.questionIds.filter((id) => id !== q.id),
                      })
                    }
                  />
                  <span>{q.title}</span>
                </label>
              ))}
              {!session.questions.length && (
                <p>
                  Add exercises from the library, or ask your AI CLI to create questions on this
                  topic in your workspace folder.
                </p>
              )}
            </details>
            {linked.map((q) => (
              <button className="project-exercise" key={q.id} onClick={() => open(q)}>
                <span>{q.title}</span>
                <small>{draftFor(q).completed ? "Recorded" : "Open"}</small>
                <ArrowRight size={14} />
              </button>
            ))}
          </>
        )}
      </section>
    );
  }
  return (
    <div className="project-home">
      {(nextProject || next) && (
        <section className="next-session" aria-label="Suggested next activity">
          <div>
            <span className="learning-eyebrow">Continue</span>
            <h2>{nextProject ? nextProject.title : next?.title}</h2>
            {nextProject?.steps.find((s) => !s.done) && (
              <p>{nextProject.steps.find((s) => !s.done)?.title}</p>
            )}
          </div>
          <button
            className="button primary"
            onClick={() => {
              if (nextProject) {
                setSelected(nextProject.id);
                setTab("plan");
              } else if (next) open(next);
            }}
          >
            {nextProject ? "Open project" : "Continue practice"} <ArrowRight size={15} />
          </button>
        </section>
      )}
      <section>
        <div className="project-section-title">
          <h2>Projects</h2>
          <button
            className="button secondary"
            onClick={() => {
              setNewSubject("");
              setCreating(true);
            }}
          >
            <Plus size={14} /> New project
          </button>
        </div>
        {active.length ? (
          active.map((p) => (
            <button
              className="project-list-row"
              key={p.id}
              onClick={() => {
                setSelected(p.id);
                setTab("plan");
              }}
            >
              <span>
                <strong>{p.title}</strong>
                <small>{p.subject}</small>
              </span>
              <span className="project-muted">
                {p.steps.filter((s) => s.done).length}/{p.steps.length} steps
              </span>
              <ArrowRight size={15} />
            </button>
          ))
        ) : (
          <div className="project-empty">
            <p>Learn any topic. Start with a goal, a book, an article or a question.</p>
            <button
              className="text-button"
              onClick={() => {
                setNewSubject("");
                setCreating(true);
              }}
            >
              Create your first project <ArrowRight size={14} />
            </button>
          </div>
        )}
        {projects.some((p) => p.archived) && (
          <details className="archived-projects">
            <summary>Archived projects</summary>
            {projects
              .filter((p) => p.archived)
              .map((p) => (
                <button className="project-list-row" key={p.id} onClick={() => setSelected(p.id)}>
                  {p.title}
                  <ArrowRight size={14} />
                </button>
              ))}
          </details>
        )}
      </section>
      <section className="project-subjects">
        <h2>Start with a subject</h2>
        <div>
          {learningSubjects.map((s) => (
            <button
              key={s}
              onClick={() => {
                setNewSubject(s);
                setCreating(true);
              }}
            >
              {s}
              <ArrowRight size={14} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
