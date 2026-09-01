import type { SketchDoc } from "@sketchcoder/graph";
import {
  detectPatternWord,
  docForPattern,
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

  // OCR / typed word wins over "nodes already exist" so spelling RAG still builds.
  const fromOcr = resolveFromText(ocrText || "", doc);
  if (fromOcr) return fromOcr;

  if (apiKey) {
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
  const pattern = detectPatternWord(trimmed);
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
            content:
              "You read SketchCoder board screenshots. Users often handwrite a short word like RAG, CRUD, AGENT, WEBHOOK, API, or CHAT. They may also draw architecture boxes and arrows. Return ONLY JSON: { \"text\": string, \"pattern\": \"rag\"|\"crud\"|\"agent\"|\"webhook\"|\"chat\"|\"api\"|null, \"intent\": string, \"useCanned\": boolean, \"nodes\": [{ \"id\": string, \"type\": \"client\"|\"api\"|\"service\"|\"store\"|\"model\"|\"queue\"|\"external\", \"label\": string, \"x\": number, \"y\": number, \"w\": number, \"h\": number, \"shape\": \"rect\"|\"rounded\"|\"diamond\" }], \"edges\": [{ \"id\": string, \"from\": string, \"to\": string, \"label\"?: string }] }. Set useCanned true ONLY when they clearly wrote a known pattern word (not when they drew a custom diagram). Prefer the drawn diagram nodes when boxes and arrows are present and no clear pattern word is written. Coordinates roughly 0-1200 x 0-700.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Existing intent field: ${JSON.stringify(args.doc.intent)}\nExisting node count: ${args.doc.nodes.length}\nRead the board image. Prefer handwritten words when present.`,
              },
              {
                type: "image_url",
                image_url: { url: args.imageDataUrl },
              },
            ],
          },
        ],
      }),
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
      detectPatternWord(text) ||
      detectPatternWord(parsed.intent || "") ||
      detectPatternWord(args.doc.intent);

    // Only expand to canned when vision explicitly asked for it, or there is a
    // pattern word and no usable diagram nodes.
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
      const nodes = parsed.nodes.filter(
        (n) =>
          n &&
          typeof n.id === "string" &&
          typeof n.label === "string" &&
          Number.isFinite(n.x) &&
          Number.isFinite(n.y) &&
          Number.isFinite(n.w) &&
          Number.isFinite(n.h)
      );
      if (nodes.length) {
        const ids = new Set(nodes.map((n) => n.id));
        const edges = (parsed.edges || []).filter(
          (e) => e && ids.has(e.from) && ids.has(e.to)
        );
        return {
          text: text || "diagram",
          pattern,
          intent: parsed.intent || args.doc.intent || text,
          doc: {
            version: 1,
            intent: parsed.intent || args.doc.intent || text,
            nodes,
            edges,
          },
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

  const fromIntent = detectPatternWord(doc.intent);
  if (fromIntent && doc.nodes.length < 2) {
    const canned = docForPattern(fromIntent, doc.intent);
    return {
      text: fromIntent.toUpperCase(),
      pattern: fromIntent,
      intent: canned.intent,
      doc: canned,
      source: "offline",
    };
  }

  // Keep the user's drawn graph when they sketched boxes.
  if (doc.nodes.length) {
    const labelBlob = doc.nodes.map((n) => n.label).join(" ");
    return {
      text: labelBlob,
      pattern:
        detectPatternWord(doc.intent) ||
        detectPatternWord(labelBlob),
      intent: doc.intent,
      doc,
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
