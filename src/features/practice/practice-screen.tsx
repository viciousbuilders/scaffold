"use client";

import { FolderOpen } from "lucide-react";
import { useSession, useWorkspacePath } from "@/features/session/store";
import { AnswerPane } from "./answer-pane";
import { QuestionPane } from "./question-pane";

export function PracticeScreen() {
  const session = useSession();
  const path = useWorkspacePath();
  const index = Math.min(session.activeIndex, Math.max(0, session.questions.length - 1));
  const question = session.questions[index];

  if (!question)
    return (
      <main id="main-content" className="practice-empty">
        <FolderOpen size={32} strokeWidth={1.4} />
        <h1>No questions yet.</h1>
        <p>
          Open this folder in Codex and create <code>questions.json</code>. The included{" "}
          <code>SCAFFOLD.md</code> explains the format.
        </p>
        <code className="empty-workspace-path">{path}</code>
        <button
          className="button secondary"
          onClick={() => void window.scaffoldDesktop?.revealWorkspace(path)}
        >
          Show in Finder
        </button>
      </main>
    );

  return (
    <main id="main-content" className="practice-screen">
      <div className="practice-workspace">
        <QuestionPane key={`question-${question.id}`} question={question} index={index} />
        <AnswerPane key={`answer-${question.id}`} question={question} />
      </div>
    </main>
  );
}
