import type { SketchDoc } from "./types";
import { ragDemoDoc } from "./demos";

export type PatternWord =
  | "rag"
  | "crud"
  | "agent"
  | "webhook"
  | "chat"
  | "api";

const WORD_ALIASES: Array<{ pattern: PatternWord; words: string[] }> = [
  {
    pattern: "rag",
    words: ["rag", "retrieval", "citations", "vector", "retriever"],
  },
  {
    pattern: "crud",
    words: ["crud", "rest", "resource", "admin"],
  },
  {
    pattern: "agent",
    words: ["agent", "tools", "orchestrator"],
  },
  {
    pattern: "webhook",
    words: ["webhook", "worker", "queue", "jobs"],
  },
  {
    pattern: "chat",
    words: ["chat", "assistant"],
  },
  {
    pattern: "api",
    words: ["api", "backend", "server"],
  },
];

export function detectPatternWord(text: string): PatternWord | null {
  const raw = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const compact = raw.replace(/\s+/g, "");
  for (const entry of WORD_ALIASES) {
    for (const word of entry.words) {
      if (compact === word || compact.includes(word) || new RegExp(`\\b${word}\\b`).test(raw)) {
        return entry.pattern;
      }
    }
  }
  // Handwriting OCR often returns spaced letters: "R A G"
  const letters = raw.replace(/\s+/g, "");
  if (letters === "rag") return "rag";
  if (letters === "crud") return "crud";
  if (letters === "api") return "api";
  return null;
}

export function docForPattern(pattern: PatternWord, intentHint = ""): SketchDoc {
  switch (pattern) {
    case "rag":
      return {
        ...ragDemoDoc(),
        intent:
          intentHint ||
          ragDemoDoc().intent,
      };
    case "crud":
      return crudDemoDoc(intentHint);
    case "agent":
    case "chat":
      return agentDemoDoc(intentHint);
    case "webhook":
      return webhookDemoDoc(intentHint);
    case "api":
      return crudDemoDoc(intentHint || "REST API with CRUD resources");
    default:
      return ragDemoDoc();
  }
}

export function crudDemoDoc(intent = "CRUD API for notes with list create update delete"): SketchDoc {
  return {
    version: 1,
    intent,
    nodes: [
      {
        id: "n_client",
        type: "client",
        label: "Client",
        x: 80,
        y: 180,
        w: 188,
        h: 76,
        shape: "rounded",
      },
      {
        id: "n_api",
        type: "api",
        label: "REST API",
        x: 340,
        y: 180,
        w: 188,
        h: 76,
        shape: "rect",
      },
      {
        id: "n_store",
        type: "store",
        label: "Database",
        x: 600,
        y: 180,
        w: 188,
        h: 76,
        shape: "rect",
      },
    ],
    edges: [
      { id: "e1", from: "n_client", to: "n_api", label: "http" },
      { id: "e2", from: "n_api", to: "n_store", label: "persist" },
    ],
  };
}

export function agentDemoDoc(
  intent = "Chat agent with tools for search and memory"
): SketchDoc {
  return {
    version: 1,
    intent,
    nodes: [
      {
        id: "n_ui",
        type: "client",
        label: "Chat UI",
        x: 80,
        y: 160,
        w: 188,
        h: 76,
        shape: "rounded",
      },
      {
        id: "n_api",
        type: "api",
        label: "Agent API",
        x: 340,
        y: 160,
        w: 188,
        h: 76,
        shape: "rect",
      },
      {
        id: "n_model",
        type: "model",
        label: "LLM",
        x: 600,
        y: 80,
        w: 188,
        h: 76,
        shape: "rect",
      },
      {
        id: "n_tools",
        type: "external",
        label: "Tools",
        x: 600,
        y: 240,
        w: 188,
        h: 76,
        shape: "rounded",
      },
      {
        id: "n_mem",
        type: "store",
        label: "Memory",
        x: 860,
        y: 160,
        w: 188,
        h: 76,
        shape: "rect",
      },
    ],
    edges: [
      { id: "e1", from: "n_ui", to: "n_api", label: "message" },
      { id: "e2", from: "n_api", to: "n_model" },
      { id: "e3", from: "n_model", to: "n_tools", label: "call" },
      { id: "e4", from: "n_api", to: "n_mem" },
    ],
  };
}

export function webhookDemoDoc(
  intent = "Webhook worker that enqueues provider events"
): SketchDoc {
  return {
    version: 1,
    intent,
    nodes: [
      {
        id: "n_ext",
        type: "external",
        label: "Provider",
        x: 80,
        y: 180,
        w: 188,
        h: 76,
        shape: "rect",
      },
      {
        id: "n_api",
        type: "api",
        label: "Webhook",
        x: 340,
        y: 180,
        w: 188,
        h: 76,
        shape: "rect",
      },
      {
        id: "n_queue",
        type: "queue",
        label: "Queue",
        x: 600,
        y: 180,
        w: 188,
        h: 76,
        shape: "rounded",
      },
      {
        id: "n_worker",
        type: "service",
        label: "Worker",
        x: 860,
        y: 180,
        w: 188,
        h: 76,
        shape: "rounded",
      },
    ],
    edges: [
      { id: "e1", from: "n_ext", to: "n_api", label: "POST" },
      { id: "e2", from: "n_api", to: "n_queue", label: "enqueue" },
      { id: "e3", from: "n_queue", to: "n_worker", label: "drain" },
    ],
  };
}
