import { Workspace, PositionEncoding, type Diagnostic } from "@astral-sh/ruff-wasm-nodejs";
import type { PythonToolsResult } from "@/core/python-tools";

export function pythonTools(action: "lint" | "format", code: string): PythonToolsResult {
  const workspace = new Workspace(
    {
      "line-length": 88,
      lint: { select: ["E4", "E7", "E9", "F"] },
    },
    PositionEncoding.Utf16,
  );
  try {
    if (action === "format") return { code: workspace.format(code), diagnostics: [] };
    const lines = code.split("\n");
    const starts = [0];
    for (let i = 0; i < lines.length - 1; i++) starts.push(starts[i] + lines[i].length + 1);
    function offset(location: { row: number; column: number }) {
      const line = Math.max(0, Math.min(lines.length - 1, location.row - 1));
      return starts[line] + Math.min(lines[line].length, Math.max(0, location.column - 1));
    }
    return {
      code,
      diagnostics: (workspace.check(code) as Diagnostic[]).map((d) => ({
        from: offset(d.start_location),
        to: offset(d.end_location),
        severity:
          d.code === null || d.code === "F821" || d.code === "F822" || d.code === "F823"
            ? "error"
            : "warning",
        message: d.message,
        source: d.code ? `Ruff ${d.code}` : "Python syntax",
      })),
    };
  } finally {
    workspace.free();
  }
}
