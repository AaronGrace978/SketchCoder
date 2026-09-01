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
  { pattern: "rag", words: ["rag", "retrieval", "citations"] },
  { pattern: "crud", words: ["crud"] },
  { pattern: "agent", words: ["agent", "orchestrator"] },
  { pattern: "webhook", words: ["webhook", "worker"] },
  { pattern: "chat", words: ["chat", "assistant"] },
  { pattern: "api", words: ["api"] },
];

export function detectPatternWord(text: string): PatternWord | null {
  const raw = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  if (!raw) return null;
  const compact = raw.replace(/\s+/g, "");
  const letters = compact;

  // Exact compact matches first (handwriting / OCR).
  if (letters === "rag" || letters === "rrag" || letters === "ragpipeline") return "rag";
  if (letters === "crud" || letters === "crudapi") return "crud";
  if (letters === "agent" || letters === "agents" || letters === "aiagent") return "agent";
  if (letters === "webhook" || letters === "webhooks") return "webhook";
  if (letters === "chat" || letters === "chatbot") return "chat";
  if (letters === "api" || letters === "restapi") return "api";

  // Spaced handwriting: "R A G", "C R U D"
  const spaced = raw.replace(/\s+/g, "");
  if (/^r\s*a\s*g$/i.test(raw) || spaced === "rag") return "rag";
  if (/^c\s*r\s*u\s*d$/i.test(raw) || spaced === "crud") return "crud";

  for (const entry of WORD_ALIASES) {
    for (const word of entry.words) {
      if (compact === word) return entry.pattern;
      if (new RegExp(`\\b${word}\\b`).test(raw)) return entry.pattern;
    }
  }

  // Soft aliases only as whole words / phrases in longer intent strings.
  if (
    /\bcitations?\b|\bvector\s*store\b|\bretriev|\bgrounded\s*llm\b|\bembedder\b|\brag\b/i.test(
      raw
    )
  ) {
    return "rag";
  }
  if (/\brest\s*api\b|\bcrud\b|\bresource\b|\badmin\s*api\b/i.test(raw)) return "crud";
  if (/\bwebhook\b|\bqueue\b|\bjobs?\b|\bingest\b|\bworker\b/i.test(raw)) return "webhook";
  if (/\btools?\b|\borchestr|\bchat\s*agent\b|\breact\s*agent\b/i.test(raw)) return "agent";
  if (/\bchat\s*ui\b|\bassistant\b/i.test(raw) && !/\brag\b|\bretriev/i.test(raw)) {
    return "chat";
  }

  return null;
}

export function docForPattern(pattern: PatternWord, intentHint = ""): SketchDoc {
  switch (pattern) {
    case "rag":
      return {
        ...ragDemoDoc(),
        intent: intentHint?.trim() || ragDemoDoc().intent,
      };
    case "crud":
      return crudDemoDoc(intentHint);
    case "agent":
    case "chat":
      return agentDemoDoc(intentHint);
    case "webhook":
      return webhookDemoDoc(intentHint);
    case "api":
      return crudDemoDoc(intentHint || "REST API for notes with list create update delete");
    default:
      return ragDemoDoc();
  }
}

/**
 * Neutral starting point when the board has marks we could not read.
 * Better to hand back a runnable Client → API → Store than nothing.
 */
export function starterDoc(intentHint = ""): SketchDoc {
  return crudDemoDoc(
    intentHint.trim() || "Starter system: client, API, and a store"
  );
}

export function crudDemoDoc(intent = "CRUD API for notes with list create update delete"): SketchDoc {
  return {
    version: 1,
    intent: intent.trim() || "CRUD API for notes with list create update delete",
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
    intent: intent.trim() || "Chat agent with tools for search and memory",
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
    intent: intent.trim() || "Webhook worker that enqueues provider events",
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
