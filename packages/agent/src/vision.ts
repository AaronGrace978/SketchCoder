import type { NodeShape, SketchDoc, SketchNode } from "@sketchcoder/graph";
import {
  detectPatternWord,
  docForPattern,
  fuzzyDetectPatternWord,
  isNodeType,
  normalizeSketchDoc,
  type PatternWord,
} from "@sketchcoder/graph";
import { parseModelJson } from "./parse";

export type VisionRead = {
  text: string;
  pattern: PatternWord | null;
  intent: string;
  doc: SketchDoc | null;
  source: "vision" | "offline" | "graph" | "ocr";
};

export async function readSketchImage(options: {
  imageDataUrl: string;
  doc: SketchDoc;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  ocrText?: string;
}): Promise<VisionRead> {
  const { imageDataUrl, doc, apiKey, baseUrl, model, ocrText } = options;

  // OCR / typed word wins so spelling RAG still builds even with stray boxes.
  const fromOcr = resolveFromText(ocrText || "", doc);
  if (fromOcr) return fromOcr;

  // Strong intent alone (e.g. "Production RAG…") should not wait on vision.
  const intentPattern = fuzzyDetectPatternWord(doc.intent);
  if (intentPattern && doc.nodes.length < 3) {
    const canned = docForPattern(intentPattern, doc.intent);
    return {
      text: intentPattern.toUpperCase(),
      pattern: intentPattern,
      intent: canned.intent,
      doc: canned,
      source: "offline",
    };
  }

  if (apiKey && imageDataUrl.startsWith("data:image")) {
    const vision = await callVision({
      imageDataUrl,
      doc,
      apiKey,
      baseUrl,
      model: model || "gpt-4o-mini",
    });
    if (vision) return vision;
  }

  return offlineRead(doc, ocrText);
}

function resolveFromText(text: string, doc: SketchDoc): VisionRead | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const pattern = fuzzyDetectPatternWord(trimmed);
  if (!pattern) return null;
  const short = trimmed.length <= 12;
  const canned = docForPattern(pattern, short ? doc.intent : doc.intent || trimmed);
  return {
    text: trimmed,
    pattern,
    intent: canned.intent,
    doc: canned,
    source: "ocr",
  };
}

