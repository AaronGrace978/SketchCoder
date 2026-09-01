/**
 * Stage Next.js standalone output into build/electron-resources/app
 * for electron-builder extraResources.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const web = path.join(root, "apps", "web");
const standalone = path.join(web, ".next", "standalone");
const staticDir = path.join(web, ".next", "static");
const publicDir = path.join(web, "public");
const out = path.join(root, "build", "electron-resources", "app");

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function cp(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}

if (!fs.existsSync(standalone)) {
  console.error("Standalone build missing. Run: npm run build");
  process.exit(1);
}
if (!fs.existsSync(staticDir)) {
  console.error("Static build missing at apps/web/.next/static");
  process.exit(1);
}

rmrf(out);
fs.mkdirSync(out, { recursive: true });
cp(standalone, out);

const staticDest = path.join(out, "apps", "web", ".next", "static");
fs.mkdirSync(path.dirname(staticDest), { recursive: true });
cp(staticDir, staticDest);

if (fs.existsSync(publicDir)) {
  cp(publicDir, path.join(out, "apps", "web", "public"));
}

const serverJs = path.join(out, "apps", "web", "server.js");
if (!fs.existsSync(serverJs)) {
  console.error("Expected server.js at", serverJs);
  process.exit(1);
}

console.log("Staged Electron app resources ->", out);
