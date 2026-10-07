import "server-only";
import { spawn } from "node:child_process";

export interface ProcessResult {
  stdout: string;
  stderr: string;
  error: string | null;
}
export function runProcess(
  binary: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<ProcessResult> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve({ stdout: "", stderr: "", error: "Execution cancelled." });
      return;
    }
    const env = { ...process.env };
    delete env.OPENAI_API_KEY;
    const child = spawn(/* turbopackIgnore: true */ binary, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });
    let stdout = "",
      stderr = "",
      size = 0;
    let failure: string | null = null;
    const stop = (message: string) => {
      failure = message;
      try {
        if (child.pid && process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch {
        /* Already exited. */
      }
    };
    const timer = setTimeout(
      () => stop(`Execution exceeded ${timeoutMs / 1000} seconds.`),
      timeoutMs,
    );
    const abort = () => stop("Execution cancelled.");
    signal?.addEventListener("abort", abort, { once: true });
    const collect = (chunk: Buffer, stream: "stdout" | "stderr") => {
      size += chunk.length;
      if (size > 64000) {
        stop("Output exceeded the 64 KB limit.");
        return;
      }
      if (stream === "stdout") stdout += chunk.toString();
      else stderr += chunk.toString();
    };
    child.stdout.on("data", (chunk) => collect(chunk, "stdout"));
    child.stderr.on("data", (chunk) => collect(chunk, "stderr"));
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    };
    child.once("error", (error) => {
      cleanup();
      resolve({
        stdout,
        stderr,
        error: `Couldn't start the compiler or program: ${error.message}`,
      });
    });
    child.once("close", (code, exitSignal) => {
      cleanup();
      resolve({
        stdout,
        stderr,
        error:
          failure ||
          (code === 0
            ? null
            : `Process ${exitSignal ? `was terminated by ${exitSignal}` : `exited with code ${code}`}.`),
      });
    });
  });
}
