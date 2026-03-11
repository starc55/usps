const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopAPI", {
  onFeed(callback) {
    ipcRenderer.on("feed", (_, payload) => callback(payload));
  }
});