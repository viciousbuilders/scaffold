"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Question } from "@/core/schemas";

import type { ExecutionResult } from "@/core/execution";

type Pending = { resolve: (result: ExecutionResult) => void; timer: ReturnType<typeof setTimeout> };

export function usePython() {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const [phase, setPhase] = useState<"idle" | "loading" | "running">("idle");

  const finish = useCallback((result: ExecutionResult, terminate = false) => {
    const pending = pendingRef.current;
    if (pending) {
      clearTimeout(pending.timer);
      pendingRef.current = null;
      pending.resolve(result);
    }
    if (terminate) {
      workerRef.current?.terminate();
      workerRef.current = null;
    }
    setPhase("idle");
  }, []);
  const stop = useCallback(
    () =>
      finish(
        {
          tests: [],
          output: "",
          error: "Execution stopped. You can edit your code and run it again.",
        },
        true,
      ),
    [finish],
  );
  useEffect(
    () => () => {
      workerRef.current?.terminate();
      const pending = pendingRef.current;
      if (pending) {
        clearTimeout(pending.timer);
        pending.resolve({ tests: [], output: "", error: "Execution cancelled." });
        pendingRef.current = null;
      }
    },
    [],
  );

  const run = useCallback(
    (code: string, tests: Question["tests"]): Promise<ExecutionResult> => {
      if (pendingRef.current)
        return Promise.resolve({ tests: [], output: "", error: "A run is already in progress." });
      return new Promise((resolve) => {
        const isNew = !workerRef.current;
        setPhase(isNew ? "loading" : "running");
        pendingRef.current = {
          resolve,
          timer: setTimeout(
            () =>
              finish(
                {
                  tests: [],
                  output: "",
                  error: "Python took too long to load. Check your connection and try again.",
                },
                true,
              ),
            isNew ? 90000 : 10000,
          ),
        };
        try {
          if (isNew) {
            const worker = new Worker("/python-worker.mjs", { type: "module" });
            workerRef.current = worker;
            worker.onerror = () =>
              finish(
                {
                  tests: [],
                  output: "",
                  error:
                    "Couldn't load Python. The first run needs an internet connection to download the runtime. Please try again.",
                },
                true,
              );
            worker.onmessage = (event) => {
              if (event.data.type === "ready") {
                setPhase("running");
                const pending = pendingRef.current;
                if (pending) {
                  clearTimeout(pending.timer);
                  pending.timer = setTimeout(
                    () =>
                      finish(
                        {
                          tests: [],
                          output: "",
                          error:
                            "Execution exceeded 10 seconds. Check for an infinite loop and try again.",
                        },
                        true,
                      ),
                    10000,
                  );
                }
              } else if (event.data.type === "load-error")
                finish(
                  {
                    tests: [],
                    output: "",
                    error: "Couldn't download Python. Check your connection and try again.",
                  },
                  true,
                );
              else if (event.data.type === "result") finish(event.data);
            };
          }
          if (!isNew && pendingRef.current) {
            clearTimeout(pendingRef.current.timer);
            pendingRef.current.timer = setTimeout(
              () =>
                finish(
                  {
                    tests: [],
                    output: "",
                    error:
                      "Execution exceeded 10 seconds. Check for an infinite loop and try again.",
                  },
                  true,
                ),
              10000,
            );
          }
          workerRef.current?.postMessage({ code, tests });
        } catch {
          finish(
            {
              tests: [],
              output: "",
              error: "Your browser couldn't start Python. Please try again.",
            },
            true,
          );
        }
      });
    },
    [finish],
  );
  return { run, stop, phase };
}
