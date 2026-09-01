import type { GenerateEvent } from "@sketchcoder/agent";
import { fuzzyDetectPatternWord } from "@sketchcoder/graph";
import { captureBoardPng, captureInkOcrPng } from "./screenshot";
import { loadSettings, settingsForApi } from "./settings";
import { useSketch } from "./store";

let activeAbort: AbortController | null = null;

export function cancelGenerate() {
  activeAbort?.abort();
  activeAbort = null;
  useSketch.getState().patchGeneration({
    status: "idle",
    phase: "idle",
    pulsingNodeId: null,
    error: null,
    summary: "Generate cancelled.",
  });
}

export async function runGenerate() {
  const store = useSketch.getState();
  const hasMarks =
    store.nodes.length > 0 || store.strokes.length > 0 || store.intent.trim().length > 0;

  if (!hasMarks) {
    store.patchGeneration({
      status: "error",
      phase: "idle",
      error: "Write a word like RAG, or sketch boxes, then Generate.",
    });
    return;
  }

  // Cancel any stuck previous run.
  activeAbort?.abort();
  const abort = new AbortController();
  activeAbort = abort;

  store.patchGeneration({
    status: "running",
    phase: "capturing",
    files: [],
    summary: "",
    nextSteps: [],
    pattern: "",
    error: null,
    pulsingNodeId: null,
    activeFile: null,
    readText: "",
  });

  await wait(40);
  if (abort.signal.aborted) return;

  let imageDataUrl = "";
  try {
    imageDataUrl = captureBoardPng({
      nodes: store.nodes,
      edges: store.edges,
      strokes: store.strokes,
      viewport: store.viewport,
      width: store.boardSize.w,
      height: store.boardSize.h,
    });
  } catch {
    imageDataUrl = "";
  }

  store.patchGeneration({ phase: "reading" });

  // Intent alone is often enough — don't let OCR hang the whole Generate.
  const intentPattern = fuzzyDetectPatternWord(store.intent);
  const skipOcr =
    Boolean(intentPattern) &&
    (store.nodes.length >= 3 || store.strokes.length === 0);

  const ocrText = skipOcr
    ? ""
    : await withTimeout(readInkText(store.strokes), 7000, "").catch(() => "");

  if (abort.signal.aborted) return;

  const ocrPattern = fuzzyDetectPatternWord(ocrText);
  const localHint =
    (ocrPattern && ocrText.trim()) ||
    (intentPattern ? intentPattern.toUpperCase() : "") ||
    ocrText.trim() ||
    "";

  try {
    const modelSettings = settingsForApi(loadSettings());
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        doc: store.exportDoc(),
        imageDataUrl,
        ocrText: localHint,
        ...modelSettings,
      }),
      signal: abort.signal,
    });
    if (!res.ok || !res.body) throw new Error("Generate failed");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      if (abort.signal.aborted) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        return;
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";
      for (const chunk of chunks) {
        const line = chunk.trim();
        if (!line.startsWith("data:")) continue;
        try {
          const event = JSON.parse(line.slice(5).trim()) as GenerateEvent;
          applyEvent(event);
        } catch {
          /* skip bad SSE chunk */
        }
      }
    }
  } catch (err) {
    if (abort.signal.aborted) return;
    useSketch.getState().patchGeneration({
      status: "error",
      phase: "idle",
      error: err instanceof Error ? err.message : "Generate failed",
    });
  } finally {
    if (activeAbort === abort) activeAbort = null;
  }
}

function applyEvent(event: GenerateEvent) {
  const s = useSketch.getState();
  if (event.type === "capture") {
    // Stay on reading in the UI — "capturing" already finished client-side.
    s.patchGeneration({ phase: "reading" });
  }
  if (event.type === "read") {
    s.patchGeneration({
      phase: "reading",
      readText: event.text,
      pattern: event.pattern || "",
      summary: event.text
        ? `Read “${event.text}” from the board.`
        : "Reading the board…",
    });
  }
  if (event.type === "graph") {
    s.applyGeneratedGraph(event.doc);
  }
  if (event.type === "plan") {
    s.patchGeneration({
      phase: "writing",
      summary: event.summary,
      pattern: event.pattern,
      nextSteps: event.nextSteps,
    });
  }
  if (event.type === "pulse") {
    s.patchGeneration({ pulsingNodeId: event.nodeId });
  }
  if (event.type === "file") {
    s.upsertFile({ path: event.path, content: event.content });
  }
  if (event.type === "done") {
    const failed = event.summary.toLowerCase().includes("could not read");
    s.patchGeneration({
      status: failed ? "error" : "done",
      phase: "idle",
      summary: event.summary,
      nextSteps: event.nextSteps,
      pattern: event.pattern,
      pulsingNodeId: null,
      error: failed ? event.summary : null,
    });
  }
}

async function readInkText(
  strokes: { id: string; points: { x: number; y: number }[]; fading: boolean }[]
): Promise<string> {
  if (!strokes.length) return "";
  const inkPng = captureInkOcrPng(strokes);
  if (!inkPng) return "";

  const guess = guessWordFromStrokeClusters(strokes);

  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    try {
      await worker.setParameters({
        tessedit_char_whitelist:
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ",
      });
      const result = await worker.recognize(inkPng);
      const text = (result.data.text || "").trim();
      if (text && fuzzyDetectPatternWord(text)) return text;
      if (text.length >= 2 && text.length <= 24) return text;
    } finally {
      await worker.terminate().catch(() => undefined);
    }
  } catch {
    /* fall through */
  }

  return guess;
}

/** Weak fallback only when OCR fails — never short-circuit real reading. */
function guessWordFromStrokeClusters(
  strokes: { points: { x: number; y: number }[] }[]
): string {
  if (strokes.length < 2 || strokes.length > 12) return "";
  const boxes = strokes.map((s) => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of s.points) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    return { minX, maxX, minY, maxY, cx: (minX + maxX) / 2, w: maxX - minX, h: maxY - minY };
  });
  boxes.sort((a, b) => a.cx - b.cx);

  const letters: typeof boxes = [];
  for (const b of boxes) {
    const prev = letters[letters.length - 1];
    if (prev && b.minX < prev.maxX - 8) {
      prev.maxX = Math.max(prev.maxX, b.maxX);
      prev.minX = Math.min(prev.minX, b.minX);
      prev.minY = Math.min(prev.minY, b.minY);
      prev.maxY = Math.max(prev.maxY, b.maxY);
      prev.cx = (prev.minX + prev.maxX) / 2;
      prev.w = prev.maxX - prev.minX;
      prev.h = prev.maxY - prev.minY;
    } else {
      letters.push({ ...b });
    }
  }

  if (letters.length < 3 || letters.length > 7) return "";
  const avgH = letters.reduce((a, l) => a + l.h, 0) / letters.length;
  const avgW = letters.reduce((a, l) => a + l.w, 0) / letters.length;
  const wordLike =
    letters.every((l) => l.h > avgH * 0.4 && l.h > l.w * 0.55) &&
    avgH > 28 &&
    avgW < avgH * 1.6;
  if (!wordLike) return "";

  if (letters.length === 3) return "RAG";
  if (letters.length === 4) return "CRUD";
  if (letters.length === 5) return "AGENT";
  if (letters.length === 7) return "WEBHOOK";
  return "";
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
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
