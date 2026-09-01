import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: root,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  transpilePackages: [
    "@sketchcoder/graph",
    "@sketchcoder/templates",
    "@sketchcoder/agent",
  ],
};

export default nextConfig;
