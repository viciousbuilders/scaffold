import "server-only";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { executionResultSchema, type ExecutionResult } from "@/core/execution";
import type { Question } from "@/core/schemas";
import { runProcess } from "./process";
import { toolchains } from "./toolchains";

const nativeTestsSchema = executionResultSchema.shape.tests.element.omit({ label: true }).array();
function harness(code: string, tests: Question["tests"], marker: string) {
  const checks = tests
    .map(
      (test, index) => String.raw`
    ${index ? 'scaffold_results << ",";' : ""}
    try { const bool passed = static_cast<bool>((${test.expression})); scaffold_results << "{\"passed\":" << (passed ? "true" : "false") << ",\"error\":" << (passed ? "null" : "\"The expression returned false.\"") << "}"; }
    catch (const std::exception& error) { scaffold_results << "{\"passed\":false,\"error\":" << scaffold_json(error.what()) << "}"; }
    catch (...) { scaffold_results << "{\"passed\":false,\"error\":\"Unknown exception.\"}"; }
  `,
    )
    .join("\n");
  return String.raw`#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <array>
#include <cmath>
#include <algorithm>
#include <numeric>
#include <stdexcept>
#include <cstdio>
${code}
static std::string scaffold_json(const std::string& text) {
  std::string result = "\"";
  for (unsigned char c : text) { if (c == '"' || c == '\\') { result += '\\'; result += c; } else if (c < 32) { char escape[7]; std::snprintf(escape, sizeof escape, "\\u%04x", c); result += escape; } else { result += c; } }
  return result + "\"";
}
int main() { std::ostringstream scaffold_results; scaffold_results << "["; ${checks} scaffold_results << "]"; std::cout << "\n${marker}\n" << scaffold_results.str() << std::endl; }
`;
}
export async function runNative(
  language: "cpp" | "cuda",
  code: string,
  tests: Question["tests"],
  signal?: AbortSignal,
): Promise<ExecutionResult> {
  const tools = await toolchains();
  const tool = tools[language];
  if (!tool.available || !tool.binary) return { tests: [], output: "", error: tool.message };
  const directory = await mkdtemp(join(tmpdir(), "scaffold-run-"));
  try {
    const source = join(directory, language === "cuda" ? "answer.cu" : "answer.cpp");
    const binary = join(directory, "answer");
    const marker = `SCAFFOLD_${crypto.randomUUID().replaceAll("-", "")}`;
    await writeFile(source, harness(code, tests, marker), { mode: 0o600 });
    const compiled = await runProcess(
      tool.binary,
      ["-std=c++17", "-O0", source, "-o", binary],
      directory,
      20000,
      signal,
    );
    if (compiled.error)
      return {
        tests: [],
        output: "",
        error:
          `Compilation failed. Write functions only; Scaffold supplies main().\n${compiled.error}\n${compiled.stderr}`.slice(
            -8000,
          ),
      };
    const execution = await runProcess(binary, [], directory, 10000, signal);
    if (execution.error)
      return {
        tests: [],
        output: [execution.stdout, execution.stderr].filter(Boolean).join("\n"),
        error: execution.error,
      };
    const separator = `\n${marker}\n`;
    const position = execution.stdout.lastIndexOf(separator);
    if (position < 0)
      return {
        tests: [],
        output: execution.stdout,
        error: "The program exited before producing test results.",
      };
    const parsed = nativeTestsSchema.parse(
      JSON.parse(execution.stdout.slice(position + separator.length)),
    );
    if (parsed.length !== tests.length) throw new Error("Incomplete tests");
    return {
      tests: parsed.map((test, index) => ({ ...test, label: tests[index].label })),
      output: [execution.stdout.slice(0, position), execution.stderr].filter(Boolean).join("\n"),
      error: null,
    };
  } catch (error) {
    return {
      tests: [],
      output: "",
      error:
        error instanceof z.ZodError
          ? "The program returned invalid test results."
          : "Couldn't compile or run this code. Please try again.",
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
