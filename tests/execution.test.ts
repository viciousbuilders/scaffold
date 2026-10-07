import { expect, it } from "vitest";
import { runNative } from "@/server/execution/native";
import { runProcess } from "@/server/execution/process";
import { questionSchema } from "@/core/schemas";
import { sampleQuestions } from "@/core/sample";
import { executeJavaScript } from "../public/javascript-worker.mjs";

it("keeps legacy questions compatible and rejects unknown languages", () => {
  const legacy = { ...sampleQuestions[0] } as Partial<(typeof sampleQuestions)[0]>;
  delete legacy.language;
  expect(questionSchema.parse(legacy).language).toBe("python");
  expect(questionSchema.safeParse({ ...legacy, language: "ruby" }).success).toBe(false);
});
it("checks JavaScript closures, async results, output and individual failures", async () => {
  const result = await executeJavaScript('const twice = async n => n * 2; console.log("hello");', [
    { label: "pass", expression: "await twice(3) === 6" },
    { label: "fail", expression: "42" },
    { label: "error", expression: "missing()" },
  ]);
  expect(result.error).toBeNull();
  expect(result.output).toBe("hello");
  expect(result.tests.map((test: { passed: boolean }) => test.passed)).toEqual([
    true,
    false,
    false,
  ]);
  expect(
    (await executeJavaScript("", [{ label: "fresh", expression: "typeof twice === 'undefined'" }]))
      .tests[0].passed,
  ).toBe(true);
  expect((await executeJavaScript("const = broken;", [])).error).toContain("SyntaxError");
});
it("compiles C++ and reports output, false expressions and escaped exceptions", async () => {
  const result = await runNative(
    "cpp",
    'int twice(int n) { std::cout << "hello"; return n * 2; } bool fail() { throw std::runtime_error("bad\\n\\\"value\\\""); }',
    [
      { label: "pass", expression: "twice(3) == 6" },
      { label: "false", expression: "twice(2) == 7" },
      { label: "exception", expression: "fail()" },
    ],
  );
  expect(result.error).toBeNull();
  expect(result.output).toBe("hellohello");
  expect(result.tests.map((test) => test.passed)).toEqual([true, false, false]);
  expect(result.tests[2].error).toBe('bad\n"value"');
}, 30000);
it("returns C++ compiler diagnostics", async () => {
  const result = await runNative("cpp", "invalid syntax", [{ label: "test", expression: "true" }]);
  expect(result.error).toContain("Compilation failed");
  expect(result.tests).toEqual([]);
}, 30000);
it("terminates runaway programs and supports cancellation", async () => {
  expect(
    (await runProcess(process.execPath, ["-e", "while(true) {}"], process.cwd(), 100)).error,
  ).toContain("exceeded");
  const abort = new AbortController();
  const pending = runProcess(
    process.execPath,
    ["-e", "while(true) {}"],
    process.cwd(),
    10000,
    abort.signal,
  );
  abort.abort();
  expect((await pending).error).toContain("cancelled");
  expect(
    (
      await runProcess(
        process.execPath,
        ["-e", "console.log('x'.repeat(100000))"],
        process.cwd(),
        10000,
      )
    ).error,
  ).toContain("64 KB");
});
it.skipIf(process.platform !== "darwin")(
  "explains that CUDA cannot execute on this Mac",
  async () => {
    expect((await runNative("cuda", "", [{ label: "test", expression: "true" }])).error).toContain(
      "NVIDIA",
    );
  },
);
