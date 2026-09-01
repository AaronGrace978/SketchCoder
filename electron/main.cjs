/**
 * SketchCoder Electron shell.
 * Starts the Next.js standalone server, then opens a BrowserWindow.
 */
const { app, BrowserWindow, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const DEFAULT_PORT = Number(process.env.PORT || 3005);
const HOST = process.env.HOSTNAME || "127.0.0.1";

/** @type {import('node:child_process').ChildProcess | null} */
let serverProcess = null;
/** @type {BrowserWindow | null} */
let mainWindow = null;
let serverPort = DEFAULT_PORT;

function isDev() {
  return !app.isPackaged;
}

function resolveServerEntry() {
  if (isDev()) {
    // Dev uses `next dev` separately; Electron just loads the URL.
    return null;
  }
  const resources = process.resourcesPath;
  const candidates = [
    path.join(resources, "app", "apps", "web", "server.js"),
    path.join(resources, "app", "server.js"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function waitForServer(url, attempts = 80) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        n += 1;
        if (n >= attempts) reject(new Error("Server did not start in time"));
        else setTimeout(tick, 250);
      });
    };
    tick();
  });
}

function startProductionServer() {
  const serverPath = resolveServerEntry();
  if (!serverPath) {
    throw new Error(
      "Could not find Next.js server.js in resources. Rebuild the Electron package."
    );
  }

  const serverCwd = path.dirname(serverPath);
  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: serverCwd,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(serverPort),
      HOSTNAME: HOST,
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout?.on("data", (buf) => {
    const line = String(buf).trim();
    if (line) console.log(`[server] ${line}`);
  });
  serverProcess.stderr?.on("data", (buf) => {
    const line = String(buf).trim();
    if (line) console.error(`[server] ${line}`);
  });
  serverProcess.on("exit", (code) => {
    console.log(`[server] exited ${code}`);
    serverProcess = null;
  });
}

function stopServer() {
  if (!serverProcess || serverProcess.killed) return;
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(serverProcess.pid), "/f", "/t"], {
        stdio: "ignore",
      });
    } else {
      serverProcess.kill("SIGTERM");
    }
  } catch {
    /* ignore */
  }
  serverProcess = null;
}

function createWindow(startUrl) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: "#0c0d10",
    show: false,
    autoHideMenuBar: true,
    title: "SketchCoder",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.loadURL(startUrl);
}

async function boot() {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  await app.whenReady();

  let startUrl;
  if (isDev()) {
    const port = process.env.ELECTRON_START_URL_PORT || "3005";
    startUrl = `http://${HOST}:${port}/studio`;
    await waitForServer(`http://${HOST}:${port}`).catch(() => {
      console.warn(
        `Dev server not ready on :${port}. Start with: npm run dev`
      );
    });
  } else {
    startProductionServer();
    startUrl = `http://${HOST}:${serverPort}/studio`;
    await waitForServer(`http://${HOST}:${serverPort}`);
  }

  createWindow(startUrl);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(startUrl);
    }
  });
}

app.on("window-all-closed", () => {
  stopServer();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopServer();
});

boot().catch((err) => {
  console.error(err);
  const { dialog } = require("electron");
  dialog.showErrorBox("SketchCoder failed to start", String(err?.message || err));
  stopServer();
  app.quit();
});
