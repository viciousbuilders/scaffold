import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { aiCall, codexStatus } from "@/server/ai/service";
const directories: string[] = [];
beforeEach(async () => {
  const directory = await mkdtemp(join(tmpdir(), "scaffold-ai-settings-test-"));
  directories.push(directory);
  vi.stubEnv("SCAFFOLD_DATA_DIR", directory);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function fakeCodex(source: string) {
  const directory = await mkdtemp(join(tmpdir(), "scaffold-cli-test-"));
  directories.push(directory);
  const binary = join(directory, "codex");
  await writeFile(binary, `#!${process.execPath}\n${source}`, { mode: 0o700 });
  vi.stubEnv("SCAFFOLD_CODEX_PATH", binary);
}
it("reports a missing CLI without using an API key", async () => {
  vi.stubEnv("SCAFFOLD_CODEX_PATH", "/missing/scaffold/codex");
  expect(await codexStatus()).toMatchObject({ connected: false });
  await expect(aiCall(z.object({ reply: z.string() }), "reply", "Test", [])).rejects.toMatchObject({
    status: 503,
  });
});
it("uses stdin, structured output and read-only execution with the API key removed", async () => {
  vi.stubEnv("OPENAI_API_KEY", "must-not-be-forwarded");
  await fakeCodex(`const fs = require('node:fs'); const args = process.argv.slice(2);
    if (process.env.OPENAI_API_KEY || !args.includes('read-only') || !args.includes('--ephemeral')) process.exit(2);
    let input = ''; process.stdin.on('data', c => input += c); process.stdin.on('end', () => {
      if (!input.includes('literal $(touch never)')) process.exit(3);
      fs.writeFileSync(args[args.indexOf('--output-last-message')+1], JSON.stringify({ reply: 'A guiding hint' }));
    });`);
  expect(
    await aiCall(z.object({ reply: z.string() }), "reply", "Tutor", [
      { role: "user", content: "literal $(touch never)" },
    ]),
  ).toEqual({ reply: "A guiding hint" });
});
it("terminates an active Codex request when cancelled", async () => {
  await fakeCodex(`process.stdin.resume(); setInterval(() => {}, 1000);`);
  const abort = new AbortController();
  const promise = aiCall(z.object({ reply: z.string() }), "reply", "Tutor", [], abort.signal);
  setTimeout(() => abort.abort(), 100);
  await expect(promise).rejects.toMatchObject({ status: 499 });
});
