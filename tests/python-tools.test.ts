import { expect, it } from "vitest";
import { pythonTools } from "@/server/python-tools";
it("formats Python without executing it, and formatting is idempotent", () => {
  const source = "raise RuntimeError('never execute')\nx= [1,2,3]\n";
  const formatted = pythonTools("format", source).code;
  expect(formatted).toContain("x = [1, 2, 3]");
  expect(pythonTools("format", formatted).code).toBe(formatted);
});
it("finds undefined names and unused imports with editor offsets", () => {
  const code = 'import os\nname = "😀"\nprint(missing)\n';
  const diagnostics = pythonTools("lint", code).diagnostics;
  const undefinedName = diagnostics.find((d) => d.source === "Ruff F821")!;
  expect(code.slice(undefinedName.from, undefinedName.to)).toBe("missing");
  expect(undefinedName.severity).toBe("error");
  expect(diagnostics.some((d) => d.source === "Ruff F401")).toBe(true);
});
it("reports malformed syntax and refuses to format it", () => {
  expect(pythonTools("lint", "def broken(:\n").diagnostics.length).toBeGreaterThan(0);
  expect(() => pythonTools("format", "def broken(:\n")).toThrow();
});
