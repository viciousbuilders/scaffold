"use client";

import { Lightbulb, LockKeyhole } from "lucide-react";
import { useState } from "react";
import type { Question } from "@/core/schemas";
import { getDraft, updateDraft, useSession } from "@/features/session/store";
import { TutorPanel } from "@/features/tutor/tutor-panel";
import { Markdown } from "@/ui/markdown";

export function QuestionPane({ question, index }: { question: Question; index: number }) {
  const session = useSession();
  const draft = getDraft(question, session);
  const [tab, setTab] = useState<"description" | "hints" | "solution">("description");
  return (
    <section className="question-pane" aria-label="Question definition">
      <div className="question-tabs" role="tablist" aria-label="Question details">
        {(["description", "hints", "solution"] as const).map((value) => (
          <button
            key={value}
            id={`tab-${value}`}
            role="tab"
            aria-selected={tab === value}
            tabIndex={tab === value ? 0 : -1}
            aria-controls="question-tab-content"
            onClick={() => setTab(value)}
            onKeyDown={(event) => {
              const tabs = ["description", "hints", "solution"] as const;
              const index = tabs.indexOf(value);
              const next =
                event.key === "ArrowRight"
                  ? tabs[(index + 1) % tabs.length]
                  : event.key === "ArrowLeft"
                    ? tabs[(index + tabs.length - 1) % tabs.length]
                    : event.key === "Home"
                      ? tabs[0]
                      : event.key === "End"
                        ? tabs[2]
                        : null;
              if (next) {
                event.preventDefault();
                setTab(next);
                document.getElementById(`tab-${next}`)?.focus();
              }
            }}
          >
            {value[0].toUpperCase() + value.slice(1)}
            {value === "hints" && (
              <span className="hint-count">
                {draft.hintCount}/{question.hints.length}
              </span>
            )}
          </button>
        ))}
      </div>
      <div
        className="question-scroll"
        id="question-tab-content"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
      >
        <div className="question-title">
          <div className="question-meta">
            <span className={`badge difficulty ${question.difficulty.toLowerCase()}`}>
              {question.difficulty}
            </span>
            <span>{question.topic}</span>
            <span aria-hidden="true">·</span>
            <span>
              {question.kind === "coding"
                ? "Coding"
                : question.kind === "quiz"
                  ? "Quiz"
                  : "Written"}
            </span>
          </div>
          <h1>
            <span>{index + 1}.</span> {question.title}
          </h1>
        </div>
        {tab === "description" && (
          <>
            <Markdown>{question.description}</Markdown>
            {question.examples.map((example, i) => (
              <div className="example" key={i}>
                <h2>Example {i + 1}</h2>
                <div className="example-values">
                  <p>
                    <strong>Input</strong>
                    <code>{example.input}</code>
                  </p>
                  <p>
                    <strong>Output</strong>
                    <code>{example.output}</code>
                  </p>
                </div>
                <p className="example-explanation">{example.explanation}</p>
              </div>
            ))}
            {question.constraints.length > 0 && (
              <div className="constraints">
                <h2>Constraints</h2>
                <ul>
                  {question.constraints.map((constraint, i) => (
                    <li key={i}>
                      <Markdown>{constraint}</Markdown>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        {tab === "hints" && (
          <div className="hint-content">
            {question.hints.slice(0, draft.hintCount).map((hint, i) => (
              <div className="revealed-hint" key={i}>
                <span>Hint {i + 1}</span>
                <Markdown>{hint}</Markdown>
              </div>
            ))}
            <button
              className="button secondary"
              disabled={draft.hintCount >= question.hints.length}
              onClick={() => updateDraft(question, { hintCount: draft.hintCount + 1 })}
            >
              <Lightbulb size={15} />
              {draft.hintCount >= question.hints.length
                ? "All hints revealed"
                : draft.hintCount
                  ? "Reveal next hint"
                  : "Reveal first hint"}
            </button>
          </div>
        )}
        {tab === "solution" &&
          (draft.revealed ? (
            <div className="solution-content">
              <span className="badge subtle">Solution revealed</span>
              <Markdown>
                {question.kind === "coding"
                  ? `\`\`\`${question.language}\n${question.solution}\n\`\`\``
                  : question.solution}
              </Markdown>
              <h2>Why it works</h2>
              <Markdown>{question.explanation}</Markdown>
            </div>
          ) : (
            <div className="solution-gate">
              <LockKeyhole size={25} />
              <h2>Reveal the solution?</h2>
              <p>This marks the question as assisted.</p>
              <button
                className="button secondary"
                onClick={() => updateDraft(question, { revealed: true })}
              >
                Reveal solution
              </button>
            </div>
          ))}
      </div>
      <TutorPanel question={question} />
    </section>
  );
}
