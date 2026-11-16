import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EMPTY } from "@/core/session";
import { sampleCurriculum, sampleQuestions } from "@/core/sample";
import { openWorkspace, loadWorkspace, saveProgress, workspacePath } from "@/server/workspace";
let directory: string;
let path: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "scaffold-workspace-test-"));
  vi.stubEnv("SCAFFOLD_DATA_DIR", join(directory, "settings"));
  path = join(directory, "lessons");
  await openWorkspace(path);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});
it("saves progress without changing Codex-authored curriculum or question files", async () => {
  const curriculum = JSON.stringify(sampleCurriculum, null, 2);
  const questions = JSON.stringify({ questions: sampleQuestions }, null, 2);
  await writeFile(join(path, "curriculum.json"), curriculum);
  await writeFile(join(path, "questions.json"), questions);
  await saveProgress(path, {
    ...EMPTY,
    curriculum: sampleCurriculum,
    questions: sampleQuestions,
    activeIndex: 2,
  });
  expect(await readFile(join(path, "curriculum.json"), "utf8")).toBe(curriculum);
  expect(await readFile(join(path, "questions.json"), "utf8")).toBe(questions);
  expect((await loadWorkspace()).session.activeIndex).toBe(2);
});
it("keeps the current workspace when another folder has invalid question data", async () => {
  const invalid = join(directory, "invalid");
  await import("node:fs/promises").then((fs) => fs.mkdir(invalid));
  await writeFile(join(invalid, "questions.json"), '{"questions":[{}]}');
  await expect(openWorkspace(invalid)).rejects.toMatchObject({ status: 422 });
  expect(await workspacePath()).toBe(path);
});
it("preserves progress and reports invalid external JSON instead of overwriting it", async () => {
  await saveProgress(path, { ...EMPTY, theme: "dark" });
  await writeFile(join(path, "questions.json"), "{incomplete");
  await expect(loadWorkspace()).rejects.toMatchObject({ status: 422 });
  expect(JSON.parse(await readFile(join(path, "progress.json"), "utf8")).theme).toBe("dark");
});
it("does not overwrite existing workspace instructions", async () => {
  await writeFile(join(path, "AGENTS.md"), "My personal instructions");
  await openWorkspace(path);
  expect(await readFile(join(path, "AGENTS.md"), "utf8")).toBe("My personal instructions");
});
it("updates legacy generated schemas while preserving personal schema edits", async () => {
  const { z } = await import("zod");
  const { questionSchema } = await import("@/core/schemas");
  const schemaFile = join(path, "questions.schema.json");
  await writeFile(
    schemaFile,
    JSON.stringify(
      z.toJSONSchema(
        z.object({ questions: z.array(questionSchema.omit({ language: true })).max(500) }),
      ),
    ),
  );
  await openWorkspace(path);
  expect(
    JSON.parse(await readFile(schemaFile, "utf8")).properties.questions.items.properties.language
      .enum,
  ).toContain("cpp");
  await writeFile(schemaFile, '{"personal":true}');
  await openWorkspace(path);
  expect(await readFile(schemaFile, "utf8")).toBe('{"personal":true}');
});
it("adds the research path idempotently without replacing questions, curriculum or progress", async () => {
  const { addLearningContent } = await import("@/server/workspace");
  await writeFile(join(path, "curriculum.json"), JSON.stringify(sampleCurriculum));
  await writeFile(join(path, "questions.json"), JSON.stringify({ questions: sampleQuestions }));
  await saveProgress(path, {
    ...EMPTY,
    theme: "dark",
    drafts: {
      "sample-positive": {
        answer: "my existing code",
        working: "notes",
        hintCount: 1,
        revealed: false,
        completed: false,
        tutorMessages: [],
        feedback: null,
      },
    },
  });
  const before = await readFile(join(path, "progress.json"), "utf8");
  const loaded = await addLearningContent(path, "research");
  expect(loaded.session.questions).toHaveLength(sampleQuestions.length + 18);
  expect(loaded.session.questions.slice(0, sampleQuestions.length)).toEqual(sampleQuestions);
  expect(loaded.session.curriculum).toEqual(sampleCurriculum);
  await addLearningContent(path, "research");
  expect((await loadWorkspace()).session.questions).toHaveLength(sampleQuestions.length + 18);
  expect(await readFile(join(path, "progress.json"), "utf8")).toBe(before);
});
it("serializes content additions and rejects stale workspace writes", async () => {
  const { addLearningContent } = await import("@/server/workspace");
  await Promise.all([
    addLearningContent(path, "research"),
    addLearningContent(path, "exercism-binary-search"),
  ]);
  const loaded = await loadWorkspace();
  expect(loaded.session.questions).toHaveLength(19);
  expect(loaded.session.curriculum?.modules).toHaveLength(6);
  await expect(addLearningContent(join(directory, "elsewhere"), "research")).rejects.toMatchObject({
    status: 409,
  });
});
it("keeps existing instructions and expands only formats when adding a new exercise kind", async () => {
  const { addLearningContent } = await import("@/server/workspace");
  const curriculum = { ...sampleCurriculum, formats: ["quiz"] };
  await writeFile(join(path, "curriculum.json"), JSON.stringify(curriculum));
  await writeFile(
    join(path, "questions.json"),
    JSON.stringify({ questions: [sampleQuestions[3]] }),
  );
  const loaded = await addLearningContent(path, "exercism-binary-search");
  expect(loaded.session.curriculum).toEqual({ ...curriculum, formats: ["quiz", "coding"] });
  expect(loaded.session.questions[0]).toEqual(sampleQuestions[3]);
});
it("adds training labs without replacing the research path or its progress", async () => {
  const { addLearningContent } = await import("@/server/workspace");
  await addLearningContent(path, "research");
  const curriculumBefore = await readFile(join(path, "curriculum.json"), "utf8");
  await saveProgress(path, { ...EMPTY, theme: "dark" });
  const progressBefore = await readFile(join(path, "progress.json"), "utf8");
  await addLearningContent(path, "training");
  await addLearningContent(path, "training");
  const loaded = await loadWorkspace();
  expect(loaded.session.questions).toHaveLength(30);
  expect(loaded.session.questions.find((q) => q.id === "training-cuda-add")?.lab?.environment).toBe(
    "cuda",
  );
  expect(await readFile(join(path, "curriculum.json"), "utf8")).toBe(curriculumBefore);
  expect(await readFile(join(path, "progress.json"), "utf8")).toBe(progressBefore);
});

