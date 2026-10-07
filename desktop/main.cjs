const { app, BrowserWindow, dialog, ipcMain, shell, Menu, utilityProcess } = require("electron");
const { createServer } = require("node:net");
const { join } = require("node:path");
const fs = require("node:fs/promises");
app.setName("Scaffold");
let server;
let window;
let origin;
const root = join(__dirname, "..");
const dataDir = app.getPath("userData");
async function freePort() {
  return new Promise((resolve, reject) => {
    const socket = createServer();
    socket.on("error", reject);
    socket.listen(0, "127.0.0.1", () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
}
async function startServer() {
  const port = await freePort();
  const script = join(root, "server", "server.js");
  const development = process.argv.includes("--dev");
  const env = {
    ...process.env,
    HOSTNAME: "127.0.0.1",
    PORT: String(port),
    SCAFFOLD_DATA_DIR: dataDir,
  };
  delete env.OPENAI_API_KEY;
  delete env.ELECTRON_RUN_AS_NODE;
  const args = development
    ? [
        join(root, "node_modules/next/dist/bin/next"),
        "dev",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(port),
      ]
    : [script];
  // Use the background helper; launching the app executable as Node adds a Dock icon.
  server = utilityProcess.fork(args[0], args.slice(1), {
    env,
    cwd: development ? root : join(root, "server"),
    stdio: ["ignore", "pipe", "pipe"],
    serviceName: "Scaffold Server",
  });
  let log = "";
  server.stdout.on("data", () => {});
  server.stderr.on("data", (chunk) => {
    log = (log + chunk.toString()).slice(-2000);
  });
  let failed = false;
  server.on("error", () => {
    failed = true;
  });
  server.on("exit", () => {
    failed = true;
  });
  origin = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (failed) throw new Error(`The local app couldn't start. ${log}`);
    try {
      const response = await fetch(`${origin}/api/status`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("The local app took too long to start.");
}
function createWindow() {
  window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 760,
    minHeight: 620,
    title: "Scaffold",
    icon: join(__dirname, "assets", "icon.png"),
    backgroundColor: "#f1f5f3",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== origin) {
      event.preventDefault();
      if (url.startsWith("https://")) void shell.openExternal(url);
    }
  });
  window.on("close", (event) => {
    if (window.__closing) return;
    event.preventDefault();
    // Wait for progress to reach disk before stopping the local process.
    window.webContents
      .executeJavaScript(
        "window.scaffoldFlushProgress ? window.scaffoldFlushProgress() : Promise.resolve()",
      )
      .catch(() => {})
      .finally(() => {
        window.__closing = true;
        window.close();
      });
  });
  void window.loadURL(origin);
}
function trusted(event) {
  return event.senderFrame && new URL(event.senderFrame.url).origin === origin;
}
ipcMain.handle("workspace:choose", async (event) => {
  if (!trusted(event)) return null;
  const result = await dialog.showOpenDialog(window, {
    title: "Open study workspace",
    properties: ["openDirectory", "createDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle("workspace:reveal", async (event, path) => {
  if (!trusted(event)) return;
  const settings = JSON.parse(
    await fs.readFile(join(dataDir, "workspace.json"), "utf8").catch(() => "{}"),
  );
  const { homedir } = require("node:os");
  if (path === (settings.path || join(homedir(), "Documents", "Scaffold")))
    await shell.openPath(path);
});
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });
  app
    .whenReady()
    .then(async () => {
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          {
            label: "Scaffold",
            submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }],
          },
          { role: "editMenu" },
          { role: "viewMenu" },
          { role: "windowMenu" },
        ]),
      );
      await startServer();
      createWindow();
    })
    .catch((error) => {
      dialog.showErrorBox("Scaffold could not start", error.message);
      app.quit();
    });
  app.on("window-all-closed", () => app.quit());
  app.on("will-quit", () => {
    server?.kill();
  });
}
