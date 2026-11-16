// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { ColabPanel } from "@/features/colab/colab-panel";
import { applyWorkspace, flushProgress, updateDraft } from "@/features/session/store";
import { trainingQuestions } from "@/core/training-path";
import { EMPTY } from "@/core/session";
import type { ColabStatus } from "@/core/colab";
const q = trainingQuestions[1];
let root: Root;
let container: HTMLDivElement;
let remote: ColabStatus;
async function click(label: string) {
  const b = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === label);
  if (!b) throw Error(label);
  await act(async () => b.click());
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  localStorage.clear();
  applyWorkspace({ path: "/test", session: { ...EMPTY, questions: [q] } });
  remote = {
    configured: true,
    connected: false,
    phase: "idle",
    output: "",
    error: null,
    succeeded: null,
    generation: 0,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, options?: RequestInit) => {
      const body = JSON.parse(String(options?.body || "{}"));
      if (body.action === "connect") remote = { ...remote, connected: true };
      if (body.action === "run") remote = { ...remote, phase: "running", generation: 1 };
      if (body.action === "stop")
        remote = { ...remote, phase: "idle", succeeded: false, error: "Stopped" };
      if (body.action === "disconnect") remote = { ...remote, connected: false };
      return Response.json(remote);
    }),
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(ColabPanel, { question: q })));
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
    await flushProgress();
  });
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("connects, runs, streams results and saves history without replacing newer code", async () => {
  await act(async () => updateDraft(q, { answer: 'print("original")' }));
  await click("Connect GPU");
  await click("Run on GPU");
  expect(container.textContent).toContain("Executing remotely");
  await act(async () => updateDraft(q, { answer: 'print("newer edit")' }));
  remote = { ...remote, phase: "idle", succeeded: true, output: "LAB_PASS\n" };
  await act(async () => vi.advanceTimersByTimeAsync(4500));
  expect(container.textContent).toContain("LAB_PASS");
  await click("Save successful run to history");
  const draft = JSON.parse(localStorage.getItem("study-trainer.session.v1")!).drafts[q.id];
  expect(draft.answer).toBe('print("newer edit")');
  expect(draft.attempts[0].answer).toBe('print("original")');
  await click("Release GPU");
  expect(container.textContent).toContain("disconnected");
});
it("stops execution and does not offer to save failure as success", async () => {
  await click("Connect GPU");
  await click("Run on GPU");
  await click("Stop run");
  expect(container.textContent).toContain("Stopped");
  const save = [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Save successful"),
  );
  expect(save?.disabled).toBe(true);
});
