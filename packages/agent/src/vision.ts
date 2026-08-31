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
  source: "vision" | "offline" | "graph";
};

export async function readSketchImage(options: {
  imageDataUrl: string;
  doc: SketchDoc;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}): Promise<VisionRead> {
  const { imageDataUrl, doc, apiKey, baseUrl, model } = options;

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

  return offlineRead(doc);
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
              "You read SketchCoder board screenshots. Users often handwrite a short word like RAG, CRUD, AGENT, WEBHOOK, API, or CHAT. They may also draw architecture boxes and arrows. Return ONLY JSON: { \"text\": string, \"pattern\": \"rag\"|\"crud\"|\"agent\"|\"webhook\"|\"chat\"|\"api\"|null, \"intent\": string, \"useCanned\": boolean, \"nodes\": [{ \"id\": string, \"type\": \"client\"|\"api\"|\"service\"|\"store\"|\"model\"|\"queue\"|\"external\", \"label\": string, \"x\": number, \"y\": number, \"w\": number, \"h\": number, \"shape\": \"rect\"|\"rounded\"|\"diamond\" }], \"edges\": [{ \"id\": string, \"from\": string, \"to\": string, \"label\"?: string }] }. If they wrote a known pattern word, set useCanned true and pattern accordingly; nodes/edges can be empty. Coordinates are roughly 0-1100 x 0-500.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Existing intent field: ${JSON.stringify(args.doc.intent)}\nExisting node count: ${args.doc.nodes.length}\nRead the board image. Prefer handwritten words.`,
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

    if (pattern && (parsed.useCanned !== false || !parsed.nodes?.length)) {
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
      return {
        text: text || "diagram",
        pattern,
        intent: parsed.intent || args.doc.intent || text,
        doc: {
          version: 1,
          intent: parsed.intent || args.doc.intent || text,
          nodes: parsed.nodes,
          edges: parsed.edges || [],
        },
        source: "vision",
      };
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

function offlineRead(doc: SketchDoc): VisionRead {
  const fromIntent = detectPatternWord(doc.intent);
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

  if (doc.nodes.length) {
    return {
      text: doc.nodes.map((n) => n.label).join(" "),
      pattern: detectPatternWord(doc.intent) || detectPatternWord(doc.nodes.map((n) => n.label).join(" ")),
      intent: doc.intent,
      doc,
      source: "graph",
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
