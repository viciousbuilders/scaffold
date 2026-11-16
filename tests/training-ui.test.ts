// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { AnswerPane } from "@/features/practice/answer-pane";
import { PracticeActionsProvider, PracticeActionsSlot } from "@/ui/practice-actions";
import { trainingQuestions } from "@/core/training-path";
import { EMPTY } from "@/core/session";
import { applyWorkspace, flushProgress, updateDraft } from "@/features/session/store";

vi.mock("next/dynamic", () => ({
  default: () => () => createElement("div", null, "Lab code editor"),
}));
vi.mock("@/features/practice/use-code-runner", () => ({
  useCodeRunner: () => ({
    run: vi.fn(),
    stop: vi.fn(),
    phase: "idle",
    capability: { available: true, message: "" },
  }),
}));
let root: Root;
let container: HTMLDivElement;
const question = trainingQuestions.find((q) => q.id === "training-broadcast")!;
const click = async (label: string) => {
  const button = [...container.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === label,
  );
  if (!button) throw new Error(label);
  await act(async () => button.click());
};
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  applyWorkspace({ path: "/training-test", session: { ...EMPTY, questions: [question] } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 200 })),
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      createElement(
        PracticeActionsProvider,
        null,
        createElement(PracticeActionsSlot),
        createElement(AnswerPane, { question }),
      ),
    ),
  );
});
afterEach(async () => {
  await act(async () => {
    await flushProgress();
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("requires completed code and recorded output, then saves a self-reviewed lab attempt", async () => {
  expect(
    [...container.querySelectorAll("button")].some((b) => b.textContent?.trim() === "Run"),
  ).toBe(false);
  await click("Record lab");
  expect(container.querySelector('[role="alert"]')?.textContent).toContain("Complete the lab code");
  await act(async () =>
    updateDraft(question, {
      answer: question.solution,
      working:
        "python center_rows.py — CPU, PyTorch 2.15; all checks passed. keepdim preserves the broadcast axis.",
    }),
  );
  await click("Record lab");
  const saved = JSON.parse(localStorage.getItem("study-trainer.session.v1")!);
  expect(saved.drafts[question.id].attempts[0]).toMatchObject({
    evidence: "self-review",
    correct: null,
    answer: question.solution,
  });
  expect(container.textContent).toContain("Completed");
});
it("exports current code with the lab filename", async () => {
  const create = vi.fn(() => "blob:test-lab");
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  const anchor = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    expect(this.download).toBe("center_rows.py");
  });
  await click("Download code");
  expect(create).toHaveBeenCalledTimes(1);
  expect(anchor).toHaveBeenCalledTimes(1);
});
