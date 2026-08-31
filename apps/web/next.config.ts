import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@sketchcoder/graph",
    "@sketchcoder/templates",
    "@sketchcoder/agent",
  ],
};

export default nextConfig;
