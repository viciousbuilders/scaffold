// Each run gets a fresh worker and lexical scope. No Node or DOM APIs are exposed.
export async function executeJavaScript(code, tests) {
  const lines = [];
  let outputSize = 0;
  const collect = (...values) => {
    const line = values
      .map((value) => {
        if (typeof value === "string") return value;
        try {
          return JSON.stringify(value) ?? String(value);
        } catch {
          return String(value);
        }
      })
      .join(" ");
    if (outputSize < 16000) {
      lines.push(line.slice(0, 16000 - outputSize));
      outputSize += line.length + 1;
    }
  };
  const console = { log: collect, info: collect, warn: collect, error: collect, debug: collect };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  try {
    const evaluate = new AsyncFunction(
      "console",
      `${code}\n;return [${tests.map((test) => `async () => (${test.expression})`).join(",")}];`,
    );
    const checks = await evaluate(console);
    const results = [];
    for (let index = 0; index < tests.length; index++) {
      try {
        const passed = (await checks[index]()) === true;
        results.push({
          label: tests[index].label,
          passed,
          error: passed ? null : "The test expression did not return true.",
        });
      } catch (error) {
        results.push({
          label: tests[index].label,
          passed: false,
          error: String(error).slice(-2500),
        });
      }
    }
    return { tests: results, output: lines.join("\n"), error: null };
  } catch (error) {
    return { tests: [], output: lines.join("\n"), error: String(error).slice(-5000) };
  }
}
if (typeof self !== "undefined" && typeof self.postMessage === "function") {
  self.onmessage = async ({ data }) =>
    self.postMessage(await executeJavaScript(data.code, data.tests));
}
