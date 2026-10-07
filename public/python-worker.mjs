import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs";

const ready = loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/" });
ready
  .then(() => self.postMessage({ type: "ready" }))
  .catch((error) => self.postMessage({ type: "load-error", error: String(error) }));

self.onmessage = async ({ data }) => {
  let globals;
  try {
    const pyodide = await ready;
    const output = [];
    let outputSize = 0;
    const collect = (line) => {
      if (outputSize < 16000) {
        output.push(line);
        outputSize += line.length;
      }
    };
    pyodide.setStdout({ batched: collect });
    pyodide.setStderr({ batched: collect });
    globals = pyodide.toPy({ __name__: "__main__" });
    // A fresh namespace per run keeps earlier answers from satisfying later tests.
    const result = await pyodide.runPythonAsync(data.code, { globals });
    if (result?.destroy) result.destroy();
    const tests = [];
    for (const test of data.tests) {
      try {
        const passed = pyodide.runPython(`bool(${test.expression})`, { globals });
        tests.push({
          label: test.label,
          passed: passed === true,
          error: passed ? null : "The function returned a different result than expected.",
        });
      } catch (error) {
        tests.push({ label: test.label, passed: false, error: String(error).slice(-2500) });
      }
    }
    self.postMessage({ type: "result", tests, output: output.join("\n"), error: null });
  } catch (error) {
    self.postMessage({ type: "result", tests: [], output: "", error: String(error).slice(-5000) });
  } finally {
    globals?.destroy();
  }
};
