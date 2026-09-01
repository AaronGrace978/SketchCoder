/**
 * electron-builder strips node_modules from extraResources by default.
 * Force-copy the full Next standalone tree into resources/app after pack.
 */
const fs = require("node:fs");
const path = require("node:path");

exports.default = async function afterPack(context) {
  const root = path.join(__dirname, "..");
  const src = path.join(root, "build", "electron-resources", "app");
  if (!fs.existsSync(src)) {
    throw new Error(`Missing staged app at ${src}. Run npm run stage:electron first.`);
  }

  const dest = path.join(context.appOutDir, "resources", "app");
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });

  const server = path.join(dest, "apps", "web", "server.js");
  const nm = path.join(dest, "node_modules");
  if (!fs.existsSync(server)) {
    throw new Error(`afterPack: server.js missing at ${server}`);
  }
  if (!fs.existsSync(nm)) {
    throw new Error(`afterPack: node_modules missing at ${nm}`);
  }

  console.log(`afterPack: copied standalone app -> ${dest}`);
};
