import { spawn } from "node:child_process";
import { once } from "node:events";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export async function smokeDesktop(bundle) {
  const temporary = await mkdtemp(join(tmpdir(), "scaffold-release-check-"));
  const serverDirectory = join(temporary, "server");
  await cp(
    bundle ? join(bundle, "Contents/Resources/app/server") : resolve("server"),
    serverDirectory,
    { recursive: true },
  );
  const settings = join(temporary, "settings");
  const workspace = join(temporary, "questions");
  await mkdir(settings);
  await mkdir(workspace);
  await writeFile(join(settings, "workspace.json"), JSON.stringify({ path: workspace }));
  const socket = createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const { port } = socket.address();
  await new Promise((resolve, reject) =>
    socket.close((error) => (error ? reject(error) : resolve())),
  );
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    HOSTNAME: "127.0.0.1",
    PORT: String(port),
    SCAFFOLD_DATA_DIR: settings,
  };
  delete env.OPENAI_API_KEY;
  const child = spawn(
    bundle ? join(bundle, "Contents/MacOS/Scaffold") : process.execPath,
    ["server.js"],
    {
      cwd: serverDirectory,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let log = "";
  let failure;
  child.on("error", (error) => {
    failure = error;
  });
  child.stderr.on("data", (data) => {
    log = (log + data).slice(-4000);
  });
  child.stdout.resume();
  try {
    const origin = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (failure || child.exitCode !== null)
        throw failure || new Error("Packaged server exited early.");
      try {
        const response = await fetch(`${origin}/api/status`, { signal: AbortSignal.timeout(2000) });
        if (response.ok) {
          ready = true;
          break;
        }
        throw new Error(`Packaged status endpoint returned ${response.status}. ${log}`);
      } catch (error) {
        if (error.message.startsWith("Packaged status")) throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!ready) throw new Error(`Packaged server did not start. ${log}`);
    for (const path of ["/api/workspace", "/practice"]) {
      const response = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`Packaged ${path} returned ${response.status}. ${log}`);
      if (path === "/api/workspace") await response.json();
      else if (!(await response.text()).toLowerCase().includes("scaffold"))
        throw new Error("Practice page is missing its app content.");
    }
    console.log("Packaged runtime check passed (isolated temporary workspace).");
  } finally {
    const stopped = once(child, "exit").catch(() => {});
    if (child.exitCode === null) child.kill("SIGTERM");
    await Promise.race([stopped, new Promise((resolve) => setTimeout(resolve, 3000))]);
    if (child.exitCode === null) child.kill("SIGKILL");
    await rm(temporary, { recursive: true, force: true });
  }
}
