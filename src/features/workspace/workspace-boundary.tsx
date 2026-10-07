"use client";
import { useEffect, useState } from "react";
import { FolderOpen, LoaderCircle } from "lucide-react";
import { initializeWorkspace, refreshWorkspace, flushProgress } from "@/features/session/store";

export function WorkspaceBoundary({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    window.scaffoldFlushProgress = flushProgress;
    let disposed = false;
    initializeWorkspace()
      .then(() => {
        if (!disposed) setReady(true);
      })
      .catch((cause) => {
        if (!disposed) setError(cause.message);
      });
    const timer = setInterval(() => {
      if (!document.hidden) void refreshWorkspace();
    }, 3000);
    const flush = () => {
      void flushProgress();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      delete window.scaffoldFlushProgress;
      disposed = true;
      clearInterval(timer);
      window.removeEventListener("pagehide", flush);
    };
  }, []);
  if (!ready)
    return (
      <main id="main-content" className="practice-empty">
        {error ? <FolderOpen size={32} /> : <LoaderCircle className="spin" size={28} />}
        <h1>{error ? "Couldn't open the workspace" : "Opening your workspace"}</h1>
        {error && (
          <>
            <p role="alert">{error}</p>
            <button className="button secondary" onClick={() => location.reload()}>
              Retry
            </button>
          </>
        )}
      </main>
    );
  return children;
}
