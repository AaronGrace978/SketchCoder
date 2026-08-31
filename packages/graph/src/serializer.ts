import type { SketchDoc } from "./types";
import { NODE_TYPES } from "./types";

export function serializeDoc(doc: SketchDoc): string {
  return JSON.stringify(doc, null, 2);
}

export function parseDoc(raw: string): SketchDoc {
  const data = JSON.parse(raw) as SketchDoc;
  const result = validateDoc(data);
  if (!result.ok) throw new Error(result.error);
  return result.doc;
}

export function validateDoc(
  data: unknown
): { ok: true; doc: SketchDoc } | { ok: false; error: string } {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Document must be an object" };
  }
  const doc = data as SketchDoc;
  if (doc.version !== 1) {
    return { ok: false, error: "Unsupported document version" };
  }
  if (typeof doc.intent !== "string") {
    return { ok: false, error: "intent must be a string" };
  }
  if (!Array.isArray(doc.nodes) || !Array.isArray(doc.edges)) {
    return { ok: false, error: "nodes and edges must be arrays" };
  }

  const ids = new Set<string>();
  for (const node of doc.nodes) {
    if (!node?.id || typeof node.label !== "string") {
      return { ok: false, error: "Each node needs id and label" };
    }
    if (!NODE_TYPES.includes(node.type)) {
      return { ok: false, error: `Unknown node type: ${String(node.type)}` };
    }
    ids.add(node.id);
  }
  for (const edge of doc.edges) {
    if (!edge?.id || !ids.has(edge.from) || !ids.has(edge.to)) {
      return { ok: false, error: "Edge must connect existing nodes" };
    }
  }
  return { ok: true, doc };
}

export function graphSummary(doc: SketchDoc): string {
  const types = doc.nodes.map((n) => `${n.type}:${n.label}`).join(", ");
  const links = doc.edges
    .map((e) => {
      const from = doc.nodes.find((n) => n.id === e.from)?.label ?? e.from;
      const to = doc.nodes.find((n) => n.id === e.to)?.label ?? e.to;
      return e.label ? `${from} -[${e.label}]-> ${to}` : `${from} -> ${to}`;
    })
    .join("; ");
  return [
    `Intent: ${doc.intent || "(none)"}`,
    `Nodes (${doc.nodes.length}): ${types || "(none)"}`,
    `Edges (${doc.edges.length}): ${links || "(none)"}`,
  ].join("\n");
}

export function topologicalOrder(doc: SketchDoc): string[] {
  const incoming = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of doc.nodes) {
    incoming.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of doc.edges) {
    adj.get(e.from)?.push(e.to);
    incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1);
  }
  const queue = [...incoming.entries()]
    .filter(([, c]) => c === 0)
    .map(([id]) => id);
  const out: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    out.push(id);
    for (const next of adj.get(id) ?? []) {
      const count = (incoming.get(next) ?? 1) - 1;
      incoming.set(next, count);
      if (count === 0) queue.push(next);
    }
  }
  for (const n of doc.nodes) {
    if (!out.includes(n.id)) out.push(n.id);
  }
  return out;
}
