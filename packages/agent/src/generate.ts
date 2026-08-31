import { topologicalOrder, type SketchDoc } from "@sketchcoder/graph";
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
  let working = doc;

  if (options.imageDataUrl || options.ocrText) {
    yield { type: "capture" };

    let read = options.imageDataUrl
      ? await readSketchImage({
          imageDataUrl: options.imageDataUrl,
          doc,
          apiKey: options.apiKey,
          baseUrl: options.baseUrl,
          model: options.model,
        })
      : null;

    if ((!read || !read.doc) && options.ocrText) {
      const { detectPatternWord, docForPattern } = await import("@sketchcoder/graph");
      const pattern = detectPatternWord(options.ocrText) || detectPatternWord(doc.intent);
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
          source: "offline",
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
        working = {
          ...read.doc,
          intent: read.intent || read.doc.intent || doc.intent,
        };
        yield { type: "graph", doc: working };
      }
    }
  }

  if (!working.nodes.length) {
    yield {
      type: "done",
      summary:
        "Could not read a system from the board. Spell a word like RAG, or sketch boxes, then Generate again.",
      nextSteps: [
        "Use the pen and write RAG across the board.",
        "Or load the RAG demo and hit Generate.",
        "Add OPENAI_API_KEY for vision reading of handwriting.",
      ],
      pattern: "generic",
    };
    return;
  }

  const base = scaffoldFromGraph(working);
  const adapted = options.apiKey ? await maybeAdapt(working, base, options) : base;
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
          { role: "system", content: "You output JSON only." },
          { role: "user", content: adaptPrompt(doc, base) },
        ],
      }),
    });
    if (!res.ok) return base;
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const parsed = parseModelJson(json.choices?.[0]?.message?.content ?? "");
    if (!parsed?.files?.length) return base;
    return {
      ...base,
      summary: parsed.summary || base.summary,
      nextSteps: parsed.nextSteps?.length ? parsed.nextSteps : base.nextSteps,
      files: parsed.files,
    };
  } catch {
    return base;
  }
}
