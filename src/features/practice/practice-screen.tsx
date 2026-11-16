"use client";

import { useState } from "react";
import { TutorPanel } from "@/features/tutor/tutor-panel";
import { FolderOpen, MessageCircle } from "lucide-react";
import { useSession, useWorkspacePath } from "@/features/session/store";
import { AnswerPane } from "./answer-pane";
import { QuestionPane } from "./question-pane";

export function PracticeScreen() {
  const session = useSession();
  const [tutorOpen, setTutorOpen] = useState(false);
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
      <div className="practice-modebar">
        <span>{question.topic}</span>
        <button
          className="text-button"
          aria-expanded={tutorOpen}
          aria-controls="practice-tutor"
          onClick={() => setTutorOpen(!tutorOpen)}
        >
          <MessageCircle size={14} />
          {tutorOpen ? "Hide tutor" : "Tutor"}
        </button>
      </div>
      <div className={`practice-workspace ${tutorOpen ? "with-tutor" : ""}`}>
        <QuestionPane key={`question-${question.id}`} question={question} index={index} />
        <AnswerPane key={`answer-${question.id}`} question={question} />
        <aside id="practice-tutor" className="practice-tutor" hidden={!tutorOpen}>
          <TutorPanel
            key={question.id}
            question={question}
            expanded={tutorOpen}
            onToggle={() => setTutorOpen(false)}
          />
        </aside>
      </div>
    </main>
  );
}
