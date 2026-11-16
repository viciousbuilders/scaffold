// @vitest-environment jsdom
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { PracticeScreen } from "@/features/practice/practice-screen";
import { applyWorkspace } from "@/features/session/store";
import { EMPTY } from "@/core/session";
import { researchQuestions } from "@/core/learning-path";
vi.mock("@/features/practice/answer-pane", () => ({
  AnswerPane: () => createElement("div", null, "My code"),
}));
vi.mock("@/features/practice/question-pane", () => ({
  QuestionPane: () => createElement("div", null, "My question"),
}));
it("opens and closes the tutor without removing the question or editor", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  applyWorkspace({
    path: "/layout-test",
    session: { ...EMPTY, questions: [researchQuestions[0]] },
  });
  const node = document.createElement("div");
  document.body.append(node);
  const root = createRoot(node);
  try {
    await act(async () => root.render(createElement(PracticeScreen)));
    expect(node.querySelector<HTMLElement>(".practice-tutor")?.hidden).toBe(true);
    await act(async () =>
      node.querySelector<HTMLButtonElement>(".practice-modebar button")!.click(),
    );
    expect(node.querySelector<HTMLElement>(".practice-tutor")?.hidden).toBe(false);
    expect(node.textContent).toContain("My code");
    await act(async () => node.querySelector<HTMLButtonElement>(".tutor-toggle")!.click());
    expect(node.querySelector<HTMLElement>(".practice-tutor")?.hidden).toBe(true);
    expect(node.textContent).toContain("My question");
  } finally {
    await act(async () => root.unmount());
    node.remove();
  }
});
