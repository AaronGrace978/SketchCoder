import {
  detectInkPattern,
  fuzzyDetectPatternWord,
  normalizeSketchDoc,
  type SketchDoc,
  topologicalOrder,
} from "@sketchcoder/graph";
import { scaffoldFromGraph, type ScaffoldResult } from "@sketchcoder/templates";
import { adaptPrompt } from "./prompt";
import { parseModelJson } from "./parse";
import { readSketchImage } from "./vision";

export type GenerateEvent =
  | { type: "capture" }
  | { type: "read"; text: string; pattern: string | null; source: string }
  | { type: "graph"; doc: SketchDoc }
  | { type: "plan"; summary: string; pattern: string; nextSteps: string[] }
  | { type: "pulse"; nodeId: string }
  | { type: "file"; path: string; content: string }
  | { type: "done"; summary: string; nextSteps: string[]; pattern: string };

export type GenerateOptions = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  imageDataUrl?: string;
  ocrText?: string;
};

export async function* generateScaffold(
  doc: SketchDoc,
  options: GenerateOptions = {}
): AsyncGenerator<GenerateEvent> {
  let working = normalizeSketchDoc(doc);

  if (options.imageDataUrl || options.ocrText) {
    yield { type: "capture" };

    let read = await withTimeout(
      readSketchImage({
        imageDataUrl: options.imageDataUrl || "",
        doc: working,
        apiKey: options.apiKey,
        baseUrl: options.baseUrl,
        model: options.model,
        ocrText: options.ocrText,
      }),
      18000,
      null
    );

    if ((!read?.doc || read.source === "graph") && options.ocrText) {
      const { docForPattern } = await import("@sketchcoder/graph");
      const pattern =
        detectInkPattern(options.ocrText) ||
        fuzzyDetectPatternWord(doc.intent);
      if (pattern) {
        const short = options.ocrText.trim().length <= 12;
        const canned = docForPattern(
          pattern,
          short ? doc.intent : doc.intent || options.ocrText
        );
        read = {
          text: options.ocrText,
          pattern,
          intent: canned.intent,
          doc: canned,
          source: "ocr",
        };
      }
    }

    if (read) {
      yield {
        type: "read",
        text: read.text,
        pattern: read.pattern,
        source: read.source,
      };
      if (read.doc) {
        const shouldReplace =
          read.source === "ocr" ||
          read.source === "vision" ||
          read.source === "offline" ||
          (read.source === "graph" && read.doc !== doc);
        working = normalizeSketchDoc({
          ...read.doc,
          intent: read.intent || read.doc.intent || doc.intent,
        });
        if (shouldReplace && graphsDiffer(doc, working)) {
          yield { type: "graph", doc: working };
        }
      }
    }
  }

  // Empty board but intent/OCR names a pattern → expand.
  if (!working.nodes.length) {
    const { docForPattern } = await import("@sketchcoder/graph");
    const pattern =
      detectInkPattern(options.ocrText || "") ||
      fuzzyDetectPatternWord(working.intent);
    if (pattern) {
      working = normalizeSketchDoc(docForPattern(pattern, working.intent));
      yield {
        type: "read",
        text: pattern.toUpperCase(),
        pattern,
        source: "offline",
      };
      yield { type: "graph", doc: working };
    }
  }

  // Intent says RAG/CRUD/… but board is sparse scribble → expand canned graph.
  if (working.nodes.length > 0 && working.nodes.length < 3) {
    const { docForPattern } = await import("@sketchcoder/graph");
    const pattern =
      detectInkPattern(options.ocrText || "") ||
      fuzzyDetectPatternWord(working.intent);
    if (pattern) {
      working = normalizeSketchDoc(docForPattern(pattern, working.intent));
      yield {
        type: "read",
        text: pattern.toUpperCase(),
        pattern,
        source: "offline",
      };
      yield { type: "graph", doc: working };
    }
  }

  // Marks on the board we could not read: hand back a runnable starter rather
  // than a dead end, and say plainly what was assumed.
  let guessed = false;
  if (!working.nodes.length && (options.imageDataUrl || options.ocrText)) {
    const { starterDoc } = await import("@sketchcoder/graph");
    working = normalizeSketchDoc(starterDoc(doc.intent));
    guessed = true;
    yield {
      type: "read",
      text: options.ocrText?.trim() || "unreadable ink",
      pattern: null,
      source: "offline",
    };
    yield { type: "graph", doc: working };
  }

  if (!working.nodes.length) {
    yield {
      type: "done",
      summary:
        "Nothing on the board yet. Write RAG with the pen, load the RAG demo, or sketch Client → API → Store.",
      nextSteps: [
        "Write RAG, CRUD, AGENT, or WEBHOOK with the pen.",
        "Or click Load RAG demo and hit Generate.",
        "Add a model key in Settings for handwriting vision.",
      ],
      pattern: "generic",
    };
    return;
  }

  working = normalizeSketchDoc(working);
  const base = guessed
    ? withGuessNotice(scaffoldFromGraph(working))
    : scaffoldFromGraph(working);
  const adapted = options.apiKey
    ? await maybeAdapt(working, base, options)
    : base;
  const order = topologicalOrder(working);

  yield {
    type: "plan",
    summary: adapted.summary,
    pattern: adapted.pattern,
    nextSteps: adapted.nextSteps,
  };

  const remaining = new Set(adapted.files.map((f) => f.path));
  for (const nodeId of order) {
    yield { type: "pulse", nodeId };
    const paths = adapted.nodeFiles[nodeId] ?? [];
    for (const path of paths) {
      const file = adapted.files.find((f) => f.path === path);
      if (file && remaining.has(path)) {
        remaining.delete(path);
        yield { type: "file", path: file.path, content: file.content };
      }
    }
  }

  for (const file of adapted.files) {
    if (remaining.has(file.path)) {
      remaining.delete(file.path);
      yield { type: "file", path: file.path, content: file.content };
    }
  }

  yield {
    type: "done",
    summary: adapted.summary,
    nextSteps: adapted.nextSteps,
    pattern: adapted.pattern,
  };
}

