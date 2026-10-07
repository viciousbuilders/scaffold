"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Terminal, XCircle } from "lucide-react";
import type { Feedback, Question } from "@/core/schemas";
import type { ExecutionResult } from "@/core/execution";

export function Results({
  result,
  feedback,
  submitted,
  tests,
}: {
  result: ExecutionResult | null;
  feedback: Feedback | null;
  submitted: boolean;
  tests?: Question["tests"];
}) {
  const [tab, setTab] = useState<"cases" | "result" | null>(null);
  const [caseIndex, setCaseIndex] = useState(0);
  const activeTab = tab || (result || feedback ? "result" : "cases");
  const currentCase = tests?.[Math.min(caseIndex, tests.length - 1)];
  const passed = result?.tests.filter((test) => test.passed).length || 0;
  return (
    <section className="results-panel" aria-label="Execution results">
      <div className="results-heading">
        {tests ? (
          <div className="console-tabs" role="tablist" aria-label="Console">
            {(["cases", "result"] as const).map((value) => (
              <button
                key={value}
                role="tab"
                aria-selected={activeTab === value}
                onClick={() => setTab(value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                    event.preventDefault();
                    const next = value === "cases" ? "result" : "cases";
                    setTab(next);
                    (
                      event.currentTarget.parentElement?.querySelectorAll("button")[
                        next === "cases" ? 0 : 1
                      ] as HTMLButtonElement
                    )?.focus();
                  }
                }}
                tabIndex={activeTab === value ? 0 : -1}
              >
                {value === "cases" ? "Test cases" : "Result"}
              </button>
            ))}
          </div>
        ) : (
          <>
            <Terminal size={14} />
            <h3>{submitted ? "Submission" : "Test results"}</h3>
          </>
        )}
        {result && !result.error && (
          <span className="muted">
            {passed}/{result.tests.length} passed
          </span>
        )}
      </div>
      <div className="results-content" aria-live="polite">
        {tests && activeTab === "cases" ? (
          <div>
            <div className="case-picker">
              {tests.map((test, index) => (
                <button
                  key={index}
                  aria-pressed={caseIndex === index}
                  onClick={() => setCaseIndex(index)}
                >
                  Case {index + 1}
                </button>
              ))}
            </div>
            <span className="muted small">{currentCase?.label}</span>
            <pre className="case-expression">{currentCase?.expression}</pre>
          </div>
        ) : (
          <>
            {!result && !feedback && (
              <div className="results-empty">
                <Circle size={14} />
                <span>Run your code to see results.</span>
              </div>
            )}
            {feedback && (
              <div className={`feedback ${feedback.correct ? "correct" : "incorrect"}`}>
                {feedback.correct ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
                <div>
                  <strong>{feedback.correct ? "Accepted" : "Not quite"}</strong>
                  <p>{feedback.feedback}</p>
                </div>
              </div>
            )}
            {result?.error && <pre className="runtime-error">{result.error}</pre>}
            {result?.tests.map((test, index) => (
              <details className={`test-result ${test.passed ? "passed" : "failed"}`} key={index}>
                <summary>
                  {test.passed ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  <span>{test.label}</span>
                  <span>{test.passed ? "Passed" : "Failed"}</span>
                </summary>
                {test.error && <pre>{test.error}</pre>}
              </details>
            ))}
            {result?.output && (
              <div className="stdout">
                <span className="field-label">Output</span>
                <pre>{result.output}</pre>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
