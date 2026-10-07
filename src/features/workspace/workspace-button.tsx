"use client";
import { useId, useState } from "react";
import { FolderOpen, LoaderCircle, ChevronDown } from "lucide-react";
import { useWorkspacePath, applyWorkspace, flushProgress } from "@/features/session/store";
import { selectWorkspace } from "./client";

export function WorkspaceButton() {
  const path = useWorkspacePath();
  const pathDescriptionId = useId();
  const displayPath = path.replace(/^\/Users\/[^/]+(?=\/)/, "~");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function open() {
    setBusy(true);
    setError("");
    try {
      await flushProgress();
      const workspace = await selectWorkspace();
      if (workspace) applyWorkspace(workspace);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't open the folder.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="workspace-switch">
      <button
        className="navbar-control workspace-folder-button"
        aria-label="Open questions folder"
        aria-describedby={pathDescriptionId}
        aria-busy={busy}
        title={displayPath || "Open questions folder"}
        disabled={busy}
        onClick={() => void open()}
      >
        {busy ? (
          <LoaderCircle className="spin navbar-control-icon" size={16} aria-hidden="true" />
        ) : (
          <FolderOpen className="navbar-control-icon" size={16} aria-hidden="true" />
        )}
        <span className="navbar-control-label">Questions</span>
        <ChevronDown
          className="navbar-control-chevron workspace-chevron"
          size={12}
          aria-hidden="true"
        />
      </button>
      <span id={pathDescriptionId} className="sr-only">
        {displayPath || "Choose a folder of questions"}
      </span>
      {error && (
        <div className="workspace-switch-error error-notice" role="alert">
          {error}
          <button className="text-button" onClick={() => setError("")}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
