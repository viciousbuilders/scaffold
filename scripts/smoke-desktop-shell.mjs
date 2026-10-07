import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import electron from "electron";

export async function smokeDesktopShell() {
  const temporary = await mkdtemp(join(tmpdir(), "scaffold-shell-check-"));
  let child;
  let serverPid;
  try {
    await cp(resolve("server"), join(temporary, "server"), { recursive: true });
    await cp(resolve("desktop"), join(temporary, "desktop"), { recursive: true });
    await mkdir(join(temporary, "settings"));
    await mkdir(join(temporary, "questions"));
    await writeFile(
      join(temporary, "settings/workspace.json"),
      JSON.stringify({ path: join(temporary, "questions") }),
    );
    const entry = join(temporary, "check.cjs");
    await writeFile(
      entry,
      `const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const { app } = require("electron");
app.setPath("userData", join(__dirname, "settings"));
let result = 1;
app.on("browser-window-created", (_event, window) => {
  window.webContents.once("did-finish-load", async () => {
    try {
      const server = app.getAppMetrics().find(metric => metric.name === "Scaffold Server");
      assert.ok(server, "The local server must use Electron's background utility process.");
      assert.equal(server.type, "Utility");
      console.log("SCAFFOLD_SERVER_PID=" + server.pid);
      if (process.platform === "darwin") {
        execFileSync("/usr/bin/swift", [
          "-e",
          "import AppKit; guard let app = NSRunningApplication(processIdentifier: " + server.pid + ") else { exit(1) }; if app.activationPolicy == .regular { exit(1) }"
        ], { timeout: 15000 });
      }
      const origin = new URL(window.webContents.getURL()).origin;
      for (const path of ["/api/status", "/api/workspace", "/practice"]) {
        const response = await fetch(origin + path, { signal: AbortSignal.timeout(10000) });
        assert.equal(response.status, 200, path);
        if (path === "/practice") assert.match(await response.text(), /scaffold/i);
        else await response.json();
      }
      result = 0;
    } catch (error) {
      console.error(error);
    } finally {
      app.quit();
    }
  });
});
app.on("will-quit", () => { process.exitCode = result; });
require("./desktop/main.cjs");
`,
    );
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.OPENAI_API_KEY;
    child = spawn(electron, [entry], { env, stdio: ["ignore", "pipe", "pipe"] });
    let log = "";
    const collect = (chunk) => {
      log = (log + chunk).slice(-8000);
      const match = log.match(/SCAFFOLD_SERVER_PID=(\d+)/);
      if (match) serverPid = Number(match[1]);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    let timer;
    try {
      const [code] = await Promise.race([
        once(child, "exit"),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Desktop shell timed out. ${log}`)), 60000);
        }),
      ]);
      assert.equal(code, 0, `Desktop shell check failed. ${log}`);
      assert.ok(serverPid, "Desktop shell did not report its server process.");
      for (let attempt = 0; attempt < 40; attempt++) {
        try {
          process.kill(serverPid, 0);
        } catch (error) {
          if (error.code !== "ESRCH") throw error;
          serverPid = undefined;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.equal(serverPid, undefined, "Quitting Scaffold must stop its local server.");
    } finally {
      clearTimeout(timer);
    }
    console.log("Desktop shell check passed (background server, page loading, and shutdown).");
  } finally {
    if (child && child.exitCode === null) {
      const stopped = once(child, "exit");
      child.kill("SIGKILL");
      await stopped;
    }
    if (serverPid) {
      try {
        process.kill(serverPid, "SIGKILL");
      } catch {}
    }
    await rm(temporary, { recursive: true, force: true });
  }
}
