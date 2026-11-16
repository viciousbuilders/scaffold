"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  House,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  ExternalLink,
  Layers3,
  LoaderCircle,
  RotateCcw,
  Search,
  Cpu,
} from "lucide-react";
import { researchCurriculum, researchStages, researchQuestions } from "@/core/learning-path";
import {
  trainingCurriculum,
  trainingStages,
  trainingQuestions,
  LAB_ENVIRONMENTS,
} from "@/core/training-path";
import { libraryEntries, type LibraryEntry } from "@/core/source-library";
import { freshAttempt, hasWork, reviewReason, usedHelp } from "@/core/practice-progress";
import type { Question } from "@/core/schemas";
import {
  applyLearningWorkspace,
  flushProgress,
  getDraft,
  updateDraft,
  updateSession,
  useSession,
  useWorkspacePath,
} from "@/features/session/store";
import { workspaceResponseSchema } from "@/features/workspace/client";
import { postApi } from "@/ui/api";

import { ProjectHome } from "./project-home";

type View = "home" | "path" | "training" | "library" | "review";
export function LearningHome() {
  const session = useSession();
  const path = useWorkspacePath();
  const router = useRouter();
  const [view, setView] = useState<View>("home");
  const [selectedStage, setSelectedStage] = useState(0);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("All");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const training = view === "training";
  const stages = training ? trainingStages : researchStages;
  const curriculum = training ? trainingCurriculum : researchCurriculum;
  const activities = training ? trainingQuestions : researchQuestions;
  const collection = training ? "training" : "research";
  const installed = new Set(session.questions.map((q) => q.id));
  const hasPath = stages.every((stage) => stage.questionIds.every((id) => installed.has(id)));
  const stage = stages[selectedStage];
  const review = session.questions.filter((q) => reviewReason(q, getDraft(q, session)));
  const pathIds = stages.flatMap((item) => item.questionIds);
  const pathQuestions = pathIds.flatMap((id) => session.questions.filter((q) => q.id === id));
  const nextPath = pathQuestions.find((q) => !getDraft(q, session).completed);
  const current = session.questions[session.activeIndex] || session.questions[0];
  const next =
    current &&
    pathIds.includes(current.id) &&
    hasWork(current, getDraft(current, session)) &&
    !getDraft(current, session).completed
      ? current
      : nextPath;
  const completed = pathQuestions.filter((q) => getDraft(q, session).completed).length;
  const checked = pathQuestions.filter(
    (q) => getDraft(q, session).completed && q.assessment !== "self-review",
  ).length;
  const normalized = search.trim().toLowerCase();
  const visibleQuestions = session.questions.filter(
    (q) =>
      `${q.title} ${q.topic} ${q.source?.provider || "Scaffold"}`
        .toLowerCase()
        .includes(normalized) &&
      (subject === "All" ||
        q.topic === subject ||
        (subject === "Research" && researchQuestions.some((item) => item.id === q.id)) ||
        (subject === "Training" && trainingQuestions.some((item) => item.id === q.id))),
  );
  const visibleEntries = libraryEntries.filter(
    (entry) =>
      `${entry.title} ${entry.provider} ${entry.subject}`.toLowerCase().includes(normalized) &&
      (subject === "All" || entry.subject === subject),
  );

  function open(question: Question) {
    updateSession({ activeIndex: session.questions.findIndex((q) => q.id === question.id) });
    router.push("/practice");
  }
  async function add(collection: string) {
    if (pending || !path) return;
    setPending(collection);
    setError("");
    setNotice("");
    try {
      await flushProgress();
      const loaded = await postApi("learning", { path, collection }, workspaceResponseSchema);
      applyLearningWorkspace(loaded);
      setNotice(
        collection === "research" || collection === "training" ? "Path added." : "Activity added.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't add this activity.");
    } finally {
      setPending(null);
    }
  }
  function status(question: Question) {
    const draft = getDraft(question, session);
    if (draft.completed)
      return question.assessment === "self-review"
        ? "Recorded by you"
        : usedHelp(draft)
          ? "Passed with help"
          : draft.attempts?.at(-1)?.evidence === "ai-feedback"
            ? "AI feedback · provisional"
            : "Passed checks";
    return hasWork(question, draft) ? "In progress" : "Not started";
  }
  function row(question: Question) {
    const draft = getDraft(question, session);
    return (
      <button className="study-row" key={question.id} onClick={() => open(question)}>
        <span className={draft.completed ? "study-row-icon is-done" : "study-row-icon"}>
          {draft.completed ? <CheckCircle2 size={17} /> : <Circle size={17} />}
        </span>
        <span className="study-row-title">
          {question.title}
          <small>
            {!question.lab && <>{question.source?.provider || "Scaffold"} · </>}
            {question.lab
              ? LAB_ENVIRONMENTS[question.lab.environment]
              : question.assessment === "self-review"
                ? "Investigation / activity"
                : question.kind === "coding"
                  ? "Code & test"
                  : "Reason & check"}
          </small>
        </span>
        <span className="study-row-status">{status(question)}</span>
        <ChevronRight size={15} aria-hidden="true" />
      </button>
    );
  }
  function sourceCard(entry: LibraryEntry) {
    const question = session.questions.find((q) => q.id === entry.id);
    return (
      <article className="source-card" key={entry.id}>
        <div className="source-card-meta">
          <span>{entry.provider}</span>
          <span>{entry.subject}</span>
        </div>
        <h3>{entry.title}</h3>
        <p>{entry.description}</p>
        <div className="source-card-bottom">
          <span className="source-mode">{entry.mode}</span>
          {question ? (
            <button className="button secondary" onClick={() => open(question)}>
              Open <ArrowRight size={14} />
            </button>
          ) : (
            <button
              className="button secondary"
              disabled={!!pending || !path}
              onClick={() => void add(entry.id)}
            >
              {pending === entry.id ? <LoaderCircle size={14} className="spin" /> : null}{" "}
              {entry.mode === "Imported exercise" ? "Import exercise" : "Add activity"}
            </button>
          )}
        </div>
        {entry.url && (
          <a className="source-original" href={entry.url} target="_blank" rel="noreferrer">
            Original source <ExternalLink size={12} />
          </a>
        )}
      </article>
    );
  }
  return (
    <main id="main-content" className="learning-home">
      <div className="learning-heading">
        <h1>Learning</h1>
      </div>
      <nav className="learning-nav" aria-label="Learning workspace">
        {(
          [
            { id: "home", label: "Home", icon: House },
            { id: "path", label: "AI research", icon: Layers3 },
            { id: "training", label: "GPU programming", icon: Cpu },
            { id: "library", label: "Library", icon: BookOpen },
            { id: "review", label: "Review", icon: RotateCcw },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button key={id} aria-pressed={view === id} onClick={() => setView(id)}>
            <Icon size={15} />
            {label}
            {id === "review" && review.length > 0 && <span>{review.length}</span>}
          </button>
        ))}
      </nav>
      {error && (
        <div className="error-notice" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <p className="learning-notice" role="status">
          <Check size={14} />
          {notice}
        </p>
      )}
      {view === "home" && <ProjectHome open={open} />}
      {(view === "path" || view === "training") && (
        <>
          <section className="next-session" aria-label="Next practice session">
            <div>
              <span className="learning-eyebrow">{hasPath ? "Continue" : "Get started"}</span>
              <h2>{hasPath && next ? next.title : curriculum.title}</h2>
              {!hasPath && (
                <p>
                  {training
                    ? "PyTorch, training loops and GPU programming."
                    : "Mathematics, ML and research practice."}
                </p>
              )}
            </div>
            {!hasPath ? (
              <button
                className="button primary"
                disabled={!!pending || !path}
                onClick={() => void add(collection)}
              >
                {pending === collection ? (
                  <LoaderCircle size={15} className="spin" />
                ) : (
                  <ArrowRight size={15} />
                )}{" "}
                {training ? "Add training path" : "Add research path"}
              </button>
            ) : next ? (
              <button className="button primary" onClick={() => open(next)}>
                Continue practice <ArrowRight size={15} />
              </button>
            ) : null}
          </section>
          <div className="path-section-heading">
            <div>
              <h2>{training ? "PyTorch & GPU programming" : "Your research foundation"}</h2>
            </div>
            <span>
              {completed}/{pathIds.length} recorded
              <small>
                {checked} checked · {completed - checked} self-reviewed
              </small>
            </span>
          </div>
          <div className="curriculum-layout">
            <nav className="curriculum-rail" aria-label="Curriculum stages">
              {stages.map((item, index) => {
                const count = item.questionIds.filter((id) => {
                  const q = session.questions.find((q) => q.id === id);
                  return q && getDraft(q, session).completed;
                }).length;
                return (
                  <button
                    key={item.id}
                    className="stage-choice"
                    aria-pressed={selectedStage === index}
                    onClick={() => setSelectedStage(index)}
                  >
                    <span className="stage-number">
                      {count === item.questionIds.length ? (
                        <Check size={14} />
                      ) : (
                        String(index + 1).padStart(2, "0")
                      )}
                    </span>
                    <span>{item.title}</span>
                    <ChevronRight size={14} />
                  </button>
                );
              })}
            </nav>
            <section className="stage-detail" aria-label={stage.title}>
              <span className="learning-eyebrow">
                Stage {selectedStage + 1} of {stages.length}
              </span>
              <h2>{stage.title}</h2>
              <p>{stage.objective}</p>
              <div className="stage-milestone">
                <span>Milestone</span>
                <p>{stage.milestone}</p>
              </div>
              <div className="stage-exercises">
                {stage.questionIds.map((id, index) => {
                  const q = session.questions.find((item) => item.id === id);
                  return q ? (
                    row(q)
                  ) : (
                    <div className="uninstalled-task" key={id}>
                      <span>{index + 1}</span>
                      <span>{activities.find((item) => item.id === id)?.title}</span>
                      <small>Add path to begin</small>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </>
      )}
      {view === "library" && (
        <>
          <div className="library-heading">
            <div>
              <h2>Your practice library</h2>
            </div>
            <label className="learning-search">
              <Search size={15} aria-hidden="true" />
              <input
                aria-label="Search library"
                placeholder="Search exercises or sources"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>
          <div className="subject-filters" role="group" aria-label="Filter by subject">
            {[
              ...new Set([
                "All",
                "Research",
                "Training",
                ...session.questions.map((q) => q.topic),
                ...libraryEntries.map((entry) => entry.subject),
              ]),
            ].map((item) => (
              <button key={item} aria-pressed={subject === item} onClick={() => setSubject(item)}>
                {item}
              </button>
            ))}
          </div>
          <section className="library-owned">
            <div className="section-label">
              Exercises <span>{visibleQuestions.length}</span>
            </div>
            {visibleQuestions.length ? (
              <div className="owned-rows">{visibleQuestions.map(row)}</div>
            ) : (
              <p className="quiet-empty">
                {session.questions.length
                  ? "No activities match these filters."
                  : "Your library is ready. Ask your AI CLI to create questions on any topic in your workspace folder, or choose an activity below."}
              </p>
            )}
          </section>
          <section>
            <div className="section-label">Sources</div>
            <div className="source-grid">{visibleEntries.map(sourceCard)}</div>
            {!visibleEntries.length && (
              <p className="quiet-empty">
                {subject === "Research" || subject === "Training"
                  ? "Add this learning path from the AI research or GPU programming tab."
                  : "No source activities match. Try another search or subject."}
              </p>
            )}
          </section>
        </>
      )}
      {view === "review" && (
        <section className="review-section">
          <div className="library-heading">
            <div>
              <h2>Review</h2>
              <p>Saved questions, unfinished attempts and practice that used help.</p>
            </div>
          </div>
          {review.length ? (
            <div className="review-list">
              {review.map((q) => {
                const draft = getDraft(q, session);
                return (
                  <article className="review-card" key={q.id}>
                    <div>
                      <span className="learning-eyebrow">{reviewReason(q, draft)}</span>
                      <h3>{q.title}</h3>
                      <p>
                        {q.topic} · {draft.attempts?.length || 0} recorded attempts
                      </p>
                    </div>
                    <div className="review-actions">
                      <button className="button secondary" onClick={() => open(q)}>
                        Resume
                      </button>
                      <button
                        className="button primary"
                        onClick={() => {
                          updateDraft(q, freshAttempt(draft, q));
                          open(q);
                        }}
                      >
                        Start fresh <ArrowRight size={14} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="review-empty">
              <CheckCircle2 size={28} strokeWidth={1.3} />
              <h3>Nothing to review</h3>
              <p>
                Use “Review later” on any question. Assisted attempts and mistakes will appear here
                too.
              </p>
              <button className="button secondary" onClick={() => setView("library")}>
                Choose an activity <ArrowRight size={14} />
              </button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
