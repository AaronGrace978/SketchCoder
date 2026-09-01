/**
 * Cross-platform launcher for SketchCoder standalone server.
 * Packaged with pkg — runs server.js from ./app beside the binary.
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const PORT = Number(process.env.PORT || 3005);
const HOST = process.env.HOSTNAME || "127.0.0.1";
const root = path.dirname(process.execPath);

function resolveAppDir() {
  const execDir = path.dirname(process.execPath);
  const candidates = [
    path.join(execDir, "app"),
    path.join(execDir, "..", "Resources", "app"),
    path.join(execDir, "..", "..", "app"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(path.join(p, "apps", "web", "server.js")) || fs.existsSync(path.join(p, "server.js"))) {
      return p;
    }
  }
  return path.join(root, "app");
}

const appDir = resolveAppDir();

function findServer() {
  const candidates = [
    path.join(appDir, "apps", "web", "server.js"),
    path.join(appDir, "server.js"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function openBrowser(url) {
  const plat = process.platform;
  if (plat === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
  } else if (plat === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
  } else {
    spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
  }
}

function waitForServer(url, attempts = 40) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        n += 1;
        if (n >= attempts) reject(new Error("Server did not start"));
        else setTimeout(tick, 250);
      });
    };
    tick();
  });
}

function main() {
  const serverPath = findServer();
  if (!serverPath) {
    console.error("");
    console.error("  SketchCoder could not find the app folder.");
    console.error("  Expected: app/apps/web/server.js next to this program.");
    console.error("");
    process.exit(1);
  }

  const serverCwd = path.dirname(serverPath);
  const url = `http://${HOST}:${PORT}/studio`;

  console.log("");
  console.log("  SketchCoder");
  console.log("  Starting studio…");
  console.log("");

  const child = spawn(process.execPath, [serverPath], {
    cwd: serverCwd,
    env: {
      ...process.env,
      PORT: String(PORT),
      HOSTNAME: HOST,
      NODE_ENV: "production",
    },
    stdio: "inherit",
  });

  child.on("exit", (code) => process.exit(code ?? 0));

  waitForServer(`http://${HOST}:${PORT}`)
    .then(() => {
      console.log(`  Open ${url}`);
      console.log("  Press Ctrl+C to stop.");
      console.log("");
      openBrowser(url);
    })
    .catch(() => {
      console.log("  Server is starting — open", url);
    });
}

main();
