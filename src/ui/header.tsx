"use client";

import Link from "next/link";
import { WorkspaceButton } from "@/features/workspace/workspace-button";
import { usePathname } from "next/navigation";
import { PracticeActionsSlot } from "./practice-actions";
import { Moon, Sun, List, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";
import { AiSettingsMenu } from "@/features/ai/ai-settings";
import { useSession, updateSession, useStorageError } from "@/features/session/store";

export function Header() {
  const session = useSession();
  const practicing = usePathname() === "/practice";
  const index = Math.min(session.activeIndex, Math.max(0, session.questions.length - 1));
  const storageError = useStorageError();
  useEffect(() => {
    document.documentElement.dataset.theme = session.theme;
  }, [session.theme]);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="app-header">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>scaffold</span>
        </Link>
        {practicing && session.questions.length > 0 && (
          <div className="header-navigation">
            <Link href="/" className="problems-link">
              <List size={16} aria-hidden="true" /> Problems
            </Link>
            <button
              className="icon-button"
              aria-label="Previous question"
              disabled={index === 0}
              onClick={() => updateSession({ activeIndex: index - 1 })}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="problem-position">
              {index + 1} / {session.questions.length}
            </span>
            <button
              className="icon-button"
              aria-label="Next question"
              disabled={index >= session.questions.length - 1}
              onClick={() => updateSession({ activeIndex: index + 1 })}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
        <PracticeActionsSlot />
        <div className="header-right">
          <WorkspaceButton />
          <AiSettingsMenu />
          <button
            className="icon-button"
            aria-label={`Switch to ${session.theme === "light" ? "dark" : "light"} theme`}
            onClick={() => updateSession({ theme: session.theme === "light" ? "dark" : "light" })}
          >
            {session.theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
          </button>
        </div>
      </header>
      {storageError && (
        <div className="global-notice" role="alert">
          {storageError}
        </div>
      )}
    </>
  );
}