it("persists learning projects and notes without changing exercise drafts", async () => {
  await saveProgress(path, {
    ...EMPTY,
    learningProjects: [
      {
        id: "experiment",
        title: "A small experiment",
        subject: "AI / ML",
        goal: "Compare baselines",
        source: "",
        notes: "My question",
        results: "",
        questionIds: [],
        steps: [],
        createdAt: new Date().toISOString(),
        archived: false,
      },
    ],
  });
  const loaded = await loadWorkspace();
  expect(loaded.session.learningProjects?.[0].notes).toBe("My question");
  expect(loaded.session.drafts).toEqual({});
});

it("writes topic-neutral authoring guidance and preserves customized guides", async () => {
  const guidePath = join(path, "SCAFFOLD.md");
  const guide = await readFile(guidePath, "utf8");
  expect(guide).toContain("Support any topic the learner chooses");
  expect(guide).toContain("assessment: self-review");
  expect(guide).not.toContain("aimed at AI work, quant problems");
  await writeFile(guidePath, "My own learning instructions");
  await openWorkspace(path);
  expect(await readFile(guidePath, "utf8")).toBe("My own learning instructions");
});

it("saves and reloads a project on a custom subject", async () => {
  const project = {
    id: "film-project",
    title: "Understand documentary storytelling",
    subject: "Film history",
    goal: "Compare two approaches to documentary storytelling.",
    source: "",
    notes: "Compare narrative structure.",
    results: "",
    questionIds: [],
    steps: [{ id: "watch", title: "Watch and annotate a documentary", done: false }],
    createdAt: new Date().toISOString(),
    archived: false,
  };
  await saveProgress(path, { ...EMPTY, learningProjects: [project] });
  expect((await loadWorkspace()).session.learningProjects).toEqual([project]);
});
