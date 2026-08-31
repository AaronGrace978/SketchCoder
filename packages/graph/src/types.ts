export const NODE_TYPES = [
  "client",
  "api",
  "service",
  "store",
  "model",
  "queue",
  "external",
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export const NODE_TYPE_META: Record<
  NodeType,
  { label: string; hint: string }
> = {
  client: { label: "Client", hint: "UI, SDK, or caller" },
  api: { label: "API", hint: "HTTP surface" },
  service: { label: "Service", hint: "Logic, embed, retrieve" },
  store: { label: "Store", hint: "DB, vector, cache" },
  model: { label: "Model", hint: "LLM or ranker" },
  queue: { label: "Queue", hint: "Jobs, streams, bus" },
  external: { label: "External", hint: "Vendor or source" },
};

export type NodeShape = "rect" | "rounded" | "diamond";

export type SketchNode = {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  shape: NodeShape;
  notes?: string;
};

export type SketchEdge = {
  id: string;
  from: string;
  to: string;
  label?: string;
};

export type SketchDoc = {
  version: 1;
  intent: string;
  nodes: SketchNode[];
  edges: SketchEdge[];
};

export const DEFAULT_NODE_SIZE = { w: 188, h: 76 };

export function emptyDoc(intent = ""): SketchDoc {
  return { version: 1, intent, nodes: [], edges: [] };
}

export function uid(prefix = "n"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}
