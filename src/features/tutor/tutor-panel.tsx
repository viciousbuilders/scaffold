"use client";

import { ChevronDown, ChevronUp, Lightbulb, LoaderCircle, MessageCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { tutorResponseSchema, type Message, type Question } from "@/core/schemas";
import { tutorProblem } from "@/core/tutor-context";
import { getDraft, updateDraft, useSession } from "@/features/session/store";
import { postApi } from "@/ui/api";
import { Composer } from "@/ui/composer";
import { Markdown } from "@/ui/markdown";

export function TutorPanel({ question }: { question: Question }) {
  const session = useSession();
  const draft = getDraft(question, session);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    const element = transcriptRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [draft.tutorMessages.length, busy]);

  async function requestReply(messages: Message[]) {
    setBusy(true);
    setError("");
    const abort = new AbortController();
    abortRef.current = abort;
    const attempt =
      question.kind === "quiz"
        ? draft.answer === ""
          ? "No selection"
          : question.options[Number(draft.answer)] || "No selection"
        : `${draft.answer}\n\nWorking: ${draft.working}`;
    try {
      const result = await postApi(
        "tutor",
        { problem: tutorProblem(question), attempt, messages: messages.slice(-30) },
        tutorResponseSchema,
        abort.signal,
      );
      updateDraft(question, {
        tutorMessages: [...messages, { role: "assistant", content: result.reply }],
      });
    } catch (cause) {
      if (!abort.signal.aborted)
        setError(
          cause instanceof Error ? cause.message : "Couldn't reach your tutor. Please try again.",
        );
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  function send() {
    if (!input.trim() || busy) return;
    const messages: Message[] = [...draft.tutorMessages, { role: "user", content: input.trim() }];
    updateDraft(question, { tutorMessages: messages });
    setInput("");
    void requestReply(messages);
  }
  function getHint() {
    if (draft.hintCount >= question.hints.length || busy) return;
    const hint = question.hints[draft.hintCount];
    updateDraft(question, (previous) => ({
      ...previous,
      hintCount: previous.hintCount + 1,
      tutorMessages: [...previous.tutorMessages, { role: "assistant", content: hint }],
    }));
  }

  return (
    <section className={`tutor-panel ${open ? "open" : ""}`}>
      <button
        className="tutor-toggle"
        aria-expanded={open}
        aria-controls="tutor-content"
        onClick={() => setOpen(!open)}
      >
        <span className="tutor-toggle-label">
          <MessageCircle size={18} aria-hidden="true" />
          <strong>Ask the tutor</strong>
        </span>
        {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>
      {open && (
        <div id="tutor-content">
          <div className="tutor-transcript" ref={transcriptRef}>
            <div className="tutor-intro">
              <button
                className="hint-button"
                disabled={busy || draft.hintCount >= question.hints.length}
                onClick={getHint}
              >
                <Lightbulb size={14} />
                {draft.hintCount ? "Next hint" : "Show hint"}
                <span>
                  {draft.hintCount}/{question.hints.length}
                </span>
              </button>
            </div>
            {draft.tutorMessages.map((message, index) => (
              <div className={`tutor-message ${message.role}`} key={index}>
                <div className="message-name">{message.role === "user" ? "You" : "Tutor"}</div>
                <Markdown>{message.content}</Markdown>
              </div>
            ))}
            {busy && (
              <div className="thinking" role="status">
                <LoaderCircle className="spin" size={14} /> Thinking…
              </div>
            )}
          </div>
          <div className="tutor-composer">
            {error && (
              <div className="error-notice" role="alert">
                {error}
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => void requestReply(draft.tutorMessages)}
                >
                  Retry
                </button>
              </div>
            )}
            <Composer
              value={input}
              onChange={setInput}
              onSend={send}
              busy={busy}
              label="Message your tutor"
              placeholder="Ask about this question…"
              compact
            />
          </div>
        </div>
      )}
    </section>
  );
}
