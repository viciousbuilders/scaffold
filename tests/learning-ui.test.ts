// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { LearningHome } from "@/features/learning/learning-home";
import { applyWorkspace, flushProgress, updateDraft } from "@/features/session/store";
import { EMPTY, type Session } from "@/core/session";
import { trainingCurriculum, trainingQuestions } from "@/core/training-path";
import { researchCurriculum, researchQuestions } from "@/core/learning-path";
import { sourceQuestion } from "@/core/source-library";
import { withAttempt } from "@/core/practice-progress";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
let root: Root;
let container: HTMLDivElement;
let session: Session;
function button(label: string) {
  const found = [...container.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === label,
  );
  if (!found) throw new Error(`Button not found: ${label}`);
  return found;
}
async function click(element: HTMLElement) {
  await act(async () => element.click());
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  navigation.push.mockReset();
  session = { ...EMPTY, questions: [], drafts: {} };
  applyWorkspace({ path: "/test-workspace", session });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, options?: RequestInit) => {
      const body = JSON.parse(String(options?.body || "{}"));
      if (body.collection) {
        const incoming =
          body.collection === "research"
            ? researchQuestions
            : body.collection === "training"
              ? trainingQuestions
              : [sourceQuestion(body.collection)];
        const ids = new Set(session.questions.map((q) => q.id));
        session = {
          ...session,
          curriculum:
            body.collection === "research"
              ? researchCurriculum
              : body.collection === "training"
                ? trainingCurriculum
                : session.curriculum,
          questions: [...session.questions, ...incoming.filter((q) => !ids.has(q.id))],
        };
      }
      return new Response(JSON.stringify({ path: "/test-workspace", session }), { status: 200 });
    }),
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(LearningHome)));
  await click(button("AI research"));
});
afterEach(async () => {
  await act(async () => {
    await flushProgress();
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
});
it("installs the path, changes stages, filters sources and imports an exercise", async () => {
  await click(button("Add research path"));
  expect(container.textContent).toContain("0/18 recorded");
  await click(container.querySelectorAll<HTMLButtonElement>(".stage-choice")[4]);
  expect(container.querySelector(".stage-detail h2")?.textContent).toBe("Change model behaviour");
  await click(button("Library"));
  await click(button("Coding"));
  expect(container.querySelectorAll(".source-card")).toHaveLength(3);
  await click(button("Import exercise"));
  expect(container.querySelector(".owned-rows")?.textContent).toContain("Binary search");
  expect(container.querySelectorAll(".owned-rows .study-row")).toHaveLength(1);
  await click(container.querySelector<HTMLButtonElement>(".owned-rows .study-row")!);
  expect(navigation.push).toHaveBeenCalledWith("/practice");
});
it("queues assisted work and archives it before starting a fresh attempt", async () => {
  await click(button("Add research path"));
  await act(async () => {
    updateDraft(
      researchQuestions[0],
      withAttempt(
        {
          answer: "first answer",
          working: "reasoning",
          hintCount: 1,
          revealed: false,
          completed: false,
          tutorMessages: [],
          feedback: null,
        },
        { correct: false, feedback: "Try again" },
        "tests",
      ),
    );
  });
  await click(
    [...container.querySelectorAll<HTMLButtonElement>(".learning-nav button")].find((item) =>
      item.textContent?.startsWith("Review"),
    )!,
  );
  expect(container.querySelectorAll(".review-card")).toHaveLength(1);
  await click(button("Start fresh"));
  expect(container.querySelectorAll(".review-card")).toHaveLength(0);
  const saved = JSON.parse(localStorage.getItem("study-trainer.session.v1")!);
  expect(saved.drafts[researchQuestions[0].id].attempts).toHaveLength(1);
  expect(saved.drafts[researchQuestions[0].id].answer).toBe(researchQuestions[0].starterCode);
  expect(navigation.push).toHaveBeenCalledWith("/practice");
});
it("shows an import error without removing the existing library", async () => {
  await click(button("Add research path"));
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(JSON.stringify({ error: "Import unavailable" }), { status: 503 }),
  );
  await click(button("Library"));
  await click(button("Coding"));
  await click(button("Import exercise"));
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("Import unavailable");
  await click(button("Research"));
  expect(container.querySelectorAll(".owned-rows .study-row")).toHaveLength(18);
});
it("adds and browses the training path independently of the research path", async () => {
  await click(button("GPU programming"));
  expect(container.querySelector(".path-section-heading h2")?.textContent).toBe(
    "PyTorch & GPU programming",
  );
  await click(button("Add training path"));
  expect(container.textContent).toContain("0/12 recorded");
  await click(container.querySelectorAll<HTMLButtonElement>(".stage-choice")[4]);
  expect(container.querySelector(".stage-detail")?.textContent).toContain("CUDA C++ · NVIDIA GPU");
  expect(container.querySelector(".stage-detail")?.textContent).toContain("Triton · NVIDIA GPU");
  await click(button("AI research"));
  expect(button("Add research path")).toBeDefined();
  await click(button("Add research path"));
  await click(button("Library"));
  await click(
    [...container.querySelectorAll<HTMLButtonElement>(".subject-filters button")].find(
      (item) => item.textContent === "Training",
    )!,
  );
  expect(container.querySelectorAll(".owned-rows .study-row")).toHaveLength(12);
});

it("creates a source-backed project, records steps and links existing practice", async () => {
  await click(button("Add research path"));
  await click(button("Home"));
  expect(container.querySelector(".project-subjects")?.textContent).toContain("Languages");
  await click(button("New project"));
  const title = container.querySelector<HTMLInputElement>('input[name="title"]')!;
  const source = container.querySelector<HTMLInputElement>('input[name="source"]')!;
  const steps = container.querySelector<HTMLTextAreaElement>('textarea[name="steps"]')!;
  title.value = "Reproduce a decoding experiment";
  container.querySelector<HTMLInputElement>('input[name="subject"]')!.value = "Film history";
  source.value = "https://www.baseten.co/blog";
  steps.value = "Implement baseline\nMeasure latency";
  await act(async () =>
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(container.querySelector(".project-title h2")?.textContent).toContain("Reproduce");
  expect(container.querySelector<HTMLAnchorElement>(".source-reference")?.href).toBe(
    "https://www.baseten.co/blog",
  );
  await click(container.querySelector<HTMLInputElement>(".project-step input")!);
  const link = container.querySelector<HTMLInputElement>(".project-link-exercises input")!;
  await click(link);
  let saved = JSON.parse(localStorage.getItem("study-trainer.session.v1")!);
  expect(saved.learningProjects[0].subject).toBe("Film history");
  expect(saved.learningProjects[0].steps[0].done).toBe(true);
  expect(saved.learningProjects[0].questionIds).toHaveLength(1);
  expect(container.querySelectorAll(".project-exercise")).toHaveLength(1);
  await click(button("Edit project"));
  expect(container.querySelector<HTMLInputElement>('input[name="source"]')?.value).toBe(
    "https://www.baseten.co/blog",
  );
  container.querySelector<HTMLInputElement>('input[name="title"]')!.value =
    "Reproduce a better experiment";
  await act(async () =>
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(container.querySelector(".project-title h2")?.textContent).toBe(
    "Reproduce a better experiment",
  );
  expect(container.querySelectorAll(".project-exercise")).toHaveLength(1);
  await click(button("Archive project"));
  await click(button("All projects"));
  expect(container.querySelector(".archived-projects")?.textContent).toContain("Reproduce");
  saved = JSON.parse(localStorage.getItem("study-trainer.session.v1")!);
  expect(saved.learningProjects[0].archived).toBe(true);
  expect(saved.questions).toHaveLength(18);
});

it("starts a project from a suggested subject without installing specialist questions", async () => {
  await click(button("Home"));
  await click(button("Languages"));
  expect(container.querySelector<HTMLInputElement>('input[name="subject"]')?.value).toBe(
    "Languages",
  );
  expect(container.querySelector<HTMLInputElement>('input[name="title"]')?.value).toBe("");
  expect(session.questions).toHaveLength(0);
});

it("filters installed exercises by an arbitrary topic", async () => {
  const question = { ...researchQuestions[1], id: "history-example", topic: "Film history" };
  await act(async () =>
    applyWorkspace({ path: "/test-workspace", session: { ...EMPTY, questions: [question] } }),
  );
  await click(button("Library"));
  await click(button("Film history"));
  expect(container.querySelectorAll(".owned-rows .study-row")).toHaveLength(1);
  expect(container.querySelector(".owned-rows")?.textContent).toContain(question.title);
});
