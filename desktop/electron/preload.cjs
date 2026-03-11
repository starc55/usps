const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("desktopAPI", {
  isElectron: true
});