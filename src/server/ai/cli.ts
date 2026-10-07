import "server-only";
import { spawn } from "node:child_process";
import { access, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { dirname, delimiter, isAbsolute, join } from "node:path";
import { AI_LABELS, type AiProvider, type CliProfile } from "@/core/ai-settings";
import { AiError } from "./errors";

async function searchDirectories() {
  const home = homedir();
  const nvm = join(home, ".nvm/versions/node");
  const versions = await readdir(nvm).catch(() => [] as string[]);
  return [
    ...new Set([
      ...(process.env.PATH || "").split(delimiter).filter(Boolean),
      join(home, ".local/bin"),
      join(home, ".opencode/bin"),
      join(home, "Library/pnpm/bin"),
      join(home, ".npm-global/bin"),
      join(home, ".bun/bin"),
      "/opt/homebrew/bin",
      "/usr/local/bin",
      "/usr/bin",
      "/bin",
      ...versions
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
        .map((v) => join(nvm, v, "bin")),
    ]),
  ];
}
export async function cliInstallation(provider: AiProvider, profile: CliProfile) {
  const directories = await searchDirectories();
  const command =
    profile.executable ||
    process.env[`SCAFFOLD_${provider.toUpperCase()}_PATH`] ||
    (provider === "custom" ? "" : provider);
  if (!command) throw new AiError("Choose an executable for your custom CLI.", 503);
  const expanded = command.startsWith("~/") ? join(homedir(), command.slice(2)) : command;
  const candidates = isAbsolute(expanded)
    ? [expanded]
    : expanded.includes("/")
      ? []
      : directories.map((d) => join(d, expanded));
  for (const binary of candidates) {
    try {
      await access(binary, constants.X_OK);
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        PATH: [...new Set([dirname(binary), ...directories])].join(delimiter),
      };
      // The old app key must never override the user's CLI authentication.
      delete env.OPENAI_API_KEY;
      delete env.OPENAI_MODEL;
      return { binary, env };
    } catch {
      /* Try the next installation. */
    }
  }
  throw new AiError(
    `${AI_LABELS[provider]} wasn't found. Install it in Terminal or set its executable path here.`,
    503,
  );
}
export function runCli(
  binary: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  cwd: string,
  input: string,
  label: string,
  signal?: AbortSignal,
  timeoutMs = 300_000,
) {
  return new Promise<string>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AiError(`${label} request cancelled.`, 499));
      return;
    }
    const child = spawn(/* turbopackIgnore: true */ binary, args, {
      env,
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });
    let failure: AiError | null = null;
    let bytes = 0;
    const chunks: Buffer[] = [];
    const stop = (error: AiError) => {
      failure ??= error;
      try {
        if (child.pid && process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch {
        /* Already exited. */
      }
    };
    const timer = setTimeout(
      () => stop(new AiError(`${label} took too long. Your work is saved; try again.`, 504)),
      timeoutMs,
    );
    const abort = () => stop(new AiError(`${label} request cancelled.`, 499));
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    };
    const drain = (chunk: Buffer, capture: boolean) => {
      bytes += chunk.length;
      if (bytes > 2_000_000)
        stop(new AiError(`${label} produced too much output. Try a smaller request.`));
      else if (capture) chunks.push(chunk);
    };
    child.stdout.on("data", (chunk: Buffer) => drain(chunk, true));
    child.stderr.on("data", (chunk: Buffer) => drain(chunk, false));
    child.stdin.on("error", () => {});
    child.once("error", () => {
      cleanup();
      reject(new AiError(`Couldn't start ${label}. Check its executable and installation.`, 503));
    });
    child.once("close", (code) => {
      cleanup();
      if (failure) reject(failure);
      else if (code !== 0)
        reject(
          new AiError(
            `${label} couldn't complete this request. Check its login, model and usage limit in Terminal, then retry.`,
          ),
        );
      else resolve(Buffer.concat(chunks).toString("utf8"));
    });
    child.stdin.end(input);
  });
}
