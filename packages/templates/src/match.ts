import type { SketchDoc } from "@sketchcoder/graph";
import { fuzzyDetectPatternWord } from "@sketchcoder/graph";
import type { PatternKind, PatternMatch } from "./types";
import { nodeByType } from "./types";

export function matchPattern(doc: SketchDoc): PatternMatch {
  const scores: PatternMatch[] = [
    scoreRag(doc),
    scoreCrud(doc),
    scoreAgent(doc),
    scoreWebhook(doc),
    scoreGeneric(doc),
  ];
  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];
  const second = scores[1]?.score ?? 0;

  // Clear winner, or strong absolute score.
  if (top.kind !== "generic" && (top.score >= 5 || top.score - second >= 2)) {
    return top;
  }
  if (top.kind !== "generic" && top.score >= 4) return top;
  return scoreGeneric(doc);
}

function labelBlob(doc: SketchDoc): string {
  return [
    doc.intent,
    ...doc.nodes.map((n) => `${n.type} ${n.label}`),
    ...doc.edges.map((e) => e.label || ""),
  ].join(" ");
}

function scoreRag(doc: SketchDoc): PatternMatch {
  const store = nodeByType(doc, "store")[0];
  const model = nodeByType(doc, "model")[0];
  const api = nodeByType(doc, "api")[0];
  const client = nodeByType(doc, "client")[0];
  const services = nodeByType(doc, "service");
  const blob = labelBlob(doc);
  const embed =
    services.find((s) => /embed|chunk|index/i.test(s.label)) ?? services[0];
  const retriever =
    services.find((s) => /retriev|search|rank/i.test(s.label)) ??
    services[1] ??
    services[0];
  let score = 0;
  if (store && model) score += 5;
  else {
    if (store) score += 2;
    if (model) score += 2;
  }
  if (services.length >= 2) score += 2;
  else if (services.length) score += 1;
  if (api) score += 1;
  if (client) score += 1;
  if (/rag|citation|retriev|vector|grounded|embed/i.test(blob)) score += 5;
  if (fuzzyDetectPatternWord(doc.intent) === "rag") score += 4;
  if (store && model && (embed || retriever)) score += 2;
  return {
    kind: "rag",
    score,
    slots: compact({
      store,
      model,
      api,
      client,
      embed,
      retriever,
      source: nodeByType(doc, "external")[0],
    }),
  };
}

function scoreCrud(doc: SketchDoc): PatternMatch {
  const store = nodeByType(doc, "store")[0];
  const api = nodeByType(doc, "api")[0];
  const client = nodeByType(doc, "client")[0];
  const model = nodeByType(doc, "model")[0];
  const blob = labelBlob(doc);
  let score = 0;
  if (store && api) score += 5;
  else {
    if (store) score += 2;
    if (api) score += 2;
  }
  if (client) score += 2;
  // Classic Client → API → Store topology.
  if (client && api && store && doc.edges.length >= 2) score += 3;
  if (!model) score += 1;
  if (/crud|rest api|resource|admin|notes|todo/i.test(blob)) score += 5;
  if (fuzzyDetectPatternWord(doc.intent) === "crud" || fuzzyDetectPatternWord(doc.intent) === "api") {
    score += 4;
  }
  if (model) score -= 3;
  if (nodeByType(doc, "queue").length) score -= 2;
  if (/rag|retriev|vector|citation/i.test(blob)) score -= 4;
  return {
    kind: "crud",
    score,
    slots: compact({ store, api, client, service: nodeByType(doc, "service")[0] }),
  };
}

function scoreAgent(doc: SketchDoc): PatternMatch {
  const model = nodeByType(doc, "model")[0];
  const client = nodeByType(doc, "client")[0];
  const tools = [
    ...nodeByType(doc, "external"),
    ...nodeByType(doc, "service"),
  ];
  const blob = labelBlob(doc);
  let score = 0;
  if (model) score += 3;
  if (tools.length >= 1 && model) score += 3;
  if (client) score += 1;
  if (/agent|tool|chat|orchestr|assistant/i.test(blob)) score += 5;
  if (
    fuzzyDetectPatternWord(doc.intent) === "agent" ||
    fuzzyDetectPatternWord(doc.intent) === "chat"
  ) {
    score += 4;
  }
  if (!model) score -= 2;
  if (/rag|retriev|vector|citation/i.test(blob) && nodeByType(doc, "store").length) {
    score -= 3;
  }
  return {
    kind: "agent",
    score,
    slots: compact({
      model,
      client,
      api: nodeByType(doc, "api")[0],
      store: nodeByType(doc, "store")[0],
    }),
  };
}

function scoreWebhook(doc: SketchDoc): PatternMatch {
  const queue = nodeByType(doc, "queue")[0];
  const external = nodeByType(doc, "external")[0];
  const api = nodeByType(doc, "api")[0];
  const blob = labelBlob(doc);
  let score = 0;
  if (queue) score += 5;
  if (external) score += 2;
  if (api) score += 1;
  if (/webhook|worker|ingest|queue|job/i.test(blob)) score += 5;
  if (fuzzyDetectPatternWord(doc.intent) === "webhook") score += 4;
  if (!queue) score -= 2;
  return {
    kind: "webhook",
    score,
    slots: compact({
      queue,
      external,
      api,
      service: nodeByType(doc, "service")[0],
      store: nodeByType(doc, "store")[0],
    }),
  };
}

function scoreGeneric(doc: SketchDoc): PatternMatch {
  return {
    kind: "generic",
    score: 2 + doc.nodes.length * 0.15,
    slots: {},
  };
}

function compact(slots: PatternMatch["slots"]): PatternMatch["slots"] {
  return Object.fromEntries(
    Object.entries(slots).filter(([, v]) => Boolean(v))
  );
}

export const PATTERN_LABEL: Record<PatternKind, string> = {
  rag: "RAG with citations",
  crud: "CRUD API",
  agent: "Chat agent",
  webhook: "Webhook worker",
  generic: "System scaffold",
};
