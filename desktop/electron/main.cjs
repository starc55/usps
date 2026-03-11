const { app, BrowserWindow } = require("electron");
const path = require("path");
const WebSocket = require("ws");

let mainWindow = null;
let wss = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 430,
    height: 820,
    minWidth: 360,
    minHeight: 520,
    alwaysOnTop: true,
    title: "Load Watcher",
    backgroundColor: "#0b1220",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.setAlwaysOnTop(true, "screen-saver");
}

function startWebSocketServer() {
  try {
    wss = new WebSocket.Server({ port: 17321 });

    wss.on("listening", () => {
      console.log("Desktop WebSocket server listening on ws://127.0.0.1:17321");
    });

    wss.on("connection", (socket) => {
      console.log("Desktop WS client connected");

      socket.on("message", (data) => {
        try {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("feed", data.toString());
          }
        } catch (error) {
          console.error("WS forward error:", error);
        }
      });

      socket.on("close", () => {
        console.log("Desktop WS client disconnected");
      });
    });

    wss.on("error", (err) => {
      console.error("Desktop WebSocket server error:", err);
    });
  } catch (error) {
    console.error("Failed to start desktop websocket server:", error);
  }
}

app.whenReady().then(() => {
  createWindow();
  startWebSocketServer();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (wss) {
    try {
      wss.close();
    } catch {}
  }
});