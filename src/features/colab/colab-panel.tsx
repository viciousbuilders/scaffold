"use client";
import { useEffect, useRef, useState } from "react";
import { Cloud, Play, Square, Unplug, LoaderCircle } from "lucide-react";
import { colabStatusSchema, type ColabStatus } from "@/core/colab";
import type { Question } from "@/core/schemas";
import { postApi } from "@/ui/api";
import { getDraft, updateDraft, useSession } from "@/features/session/store";
import { withAttempt } from "@/core/practice-progress";
const empty: ColabStatus = {
  configured: false,
  connected: false,
  phase: "idle",
  output: "",
  error: null,
  succeeded: null,
  generation: 0,
};
export function ColabPanel({ question }: { question: Question }) {
  const session = useSession();
  const draft = getDraft(question, session);
  const [status, setStatus] = useState(empty);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [runCode, setRunCode] = useState<string | null>(null);
  const captured = useRef<typeof draft | null>(null);
  const mounted = useRef(true);
  const last = useRef<ColabStatus | null>(null);
  useEffect(() => {
    mounted.current = true;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const value = await postApi("colab", { action: "status" }, colabStatusSchema);
        if (!disposed) {
          setStatus(value);
          last.current = value;
        }
      } catch {
        if (!disposed) setMessage("Colab status unavailable. Reopen the app to retry.");
      } finally {
        if (!disposed) timer = setTimeout(poll, last.current?.phase !== "idle" ? 600 : 4000);
      }
    }
    void poll();
    return () => {
      disposed = true;
      mounted.current = false;
      clearTimeout(timer);
    };
  }, []);
  async function action(action: "connect" | "disconnect" | "run" | "stop") {
    setPending(true);
    setMessage("");
    if (action === "run") {
      setRunCode(draft.answer);
      captured.current = { ...draft };
    }
    try {
      const value = await postApi(
        "colab",
        {
          action,
          ...(action === "run"
            ? {
                questionId: question.id,
                code: draft.answer,
                language: question.language === "cuda" ? "cuda" : "python",
              }
            : {}),
        },
        colabStatusSchema,
      );
      if (mounted.current) setStatus(value);
    } catch (error) {
      if (mounted.current)
        setMessage(error instanceof Error ? error.message : "Colab request failed.");
    } finally {
      if (mounted.current) setPending(false);
    }
  }
  const active = status.phase !== "idle";
  function saveRun() {
    if (runCode === null) return;
    updateDraft(question, (previous) => {
      const recorded = withAttempt(
        {
          ...captured.current!,
          answer: runCode,
          working:
            `Colab T4 run\n${status.output}\n${status.error || "Process completed without a reported exception."}`.slice(
              -10000,
            ),
          attempts: previous.attempts,
        },
        null,
        "self-review",
      );
      return { ...previous, attempts: recorded.attempts };
    });
    setRunCode(null);
    setMessage("Run saved.");
  }
  return (
    <section className="colab-panel" aria-label="Colab GPU runtime">
      <div className="colab-heading">
        <span>
          <Cloud size={15} /> Colab GPU{" "}
          <small>
            {status.connected
              ? "T4 · connected"
              : status.configured
                ? "Free tier · disconnected"
                : "Connection not configured"}
          </small>
        </span>
        <div>
          {active ? <LoaderCircle size={14} className="spin" /> : null}
          {!status.connected ? (
            <button
              className="button secondary"
              disabled={!status.configured || pending || active}
              onClick={() => void action("connect")}
            >
              Connect GPU
            </button>
          ) : null}
          {status.configured && status.phase === "idle" ? (
            <button
              className="button primary"
              disabled={pending || !draft.answer.trim()}
              onClick={() => void action("run")}
            >
              <Play size={13} /> Run on GPU
            </button>
          ) : null}
          {status.phase === "running" ? (
            <button
              className="button secondary"
              disabled={pending}
              onClick={() => void action("stop")}
            >
              <Square size={13} /> Stop run
            </button>
          ) : null}
          <button
            className="button secondary"
            disabled={!status.configured || pending || active}
            onClick={() => void action("disconnect")}
          >
            <Unplug size={13} /> Release GPU
          </button>
        </div>
      </div>
      <p>
        {status.phase === "connecting"
          ? "Colab is provisioning your T4. This can take a few minutes."
          : status.phase === "running"
            ? "Executing remotely. You can leave this activity and return to view the output."
            : "Auto-releases on close or after 5 minutes idle."}
      </p>
      {(status.output || status.error) && (
        <pre className="colab-output" aria-label="Live GPU output">
          {status.output}
          {status.error ? `\n${status.error}` : ""}
        </pre>
      )}
      {message && <p role="status">{message}</p>}
      {runCode !== null && !active && status.generation > 0 && (
        <button className="text-button" disabled={status.succeeded !== true} onClick={saveRun}>
          Save successful run to history
        </button>
      )}
      {!status.configured && <p>Connect your Google account using Scaffold’s local Colab setup.</p>}
    </section>
  );
}
