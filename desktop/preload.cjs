const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("scaffoldDesktop", {
  chooseWorkspace: () => ipcRenderer.invoke("workspace:choose"),
  revealWorkspace: (path) => ipcRenderer.invoke("workspace:reveal", path),
});
