"use client";
import { useSyncExternalStore } from "react";
import type { Question } from "@/core/schemas";
import { EMPTY, sessionSchema, progressSchema, type Session, type Draft } from "@/core/session";
import {
  fetchWorkspace,
  workspaceResponseSchema,
  type Workspace,
} from "@/features/workspace/client";
import { postApi } from "@/ui/api";
export type { Session, Draft } from "@/core/session";

const KEY = "study-trainer.session.v1";
let snapshot: Session | null = null;
let workspace: Workspace | null = null;
let initialized: Promise<void> | null = null;
let pendingSave: ReturnType<typeof setTimeout> | null = null;
let saveQueue: Promise<unknown> = Promise.resolve();
let storageError: string | null = null;
const listeners = new Set<() => void>();
function read(): Session {
  if (snapshot) return snapshot;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? sessionSchema.safeParse(JSON.parse(raw)) : null;
    snapshot = parsed?.success ? parsed.data : EMPTY;
  } catch {
    snapshot = EMPTY;
  }
  return snapshot;
}
function emit() {
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function useSession() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
export function useWorkspacePath() {
  return useSyncExternalStore(
    subscribe,
    () => workspace?.path || "",
    () => "",
  );
}
export function useStorageError() {
  return useSyncExternalStore(
    subscribe,
    () => storageError,
    () => null,
  );
}
function backup() {
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    storageError =
      "The local backup couldn't be saved. Keep Scaffold open until progress is saved to disk.";
  }
}
export async function initializeWorkspace() {
  if (initialized) return initialized;
  initialized = (async () => {
    let loaded = await fetchWorkspace();
    const legacy = read();
    if (!loaded.session.questions.length && !loaded.session.curriculum && legacy.questions.length) {
      loaded = await postApi("workspace/import", legacy, workspaceResponseSchema);
    }
    applyWorkspace(loaded);
  })();
  try {
    await initialized;
  } catch (error) {
    initialized = null;
    throw error;
  }
}
export function applyWorkspace(value: Workspace) {
  workspace = value;
  snapshot = value.session;
  storageError = null;
  backup();
  emit();
}
export async function refreshWorkspace() {
  if (!workspace) return;
  try {
    const loaded = await fetchWorkspace();
    if (loaded.path !== workspace.path) return;
    const previous = read();
    if (
      JSON.stringify([previous.curriculum, previous.questions]) !==
      JSON.stringify([loaded.session.curriculum, loaded.session.questions])
    ) {
      const activeId = previous.questions[previous.activeIndex]?.id;
      const index = loaded.session.questions.findIndex((q) => q.id === activeId);
      snapshot = {
        ...previous,
        curriculum: loaded.session.curriculum,
        questions: loaded.session.questions,
        activeIndex: index >= 0 ? index : 0,
      };
      backup();
      emit();
    }
  } catch (error) {
    storageError = error instanceof Error ? error.message : "Couldn't reload questions.";
    emit();
  }
}
function saveToDisk() {
  if (!workspace || !snapshot) return;
  const data = { path: workspace.path, session: progressSchema.parse(snapshot) };
  saveQueue = saveQueue
    .catch(() => {})
    .then(async () => {
      const response = await fetch("/api/workspace/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok)
        throw new Error("Couldn't save progress to this workspace. Your local backup is intact.");
    })
    .catch((error) => {
      storageError = error.message;
      emit();
    });
}
export async function flushProgress() {
  if (pendingSave) {
    clearTimeout(pendingSave);
    pendingSave = null;
    saveToDisk();
  }
  await saveQueue;
}
export function updateSession(update: Partial<Session> | ((previous: Session) => Session)) {
  const previous = read();
  snapshot = typeof update === "function" ? update(previous) : { ...previous, ...update };
  backup();
  if (pendingSave) clearTimeout(pendingSave);
  pendingSave = setTimeout(() => {
    pendingSave = null;
    saveToDisk();
  }, 350);
  emit();
}
export function getDraft(question: Question, session: Session): Draft {
  return (
    session.drafts[question.id] || {
      answer: question.starterCode,
      working: "",
      hintCount: 0,
      revealed: false,
      completed: false,
      tutorMessages: [],
      feedback: null,
    }
  );
}
export function updateDraft(
  question: Question,
  update: Partial<Draft> | ((previous: Draft) => Draft),
) {
  updateSession((previous) => {
    const draft = getDraft(question, previous);
    return {
      ...previous,
      drafts: {
        ...previous.drafts,
        [question.id]: typeof update === "function" ? update(draft) : { ...draft, ...update },
      },
    };
  });
}
