import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";
import { AiSettingsSchema, type AiProvider } from "@/core/ai-settings";
import { readAiSettings, saveAiSettings } from "@/server/ai/settings";
import { aiCall, aiStatus } from "@/server/ai/service";
import { runCli } from "@/server/ai/cli";
import { POST } from "@/app/api/ai/settings/route";
import { POST as tutor } from "@/app/api/tutor/route";
import { POST as grade } from "@/app/api/grade/route";
import { sampleQuestions } from "@/core/sample";
let directory: string;
const reply = z.object({ reply: z.string() });
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "scaffold-providers-test-"));
  vi.stubEnv("SCAFFOLD_DATA_DIR", directory);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});
async function fake(provider: AiProvider, source: string, model = "") {
  const binary = join(directory, provider);
  await writeFile(binary, `#!${process.execPath}\n${source}`, { mode: 0o700 });
  const settings = AiSettingsSchema.parse({ provider });
  settings.profiles[provider] = { executable: binary, model, args: [] };
  await saveAiSettings(settings);
  return binary;
}
it("defaults to Codex, persists all provider profiles and leaves workspace/progress untouched", async () => {
  expect((await readAiSettings()).provider).toBe("codex");
  await writeFile(join(directory, "workspace.json"), '{"path":"/personal/questions"}');
  await writeFile(join(directory, "progress.json"), "personal answers");
  const settings = AiSettingsSchema.parse({
    provider: "claude",
    profiles: { claude: { model: "sonnet" }, codex: { model: "my-codex-model" } },
  });
  await saveAiSettings(settings);
  expect(await readAiSettings()).toEqual(settings);
  expect(await readFile(join(directory, "workspace.json"), "utf8")).toBe(
    '{"path":"/personal/questions"}',
  );
  expect(await readFile(join(directory, "progress.json"), "utf8")).toBe("personal answers");
});
it("does not silently replace damaged preferences", async () => {
  await writeFile(join(directory, "ai.json"), "broken");
  await expect(readAiSettings()).rejects.toMatchObject({ status: 503 });
  expect(await readFile(join(directory, "ai.json"), "utf8")).toBe("broken");
});
it("uses Claude structured output, disables tools and keeps the chosen model", async () => {
  await fake(
    "claude",
    `const args = process.argv.slice(2);
    if (args[args.indexOf('--tools')+1] !== '' || !args.includes('--strict-mcp-config') || !args.includes('--no-session-persistence') || args[args.indexOf('--model')+1] !== 'sonnet') process.exit(2);
    process.stdin.resume(); process.stdin.on('end', () => console.log(JSON.stringify({type:'result', subtype:'success', structured_output:{reply:'Claude hint'}})));`,
    "sonnet",
  );
  expect(await aiCall(reply, "reply", "Tutor", [])).toEqual({ reply: "Claude hint" });
});
it("checks Claude login JSON rather than assuming a zero exit means logged in", async () => {
  await fake("claude", `console.log(JSON.stringify({loggedIn:false}));`);
  expect(await aiStatus()).toMatchObject({ connected: false, provider: "claude" });
  await fake("claude", `console.log(JSON.stringify({loggedIn:true}));`);
  expect(await aiStatus()).toMatchObject({ connected: true, authentication: "verified" });
});
it("extracts only OpenCode text events and applies deny permissions to its tutor agent", async () => {
  await fake(
    "opencode",
    `const c = JSON.parse(process.env.OPENCODE_CONFIG_CONTENT);
    if (c.permission !== 'deny' || c.agent['scaffold-tutor'].permission !== 'deny' || !process.argv.includes('scaffold-tutor')) process.exit(2);
    process.stdin.resume(); process.stdin.on('end', () => {
      console.log(JSON.stringify({type:'reasoning',part:{text:'Private reasoning'}}));
      console.log(JSON.stringify({type:'text',part:{text:'{"reply":"OpenCode hint"}'}}));
      console.log(JSON.stringify({type:'step_finish',part:{}}));
    });`,
  );
  expect(await aiCall(reply, "reply", "Tutor", [])).toEqual({ reply: "OpenCode hint" });
  expect(await aiStatus()).toMatchObject({ connected: true, authentication: "unchecked" });
});
it("uses Pi print mode without sessions, tools or discovered extensions", async () => {
  await fake(
    "pi",
    `for (const flag of ['--print','--no-session','--no-tools','--no-extensions','--no-skills','--no-context-files']) if (!process.argv.includes(flag)) process.exit(2);
    process.stdin.resume(); process.stdin.on('end', () => console.log('\\x60\\x60\\x60json\\n{"reply":"Pi hint"}\\n\\x60\\x60\\x60'));`,
  );
  expect(await aiCall(reply, "reply", "Tutor", [])).toEqual({ reply: "Pi hint" });
});
it("supports a custom executable with literal arguments, schema placeholders and stdin", async () => {
  await fake(
    "custom",
    `const fs=require('node:fs'); const args=process.argv.slice(2);
    if (args[0] !== 'model name' || args[1] !== '$(touch should-not-exist)' || JSON.parse(fs.readFileSync(args[2],'utf8')).type !== 'object') process.exit(2);
    let prompt=''; process.stdin.on('data', c => prompt+=c); process.stdin.on('end', () => { if (!prompt.includes('student question')) process.exit(3); console.log('{"reply":"Custom hint"}'); });`,
    "model name",
  );
  const settings = await readAiSettings();
  settings.profiles.custom.args = ["{model}", "$(touch should-not-exist)", "{schemaPath}"];
  await saveAiSettings(settings);
  expect(
    await aiCall(reply, "reply", "Tutor", [{ role: "user", content: "student question" }]),
  ).toEqual({ reply: "Custom hint" });
});
it.each(["claude", "opencode", "pi", "custom"] as const)(
  "rejects invalid %s output without forwarding raw logs",
  async (provider) => {
    await fake(
      provider,
      `process.stdin.resume(); process.stdin.on('end', () => console.log('secret-cli-log'));`,
    );
    await expect(aiCall(reply, "tutor_response", "Tutor", [])).rejects.toMatchObject({
      message: expect.stringContaining("invalid tutor response"),
    });
  },
);
it("rejects provider errors even if OpenCode exits successfully with valid earlier text", async () => {
  await fake(
    "opencode",
    `process.stdin.resume(); process.stdin.on('end', () => { console.log(JSON.stringify({type:'text',part:{text:'{"reply":"partial"}'}})); console.log(JSON.stringify({type:'error',error:'private failure'})); });`,
  );
  await expect(aiCall(reply, "reply", "Tutor", [])).rejects.toThrow("invalid reply");
});
it("enforces time limits and capped output", async () => {
  const binary = await fake("pi", "process.stdin.resume(); setInterval(()=>{}, 1000);");
  await expect(
    runCli(binary, [], process.env, directory, "", "Test", undefined, 50),
  ).rejects.toMatchObject({ status: 504 });
  await writeFile(binary, `#!${process.execPath}\nprocess.stdout.write('x'.repeat(2_000_001));`, {
    mode: 0o700,
  });
  await expect(runCli(binary, [], process.env, directory, "", "Test")).rejects.toThrow(
    "too much output",
  );
});
it("rejects cancelled requests before launching", async () => {
  vi.stubEnv("SCAFFOLD_CODEX_PATH", "/missing/codex");
  const controller = new AbortController();
  controller.abort();
  await expect(aiCall(reply, "reply", "Tutor", [], controller.signal)).rejects.toMatchObject({
    status: 499,
  });
});
it("blocks cross-origin settings writes and invalid providers", async () => {
  const request = (body: unknown, origin = "http://127.0.0.1:3010") =>
    new Request("http://127.0.0.1:3010/api/ai/settings", {
      method: "POST",
      headers: { host: "127.0.0.1:3010", origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  expect((await POST(request({ provider: "claude" }, "https://untrusted.example"))).status).toBe(
    403,
  );
  expect((await POST(request({ provider: "invalid" }))).status).toBe(400);
  expect((await readAiSettings()).provider).toBe("codex");
});

it.each(["codex", "claude", "opencode", "pi", "custom"] as const)(
  "routes tutoring and conceptual grading through selected %s",
  async (provider) => {
    await fake(
      provider,
      `const fs=require('node:fs'); const args=process.argv.slice(2);
    let prompt=''; process.stdin.on('data', c => prompt+=c); process.stdin.on('end', () => {
      const grading=prompt.includes('"feedback":');
      if (!grading && prompt.includes('SECRET_REFERENCE')) process.exit(2);
      const response=grading ? {correct:true,feedback:'Good reasoning'} : {reply:'A small hint'};
      const text=JSON.stringify(response);
      if (args.includes('--output-last-message')) fs.writeFileSync(args[args.indexOf('--output-last-message')+1],text);
      else if (args.includes('--json-schema')) console.log(JSON.stringify({subtype:'success',structured_output:response}));
      else if (args.includes('run')) console.log(JSON.stringify({type:'text',part:{text}}));
      else console.log(text);
    });`,
    );
    const request = (body: unknown, endpoint: string) =>
      new Request(`http://localhost:3010/api/${endpoint}`, {
        method: "POST",
        headers: {
          host: "localhost:3010",
          origin: "http://localhost:3010",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    const question = {
      ...sampleQuestions[2],
      kind: "written",
      numericAnswer: null,
      solution: "SECRET_REFERENCE",
    };
    const response = await tutor(
      request(
        {
          problem: question,
          attempt: "My attempt",
          messages: [{ role: "user", content: "Where should I start?" }],
        },
        "tutor",
      ),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reply: "A small hint" });
    const feedback = await grade(request({ question, answer: "My explanation" }, "grade"));
    expect(feedback.status).toBe(200);
    expect(await feedback.json()).toEqual({ correct: true, feedback: "Good reasoning" });
  },
);
