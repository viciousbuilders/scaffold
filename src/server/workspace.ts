import "server-only";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve, isAbsolute } from "node:path";
import { z } from "zod";
import { curriculumSchema, questionSchema, validateQuestions } from "@/core/schemas";
import { EMPTY, progressSchema, type Session, type Progress } from "@/core/session";
import { AiError } from "./ai/service";

export const workspaceQuestionsSchema = z.object({ questions: z.array(questionSchema).max(500) });
export const dataDirectory = () =>
  process.env.SCAFFOLD_DATA_DIR || join(homedir(), "Library", "Application Support", "Scaffold");
const preferencesFile = () => join(dataDirectory(), "workspace.json");
async function readJson(path: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
export async function workspacePath() {
  const settings = (await readJson(preferencesFile())) as { path?: string } | null;
  return settings?.path || join(homedir(), "Documents", "Scaffold");
}

const LEGACY_GUIDE = `# Scaffold study workspace

Talk to Codex here to create or refine a curriculum and questions for your personal learning goals. Scaffold is only the practice interface; it reloads these files automatically.

- curriculum.json: a curriculum object (title, goal, level, formats, modules), matching curriculum.schema.json.
- questions.json: { "questions": [...] }, matching questions.schema.json. Use unique, stable IDs. Preserve IDs and existing questions when adding more; progress is keyed by ID.
- progress.json: Scaffold-owned answers, tutor conversations and progress. Do not edit or delete this file.

Ask about experience and goals before choosing difficulty. Generate small Python snippets aimed at AI work, quant problems, written questions or quizzes as requested. No app code changes are needed.

For coding, use standard-library pure functions, four-space indentation, starter code with TODO/pass, and at least two deterministic boolean test expressions. Supply an executable reference solution passing every test. For numerical written answers, set numericAnswer and tolerance. For conceptual answers set numericAnswer to null. Quizzes need plausible options and a zero-based correctOptionIndex. All questions need progressive hints, a solution, and a concept explanation. Keep irrelevant fields empty or null as specified by the schema. Verify arithmetic, answer keys and tests. Keep learner-facing descriptions free of solutions. Use Markdown for text, $...$ for inline math, and $$...$$ for display equations.

Never overwrite progress.json. Write JSON atomically (temporary file then rename) when possible. Validate against the supplied schemas before finishing.
`;
const GUIDE = LEGACY_GUIDE.replace(
  "Generate small Python snippets",
  "Generate small Python, JavaScript, C++17 or CUDA C++ snippets",
).replace(
  "For coding, use standard-library pure functions, four-space indentation, starter code with TODO/pass,",
  "For coding, set language to python, javascript, cpp or cuda (omitted means Python). Use functions without a main() entry point. Python and JavaScript run in browser workers; C++ uses a local compiler; CUDA needs NVIDIA hardware and the toolkit. JavaScript supports async functions, but not Node imports. Use four-space indentation for Python/C++/CUDA and two spaces for JavaScript, starter code with TODOs,",
);
const LANGUAGES = `# Coding languages

Set each coding question's language to python, javascript, cpp or cuda. Existing questions default to Python.

Tests are boolean expressions in the same language as the solution. JavaScript tests can use await. C++/CUDA tests run inside Scaffold's main(); supply functions and includes, without your own main(). Prefer self-contained functions. CUDA tests should synchronize kernels and check CUDA errors.

Python uses Pyodide (first run downloads the runtime). JavaScript uses a fresh browser worker, without Node packages. C++17 uses clang++ or g++ locally. Override the compiler with SCAFFOLD_CPP_COMPILER. CUDA uses nvcc (SCAFFOLD_CUDA_COMPILER) and requires an NVIDIA GPU; CUDA editing works on Mac, execution does not. Cloud execution is not connected yet.

Write questions.json, keep stable IDs, and never modify progress.json.
`;
async function upgradeGeneratedFiles(path: string) {
  // Only replace exact app-generated metadata. Preserve any personal edits.
  const guidePath = join(path, "SCAFFOLD.md");
  try {
    if ((await readFile(guidePath, "utf8")) === LEGACY_GUIDE)
      await writeFile(guidePath, GUIDE, { mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const schemaPath = join(path, "questions.schema.json");
  const previous = await readJson(schemaPath);
  const legacy = z.toJSONSchema(
    z.object({ questions: z.array(questionSchema.omit({ language: true })).max(500) }),
  );
  if (previous && JSON.stringify(previous) === JSON.stringify(legacy)) {
    const temporary = `${schemaPath}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(z.toJSONSchema(workspaceQuestionsSchema), null, 2), {
      mode: 0o600,
    });
    await rename(temporary, schemaPath);
  }
}
async function createIfMissing(path: string, content: string) {
  try {
    await writeFile(path, content, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}
export async function prepareWorkspace(path: string) {
  await mkdir(path, { recursive: true });
  await upgradeGeneratedFiles(path);
  await Promise.all([
    createIfMissing(join(path, "SCAFFOLD.md"), GUIDE),
    createIfMissing(join(path, "LANGUAGES.md"), LANGUAGES),
    createIfMissing(
      join(path, "curriculum.schema.json"),
      JSON.stringify(z.toJSONSchema(curriculumSchema), null, 2),
    ),
    createIfMissing(
      join(path, "questions.schema.json"),
      JSON.stringify(z.toJSONSchema(workspaceQuestionsSchema), null, 2),
    ),
    createIfMissing(
      join(path, "AGENTS.md"),
      "# Personal study workspace\n\nRead SCAFFOLD.md before creating or editing curricula and questions. Follow the JSON schemas. Never modify progress.json.\n",
    ),
  ]);
}
export async function openWorkspace(path: string) {
  if (!isAbsolute(path)) throw new AiError("Choose an absolute folder path.", 400);
  path = resolve(path);
  await prepareWorkspace(path);
  const loaded = await loadWorkspace(path);
  await mkdir(dataDirectory(), { recursive: true });
  await writeFile(preferencesFile(), JSON.stringify({ path }), { mode: 0o600 });
  return loaded;
}
export async function loadWorkspace(path = "") {
  path ||= await workspacePath();
  await prepareWorkspace(path);
  try {
    const [curriculumData, questionData, progressData] = await Promise.all([
      readJson(join(path, "curriculum.json")),
      readJson(join(path, "questions.json")),
      readJson(join(path, "progress.json")),
    ]);
    const curriculum = curriculumData === null ? null : curriculumSchema.parse(curriculumData);
    const questions =
      questionData === null ? [] : workspaceQuestionsSchema.parse(questionData).questions;
    validateQuestions(questions, curriculum?.formats);
    const progress = progressData === null ? EMPTY : progressSchema.parse(progressData);
    const session: Session = {
      ...EMPTY,
      ...progress,
      curriculum,
      questions,
      activeIndex: Math.min(progress.activeIndex, Math.max(0, questions.length - 1)),
      sample: false,
    };
    return { path, session };
  } catch {
    throw new AiError(
      "This workspace has invalid JSON or question data. Ask Codex to validate curriculum.json and questions.json against the schemas. Your progress has been kept.",
      422,
    );
  }
}
let saves: Promise<void> = Promise.resolve();
export function saveProgress(path: string, session: Session | Progress) {
  const operation = saves
    .catch(() => {})
    .then(async () => {
      if (path !== (await workspacePath()))
        throw new AiError("The workspace changed. Reopen it before saving.", 409);
      const file = join(path, "progress.json");
      const temp = `${file}.${crypto.randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify(progressSchema.parse(session), null, 2), {
        mode: 0o600,
      });
      await rename(temp, file);
    });
  saves = operation;
  return operation;
}
export async function importLegacy(session: Session) {
  const { path, session: current } = await loadWorkspace();
  if (current.curriculum || current.questions.length) return loadWorkspace();
  if (session.curriculum)
    await createIfMissing(
      join(path, "curriculum.json"),
      JSON.stringify(session.curriculum, null, 2),
    );
  if (session.questions.length)
    await createIfMissing(
      join(path, "questions.json"),
      JSON.stringify({ questions: session.questions }, null, 2),
    );
  await saveProgress(path, session);
  return loadWorkspace();
}
