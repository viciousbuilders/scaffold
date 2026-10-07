import "server-only";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { AiSettingsSchema, type AiSettings } from "@/core/ai-settings";
import { AiError } from "./errors";

function directory() {
  return process.env.SCAFFOLD_DATA_DIR || join(homedir(), "Library/Application Support/Scaffold");
}
export async function readAiSettings(): Promise<AiSettings> {
  try {
    return AiSettingsSchema.parse(JSON.parse(await readFile(join(directory(), "ai.json"), "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return AiSettingsSchema.parse({});
    throw new AiError(
      "Couldn't read AI settings. Check ai.json in Scaffold's application data folder.",
      503,
    );
  }
}
export async function saveAiSettings(input: AiSettings) {
  const settings = AiSettingsSchema.parse(input);
  await mkdir(directory(), { recursive: true });
  const path = join(directory(), "ai.json");
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(settings, null, 2), { mode: 0o600 });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
  return settings;
}
