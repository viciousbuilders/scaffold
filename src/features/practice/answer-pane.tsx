"use client";

import dynamic from "next/dynamic";
import {
  Braces,
  Check,
  CheckCircle2,
  LoaderCircle,
  PencilLine,
  Play,
  RotateCcw,
  Square,
} from "lucide-react";
import { useRef, useState, useEffect } from "react";
import type { Question } from "@/core/schemas";
import { feedbackSchema } from "@/core/schemas";
import { gradeAnswer } from "@/core/grading";
import { getDraft, updateDraft, useSession } from "@/features/session/store";
import { postApi } from "@/ui/api";
import { useCodeRunner } from "./use-code-runner";
import { LANGUAGE_LABELS, type ExecutionResult } from "@/core/execution";
import { PracticeActions } from "@/ui/practice-actions";
import { Results } from "./results";

const CodeEditor = dynamic(() => import("./code-editor"), {
  ssr: false,
  loading: () => <div className="editor-loading">Loading editor…</div>,
});

export function AnswerPane({ question }: { question: Question }) {
  const session = useSession();
  const draft = getDraft(question, session);
  const { run, stop, phase, capability } = useCodeRunner(question.language);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
    };
  }, []);
  const busy = phase !== "idle" || submitting;

  function edit(answer: string) {
    updateDraft(question, { answer, feedback: null });
    setResult(null);
    setSubmitted(false);
    setError("");
  }

  async function check(isSubmit: boolean) {
    if (busy || (question.kind === "coding" && !capability.available)) return;
    setError("");
    setSubmitted(isSubmit);
    if (question.kind === "coding") {
      const output = await run(draft.answer, question.tests);
      if (!mounted.current) return;
      setResult(output);
      if (isSubmit) {
        const correct =
          !output.error &&
          output.tests.length === question.tests.length &&
          output.tests.every((test) => test.passed);
        updateDraft(question, (previous) => ({
          ...previous,
          completed: previous.completed || (correct && !previous.revealed),
          feedback: {
            correct,
            feedback: correct
              ? draft.revealed
                ? "All tests passed. Solution was revealed."
                : "All tests passed."
              : "Some tests failed.",
          },
        }));
      }
      return;
    }
    if (!draft.answer.trim()) {
      setError("Add your answer before submitting.");
      return;
    }
    setSubmitting(true);
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const feedback =
        gradeAnswer(question, draft.answer) ??
        (await postApi(
          "grade",
          { question, answer: `${draft.answer}\n\nWorking: ${draft.working}` },
          feedbackSchema,
          abort.signal,
        ));
      updateDraft(question, (previous) => ({
        ...previous,
        feedback,
        completed: previous.completed || (feedback.correct && !previous.revealed),
      }));
    } catch (cause) {
      if (!abort.signal.aborted)
        setError(
          cause instanceof Error ? cause.message : "Couldn't check your answer. Please try again.",
        );
    } finally {
      if (!abort.signal.aborted) setSubmitting(false);
    }
  }

  function reset() {
    if (busy) return;
    setResult(null);
    setError("");
    setSubmitted(false);
    updateDraft(question, { answer: question.starterCode, working: "", feedback: null });
  }

  return (
    <section className={`answer-pane answer-${question.kind}`} aria-label="Answer workspace">
      <div className="pane-toolbar">
        <div className="pane-label">
          {question.kind === "coding" ? <Braces size={15} /> : <PencilLine size={15} />}
          <h2>
            {question.kind === "coding"
              ? "Code"
              : question.kind === "quiz"
                ? "Choose your answer"
                : "Your answer"}
          </h2>
        </div>
        <div className="toolbar-actions">
          <span className="muted small">
            {question.kind === "coding"
              ? LANGUAGE_LABELS[question.language]
              : question.kind === "quiz"
                ? "Single choice"
                : "Written"}
          </span>
          <button
            className="icon-button"
            aria-label="Reset answer"
            title="Reset answer"
            disabled={busy}
            onClick={reset}
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>
      <div className="answer-content">
        {question.kind === "coding" ? (
          <div className="editor-wrapper">
            <CodeEditor
              value={draft.answer}
              language={question.language}
              onChange={edit}
              theme={session.theme}
              readOnly={busy}
            />
          </div>
        ) : question.kind === "quiz" ? (
          <fieldset className="quiz-options" disabled={busy}>
            <legend className="sr-only">Choose one answer</legend>
            {question.options.map((option, index) => (
              <label
                className={`quiz-option ${draft.answer === String(index) ? "selected" : ""}`}
                key={index}
              >
                <input
                  type="radio"
                  name={question.id}
                  value={index}
                  checked={draft.answer === String(index)}
                  onChange={() => edit(String(index))}
                />
                <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                <span>{option}</span>
                {draft.answer === String(index) && <Check size={16} />}
              </label>
            ))}
          </fieldset>
        ) : (
          <div className="written-answer">
            <label className="field-label" htmlFor="written-answer">
              {question.numericAnswer !== null ? "Final answer" : "Your explanation"}
            </label>
            {question.numericAnswer !== null ? (
              <input
                id="written-answer"
                disabled={busy}
                value={draft.answer}
                onChange={(event) => edit(event.target.value)}
                placeholder="e.g. 1/4, 0.25 or 25%"
                autoComplete="off"
              />
            ) : (
              <textarea
                id="written-answer"
                rows={6}
                disabled={busy}
                value={draft.answer}
                onChange={(event) => edit(event.target.value)}
                placeholder="Your explanation…"
                maxLength={10000}
              />
            )}
          </div>
        )}
        {question.kind === "written" && (
          <div className="working-area">
            <label className="field-label" htmlFor="working">
              Your working <span className="muted">(optional)</span>
            </label>
            <textarea
              id="working"
              disabled={busy}
              value={draft.working}
              onChange={(event) => updateDraft(question, { working: event.target.value })}
              placeholder="Notes and calculations…"
              rows={6}
              maxLength={10000}
            />
          </div>
        )}
        {question.kind !== "coding" && draft.feedback && (
          <Results result={null} feedback={draft.feedback} submitted={submitted} />
        )}
      </div>
      {question.kind === "coding" && (
        <div className="editor-status">
          <span>Spaces: {question.language === "javascript" ? 2 : 4}</span>
          <span>
            {question.language === "python"
              ? "Pyodide · standard library"
              : question.language === "javascript"
                ? "Browser worker"
                : question.language === "cpp"
                  ? "Local C++17 compiler"
                  : "NVIDIA CUDA"}
          </span>
        </div>
      )}
      {question.kind === "coding" ? (
        <Results
          result={result}
          feedback={draft.feedback}
          submitted={submitted}
          tests={question.kind === "coding" ? question.tests : undefined}
        />
      ) : null}
      <div className="answer-footer">
        {question.kind === "coding" && !capability.available && (
          <div className="muted small" role="status">
            {capability.message}
          </div>
        )}
        {error && (
          <div className="error-notice" role="alert">
            {error}
          </div>
        )}
        <div className="answer-actions">
          <span className="saved-note">
            {draft.completed ? (
              <>
                <CheckCircle2 size={13} /> Completed
              </>
            ) : (
              <>
                <Check size={13} /> Saved
              </>
            )}
          </span>
          <PracticeActions>
            {busy && (
              <span className="running-label" role="status">
                {phase === "loading"
                  ? `Loading ${LANGUAGE_LABELS[question.language]}…`
                  : "Checking…"}
              </span>
            )}
            {phase !== "idle" && (
              <button className="button secondary" onClick={stop}>
                <Square size={13} /> Stop
              </button>
            )}
            {question.kind === "coding" && (
              <button
                className="button secondary"
                disabled={busy || !capability.available}
                onClick={() => void check(false)}
              >
                <Play size={14} /> Run
              </button>
            )}
            <button
              className="button primary"
              disabled={busy || (question.kind === "coding" && !capability.available)}
              onClick={() => void check(true)}
            >
              {busy ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />} Submit
            </button>
          </PracticeActions>
        </div>
      </div>
    </section>
  );
}