async function callVision(args: {
  imageDataUrl: string;
  doc: SketchDoc;
  apiKey: string;
  baseUrl?: string;
  model: string;
}): Promise<VisionRead | null> {
  try {
    const url = `${(args.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${args.apiKey}`,
      },
      body: JSON.stringify({
        model: args.model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: [
              "You read SketchCoder board screenshots and decide what system to scaffold.",
              "Return ONLY JSON:",
              '{ "text": string, "pattern": "rag"|"crud"|"agent"|"webhook"|"chat"|"api"|null, "intent": string, "useCanned": boolean, "nodes": [{ "id": string, "type": "client"|"api"|"service"|"store"|"model"|"queue"|"external", "label": string, "x": number, "y": number, "w": number, "h": number, "shape": "rect"|"rounded"|"diamond" }], "edges": [{ "id": string, "from": string, "to": string, "label"?: string }] }',
              "Decision rules:",
              "1. If a handwritten word like RAG/CRUD/AGENT/WEBHOOK/API/CHAT is clear, set pattern + useCanned true.",
              "2. If boxes+arrows form a diagram, set useCanned false and return those nodes with correct types from labels.",
              "3. Prefer intent field when ink is messy but intent names the system.",
              "4. Coordinates roughly 0-1200 x 0-700.",
            ].join("\n"),
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Existing intent: ${JSON.stringify(args.doc.intent)}\nExisting nodes: ${args.doc.nodes.length}\nLabels: ${args.doc.nodes.map((n) => n.label).join(", ") || "(none)"}\nRead the board. Prefer clear pattern words; otherwise reconstruct the diagram.`,
              },
              {
                type: "image_url",
                image_url: { url: args.imageDataUrl },
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(16000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const parsed = parseModelJson(json.choices?.[0]?.message?.content ?? "") as {
      text?: string;
      pattern?: string | null;
      intent?: string;
      useCanned?: boolean;
      nodes?: SketchDoc["nodes"];
      edges?: SketchDoc["edges"];
    } | null;
    if (!parsed) return null;

    const text = (parsed.text || "").trim();
    const pattern =
      (parsed.pattern as PatternWord | null) ||
      fuzzyDetectPatternWord(text) ||
      fuzzyDetectPatternWord(parsed.intent || "") ||
      fuzzyDetectPatternWord(args.doc.intent);

    if (pattern && (parsed.useCanned === true || !parsed.nodes?.length)) {
      const hint =
        (parsed.intent && parsed.intent.trim().length > 12
          ? parsed.intent
          : "") ||
        (args.doc.intent && args.doc.intent.trim().length > 12
          ? args.doc.intent
          : "");
      const canned = docForPattern(pattern, hint);
      return {
        text: text || pattern.toUpperCase(),
        pattern,
        intent: canned.intent,
        doc: canned,
        source: "vision",
      };
    }

    if (parsed.nodes?.length) {
      const nodes: SketchNode[] = parsed.nodes
        .filter(
          (n) =>
            n &&
            typeof n.id === "string" &&
            typeof n.label === "string" &&
            Number.isFinite(n.x) &&
            Number.isFinite(n.y) &&
            Number.isFinite(n.w) &&
            Number.isFinite(n.h)
        )
        .map((n) => {
          const shape: NodeShape =
            n.shape === "rounded" || n.shape === "diamond" ? n.shape : "rect";
          return {
            id: n.id,
            label: n.label,
            x: n.x,
            y: n.y,
            w: n.w,
            h: n.h,
            notes: n.notes,
            type: isNodeType(n.type) ? n.type : "service",
            shape,
          };
        });
      if (nodes.length) {
        const ids = new Set(nodes.map((n) => n.id));
        const edges = (parsed.edges || []).filter(
          (e) => e && ids.has(e.from) && ids.has(e.to)
        );
        const built = normalizeSketchDoc({
          version: 1,
          intent: parsed.intent || args.doc.intent || text,
          nodes,
          edges,
        });
        return {
          text: text || "diagram",
          pattern,
          intent: built.intent,
          doc: built,
          source: "vision",
        };
      }
    }

    if (pattern) {
      const hint =
        args.doc.intent && args.doc.intent.trim().length > 12
          ? args.doc.intent
          : parsed.intent && parsed.intent.trim().length > 12
            ? parsed.intent
            : "";
      const canned = docForPattern(pattern, hint);
      return {
        text: text || pattern.toUpperCase(),
        pattern,
        intent: canned.intent,
        doc: canned,
        source: "vision",
      };
    }

    return null;
  } catch {
    return null;
  }
}

function offlineRead(doc: SketchDoc, ocrText?: string): VisionRead {
  const fromOcr = resolveFromText(ocrText || "", doc);
  if (fromOcr) return fromOcr;

  const fromIntent = fuzzyDetectPatternWord(doc.intent) || detectPatternWord(doc.intent);
  if (fromIntent && doc.nodes.length < 3) {
    const canned = docForPattern(fromIntent, doc.intent);
    return {
      text: fromIntent.toUpperCase(),
      pattern: fromIntent,
      intent: canned.intent,
      doc: canned,
      source: "offline",
    };
  }

  if (doc.nodes.length) {
    const normalized = normalizeSketchDoc(doc);
    const labelBlob = normalized.nodes.map((n) => n.label).join(" ");
    return {
      text: labelBlob,
      pattern:
        fuzzyDetectPatternWord(normalized.intent) ||
        fuzzyDetectPatternWord(labelBlob),
      intent: normalized.intent,
      doc: normalized,
      source: "graph",
    };
  }

  if (fromIntent) {
    const canned = docForPattern(fromIntent, doc.intent);
    return {
      text: fromIntent.toUpperCase(),
      pattern: fromIntent,
      intent: canned.intent,
      doc: canned,
      source: "offline",
    };
  }

  return {
    text: "",
    pattern: null,
    intent: doc.intent,
    doc: null,
    source: "offline",
  };
}
