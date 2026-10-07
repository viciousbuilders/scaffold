"use client";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, CircleDot, Search } from "lucide-react";
import { useState } from "react";
import { getDraft, updateSession, useSession } from "@/features/session/store";
import type { Question } from "@/core/schemas";
import { PracticeScreen } from "./practice-screen";

const formats = [
  { value: "all", label: "All" },
  { value: "coding", label: "Coding" },
  { value: "written", label: "Written" },
  { value: "quiz", label: "Quiz" },
] as const;
export function ProblemSet() {
  const session = useSession();
  const [format, setFormat] = useState<string>("all");
  const [search, setSearch] = useState("");
  if (!session.questions.length) return <PracticeScreen />;
  const solved = session.questions.filter((q) => getDraft(q, session).completed).length;
  const isAttempted = (q: Question) => {
    const draft = getDraft(q, session);
    return (
      !draft.completed &&
      ((draft.answer !== q.starterCode && draft.answer !== "") ||
        draft.working !== "" ||
        draft.hintCount > 0 ||
        draft.revealed ||
        !!draft.feedback)
    );
  };
  const attempted = session.questions.filter(isAttempted).length;
  const current = session.questions[Math.min(session.activeIndex, session.questions.length - 1)];
  const topics = [...new Set(session.questions.map((q) => q.topic))];
  const visible = (q: Question) =>
    (format === "all" || q.kind === format) &&
    `${q.title} ${q.topic}`.toLowerCase().includes(search.toLowerCase());
  const filtered = session.questions.filter(visible);
  return (
    <main id="main-content" className="problem-set">
      <div className="problem-set-content">
        <div className="problem-set-intro">
          <div className="set-meta">
            {session.curriculum?.level || "Personal practice"}
            <span>/</span>
            {session.questions.length} problems
          </div>
          <h1>{session.curriculum?.title || "Your problem set"}</h1>
        </div>
        <div className="set-progress">
          <div className="set-progress-overview">
            <div>
              <strong>
                {solved}
                <span> / {session.questions.length}</span>
              </strong>
              <span>solved · {attempted} attempted</span>
            </div>
          </div>
          <div className="resume-problem">
            <span>Continue</span>
            <Link className="button primary" href="/practice">
              {current.title}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className="problem-filters">
          <div className="format-filter" role="group" aria-label="Filter by format">
            {formats.map((f) => (
              <button
                key={f.value}
                aria-pressed={format === f.value}
                onClick={() => setFormat(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="problem-search">
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">Search problems</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search problems"
            />
          </label>
        </div>
        <div className="problem-groups">
          {topics.map((topic, groupIndex) => {
            const all = session.questions.filter((q) => q.topic === topic);
            const rows = all.filter(visible);
            if (!rows.length) return null;
            return (
              <section key={topic} className="problem-group">
                <div className="problem-group-heading">
                  <span>{String(groupIndex + 1).padStart(2, "0")}</span>
                  <h2>{topic}</h2>
                  <span className="group-progress">
                    {all.filter((q) => getDraft(q, session).completed).length}/{all.length}
                  </span>
                </div>
                <div className="problem-rows">
                  {rows.map((q) => {
                    const index = session.questions.indexOf(q);
                    const draft = getDraft(q, session);
                    const started = isAttempted(q);
                    return (
                      <Link
                        href="/practice"
                        key={q.id}
                        className="problem-row"
                        onClick={() => updateSession({ activeIndex: index })}
                      >
                        <span
                          className={`problem-status ${draft.completed ? "solved" : started ? "attempted" : ""}`}
                          title={draft.completed ? "Solved" : started ? "Attempted" : "Not started"}
                        >
                          {draft.completed ? (
                            <CheckCircle2 size={16} />
                          ) : started ? (
                            <CircleDot size={16} />
                          ) : (
                            <Circle size={16} />
                          )}
                          <span className="sr-only">
                            {draft.completed ? "Solved" : started ? "Attempted" : "Not started"}
                          </span>
                        </span>
                        <span className="row-number">{String(index + 1).padStart(2, "0")}</span>
                        <span className="row-title">{q.title}</span>
                        <span className="row-format">
                          {q.kind === "coding" ? "Coding" : q.kind === "quiz" ? "Quiz" : "Written"}
                        </span>
                        <span className={`row-difficulty ${q.difficulty.toLowerCase()}`}>
                          {q.difficulty}
                        </span>
                        <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
        {!filtered.length && (
          <div className="no-matches">
            No matching problems.
            <button
              className="text-button"
              onClick={() => {
                setSearch("");
                setFormat("all");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
