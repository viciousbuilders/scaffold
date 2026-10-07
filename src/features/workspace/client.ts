"use client";
import { z } from "zod";
import { sessionSchema } from "@/core/session";
import { postApi } from "@/ui/api";

export const workspaceResponseSchema = z.object({ path: z.string(), session: sessionSchema });
export type Workspace = z.infer<typeof workspaceResponseSchema>;
export async function fetchWorkspace(): Promise<Workspace> {
  const response = await fetch("/api/workspace", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Couldn't open the workspace.");
  return workspaceResponseSchema.parse(data);
}
export async function selectWorkspace() {
  if (!window.scaffoldDesktop)
    throw new Error("Open the Scaffold desktop app to choose a workspace folder.");
  const path = await window.scaffoldDesktop.chooseWorkspace();
  if (!path) return null;
  return postApi("workspace", { path }, workspaceResponseSchema);
}

declare global {
  interface Window {
    scaffoldFlushProgress?: () => Promise<void>;
    scaffoldDesktop?: {
      chooseWorkspace: () => Promise<string | null>;
      revealWorkspace: (path: string) => Promise<void>;
    };
  }
}
