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
