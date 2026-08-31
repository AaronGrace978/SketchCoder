import type { NodeType } from "@sketchcoder/graph";

export const TYPE_TONE: Record<NodeType, string> = {
  client: "var(--bone)",
  api: "var(--brass)",
  service: "var(--mist)",
  store: "var(--sage)",
  model: "var(--brass)",
  queue: "var(--mist)",
  external: "var(--muted)",
};