function withGuessNotice(base: ScaffoldResult): ScaffoldResult {
  return {
    ...base,
    summary: `Could not read the handwriting, so this is a starter system. ${base.summary}`,
    nextSteps: [
      "Write the word bigger (RAG, CRUD, AGENT, WEBHOOK) and Generate again.",
      "Or type what you want in the Intent box.",
      ...base.nextSteps,
    ],
  };
}

function graphsDiffer(a: SketchDoc, b: SketchDoc): boolean {
  if (a.nodes.length !== b.nodes.length || a.edges.length !== b.edges.length) {
    return true;
  }
  const aIds = a.nodes.map((n) => n.id).sort().join(",");
  const bIds = b.nodes.map((n) => n.id).sort().join(",");
  return aIds !== bIds || a.intent !== b.intent;
}

async function maybeAdapt(
  doc: SketchDoc,
  base: ScaffoldResult,
  options: GenerateOptions
): Promise<ScaffoldResult> {
  try {
    const url = `${(options.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You output JSON only. Keep every original file path. Only refine content to match the sketched labels and intent; do not drop core files.",
          },
          { role: "user", content: adaptPrompt(doc, base) },
        ],
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return base;
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const parsed = parseModelJson(json.choices?.[0]?.message?.content ?? "");
    if (!parsed?.files?.length) return base;

    const byPath = new Map(base.files.map((f) => [f.path, f.content]));
    for (const f of parsed.files) {
      if (byPath.has(f.path) && typeof f.content === "string" && f.content.length > 20) {
        byPath.set(f.path, f.content);
      }
    }
    return {
      ...base,
      summary: parsed.summary || base.summary,
      nextSteps: parsed.nextSteps?.length ? parsed.nextSteps : base.nextSteps,
      files: [...byPath.entries()].map(([path, content]) => ({ path, content })),
    };
  } catch {
    return base;
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T
): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch(() => {
        clearTimeout(t);
        resolve(fallback);
      });
  });
}
