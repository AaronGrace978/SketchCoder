import type { NodeType, SketchDoc, SketchNode } from "./types";
import { NODE_TYPES } from "./types";
import { detectPatternWord, type PatternWord } from "./patterns";

/** Infer a better node type from its label while keeping a sensible fallback. */
export function inferTypeFromLabel(label: string, fallback: NodeType = "service"): NodeType {
  const t = label.toLowerCase().trim();
  if (!t || t === "untitled" || t === "box" || t === "node") return fallback;

  if (
    /\b(chat\s*ui|frontend|client|browser|sdk|web\s*app|ui|mobile|console)\b/.test(t)
  ) {
    return "client";
  }
  if (/\b(webhook|rest\s*api|http\s*api|gateway|endpoint|ask\s*api|agent\s*api)\b/.test(t)) {
    return "api";
  }
  if (/\b(api)\b/.test(t) && !/\b(openai|anthropic)\b/.test(t)) {
    return "api";
  }
  if (
    /\b(vector|database|db|store|memory|cache|postgres|redis|sqlite|index\.json|corpus\s*store)\b/.test(
      t
    )
  ) {
    return "store";
  }
  if (/\b(llm|gpt|claude|model|ranker|grounded)\b/.test(t)) {
    return "model";
  }
  if (/\b(queue|bus|kafka|sqs|pubsub|job\s*queue|stream)\b/.test(t)) {
    return "queue";
  }
  if (/\b(corpus|provider|vendor|external|s3|source|third[- ]party|tools?)\b/.test(t)) {
    return "external";
  }
  if (
    /\b(embed|chunk|retriev|search|rank|worker|orchestr|ingest|indexer|pipeline)\b/.test(t)
  ) {
    return "service";
  }
  return fallback;
}

export function normalizeNodeTypes(doc: SketchDoc): SketchDoc {
  const nodes: SketchNode[] = doc.nodes.map((n) => {
    const inferred = inferTypeFromLabel(n.label, n.type);
    // Prefer label inference when the label carries meaning and the current
    // type looks like an untyped default.
    const weakType =
      n.label.trim().length > 1 &&
      n.label.toLowerCase() !== "untitled" &&
      (n.type === "service" ||
        n.type === "external" ||
        inferred !== n.type);
    if (weakType && inferred !== n.type) {
      // Only override when label clearly points elsewhere.
      const labelDriven = inferTypeFromLabel(n.label, n.type);
      if (labelDriven !== n.type) {
        return { ...n, type: labelDriven };
      }
    }
    return n;
  });
  return { ...doc, nodes };
}

/** Build a useful intent string from topology when the user left it blank. */
export function synthesizeIntent(doc: SketchDoc): string {
  if (doc.intent.trim()) return doc.intent.trim();
  if (!doc.nodes.length) return "";

  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const labels = doc.nodes.map((n) => n.label).filter(Boolean);
  const hops = doc.edges
    .map((e) => {
      const a = byId.get(e.from)?.label;
      const b = byId.get(e.to)?.label;
      if (!a || !b) return null;
      return e.label ? `${a} -[${e.label}]-> ${b}` : `${a} → ${b}`;
    })
    .filter(Boolean);

  const pattern = detectPatternWord(labels.join(" ")) || detectPatternWord(hops.join(" "));
  const head = pattern
    ? pattern === "rag"
      ? "RAG system"
      : pattern === "crud"
        ? "CRUD API"
        : pattern === "agent" || pattern === "chat"
          ? "Chat agent"
          : pattern === "webhook"
            ? "Webhook worker"
            : "API system"
    : "Sketched system";

  if (hops.length) return `${head}: ${hops.slice(0, 6).join("; ")}`;
  return `${head}: ${labels.join(", ")}`;
}

/**
 * Normalize a sketch before matching/scaffolding:
 * retype from labels, fill empty intent, keep ids/geometry.
 */
export function normalizeSketchDoc(doc: SketchDoc): SketchDoc {
  const typed = normalizeNodeTypes(doc);
  return {
    ...typed,
    intent: synthesizeIntent(typed),
  };
}

export function isNodeType(value: unknown): value is NodeType {
  return typeof value === "string" && (NODE_TYPES as readonly string[]).includes(value);
}

/** Soft OCR / handwriting cleanup before pattern detection. */
export function cleanOcrText(raw: string): string {
  return raw
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const OCR_NEAR: Array<{ pattern: PatternWord; forms: string[] }> = [
  { pattern: "rag", forms: ["rag", "raq", "r4g", "rng", "paq", "rqg", "ras"] },
  { pattern: "crud", forms: ["crud", "cruo", "crnd", "crvd", "orud", "crod"] },
  { pattern: "agent", forms: ["agent", "aqent", "agcnt", "agert", "agents"] },
  { pattern: "webhook", forms: ["webhook", "webhock", "wehbook", "webhooks"] },
  { pattern: "chat", forms: ["chat", "chat", "chqt"] },
  { pattern: "api", forms: ["api", "apl", "ap1"] },
];

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    let prev = i;
    row[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cur = row[j + 1];
      const cost = a[i] === b[j] ? 0 : 1;
      row[j + 1] = Math.min(row[j + 1] + 1, row[j] + 1, prev + cost);
      prev = cur;
    }
  }
  return row[b.length];
}

/** Detect pattern words with OCR typo tolerance. */
export function fuzzyDetectPatternWord(text: string): PatternWord | null {
  const exact = detectPatternWord(text);
  if (exact) return exact;

  const cleaned = cleanOcrText(text).toLowerCase();
  if (!cleaned) return null;
  const compact = cleaned.replace(/\s+/g, "");

  for (const entry of OCR_NEAR) {
    for (const form of entry.forms) {
      if (compact === form) return entry.pattern;
    }
  }

  // Single-token fuzzy (edit distance 1) against canonical words.
  const token = compact.slice(0, 12);
  if (token.length >= 3 && token.length <= 8) {
    for (const entry of OCR_NEAR) {
      const canonical = entry.forms[0];
      if (Math.abs(token.length - canonical.length) > 1) continue;
      if (levenshtein(token, canonical) <= 1) return entry.pattern;
    }
  }

  return null;
}
