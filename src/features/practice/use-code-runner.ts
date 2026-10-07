"use client";

import { useEffect, useRef, useState } from "react";
import {
  executionResultSchema,
  nativeCapabilitiesSchema,
  type CodingLanguage,
  type ExecutionResult,
} from "@/core/execution";
import type { Question } from "@/core/schemas";
import { postApi } from "@/ui/api";
import { usePython } from "./use-python";

const cancelled = (): ExecutionResult => ({ tests: [], output: "", error: "Execution stopped." });
export function useCodeRunner(language: CodingLanguage) {
  const python = usePython();
  const [running, setRunning] = useState(false);
  const [capability, setCapability] = useState({
    available: false,
    message: "Checking compiler…",
    language,
  });
  const native = language === "cpp" || language === "cuda";
  const active = useRef<{ cancel: () => void } | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current?.cancel();
    };
  }, []);
  useEffect(() => {
    if (!native) return;
    const abort = new AbortController();
    fetch("/api/run", { signal: abort.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Couldn't check the compiler. Reopen this question to retry.");
        const capabilities = nativeCapabilitiesSchema.parse(await response.json());
        setCapability({ ...capabilities[language as "cpp" | "cuda"], language });
      })
      .catch((error) => {
        if (!abort.signal.aborted)
          setCapability({ available: false, message: error.message, language });
      });
    return () => abort.abort();
  }, [language, native]);

  async function run(code: string, tests: Question["tests"]): Promise<ExecutionResult> {
    if (language === "python") return python.run(code, tests);
    if (active.current) return { tests: [], output: "", error: "A run is already in progress." };
    if (native && !capability.available)
      return { tests: [], output: "", error: capability.message };
    setRunning(true);
    try {
      if (native) {
        const abort = new AbortController();
        active.current = { cancel: () => abort.abort() };
        return await postApi("run", { language, code, tests }, executionResultSchema, abort.signal);
      }
      return await new Promise<ExecutionResult>((resolve) => {
        const worker = new Worker("/javascript-worker.mjs", { type: "module" });
        const finish = (result: ExecutionResult) => {
          clearTimeout(timer);
          worker.terminate();
          resolve(result);
        };
        const timer = setTimeout(
          () =>
            finish({
              tests: [],
              output: "",
              error: "Execution exceeded 10 seconds. Check for an infinite loop.",
            }),
          10000,
        );
        active.current = { cancel: () => finish(cancelled()) };
        worker.onmessage = (event) => {
          const parsed = executionResultSchema.safeParse(event.data);
          finish(
            parsed.success
              ? parsed.data
              : { tests: [], output: "", error: "Invalid JavaScript test results." },
          );
        };
        worker.onerror = () =>
          finish({
            tests: [],
            output: "",
            error: "Couldn't run JavaScript. Check your code and try again.",
          });
        worker.postMessage({ code, tests });
      });
    } catch (error) {
      return {
        tests: [],
        output: "",
        error: error instanceof Error ? error.message : "Execution failed.",
      };
    } finally {
      active.current = null;
      if (mounted.current) setRunning(false);
    }
  }
  return {
    run,
    stop: () => {
      python.stop();
      active.current?.cancel();
    },
    phase: running ? "running" : python.phase,
    capability: native
      ? capability.language === language
        ? capability
        : { available: false, message: "Checking compiler…" }
      : { available: true, message: "" },
  };
}
