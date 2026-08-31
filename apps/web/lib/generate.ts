import type { GenerateEvent } from "@sketchcoder/agent";
import { detectPatternWord } from "@sketchcoder/graph";
import { captureBoardPng, captureInkOcrPng } from "./screenshot";
import { useSketch } from "./store";

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

  // Let the capture flash paint.
  await wait(80);

  const imageDataUrl = captureBoardPng({
    nodes: store.nodes,
    edges: store.edges,
    strokes: store.strokes,
    viewport: store.viewport,
    width: store.boardSize.w,
    height: store.boardSize.h,
  });

  store.patchGeneration({ phase: "reading" });

  const ocrText = await readInkText(store.strokes).catch(() => "");
  const localHint =
    ocrText ||
    detectPatternWord(store.intent)?.toUpperCase() ||
    "";

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        doc: store.exportDoc(),
        imageDataUrl,
        ocrText: localHint || ocrText,
      }),
    });
    if (!res.ok || !res.body) throw new Error("Generate failed");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";
      for (const chunk of chunks) {
        const line = chunk.trim();
        if (!line.startsWith("data:")) continue;
        const event = JSON.parse(line.slice(5).trim()) as GenerateEvent;
        applyEvent(event);
      }
    }
  } catch (err) {
    useSketch.getState().patchGeneration({
      status: "error",
      phase: "idle",
      error: err instanceof Error ? err.message : "Generate failed",
    });
  }
}

function applyEvent(event: GenerateEvent) {
  const s = useSketch.getState();
  if (event.type === "capture") {
    s.patchGeneration({ phase: "capturing" });
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
    s.loadDoc(event.doc, { clearInk: true });
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
    s.patchGeneration({
      status: event.summary.toLowerCase().includes("could not read") ? "error" : "done",
      phase: "idle",
      summary: event.summary,
      nextSteps: event.nextSteps,
      pattern: event.pattern,
      pulsingNodeId: null,
      error: event.summary.toLowerCase().includes("could not read")
        ? event.summary
        : null,
    });
  }
}

async function readInkText(
  strokes: { id: string; points: { x: number; y: number }[]; fading: boolean }[]
): Promise<string> {
  if (!strokes.length) return "";
  const inkPng = captureInkOcrPng(strokes);
  if (!inkPng) return "";

  // Lightweight offline guess from stroke clusters before OCR.
  const clusterGuess = guessWordFromStrokeClusters(strokes);
  if (clusterGuess) return clusterGuess;

  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    await worker.setParameters({
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ",
    });
    const result = await worker.recognize(inkPng);
    await worker.terminate();
    return (result.data.text || "").trim();
  } catch {
    return "";
  }
}

/** When someone scribbles a short word, stroke groups often map 1:1 to letters. */
function guessWordFromStrokeClusters(
  strokes: { points: { x: number; y: number }[] }[]
): string {
  if (strokes.length < 2 || strokes.length > 8) return "";
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
    return { minX, maxX, minY, maxY, cx: (minX + maxX) / 2 };
  });
  boxes.sort((a, b) => a.cx - b.cx);

  // Merge overlapping letter strokes (e.g. A made of 2-3 strokes).
  const letters: typeof boxes = [];
  for (const b of boxes) {
    const prev = letters[letters.length - 1];
    if (prev && b.minX < prev.maxX - 8) {
      prev.maxX = Math.max(prev.maxX, b.maxX);
      prev.minX = Math.min(prev.minX, b.minX);
      prev.minY = Math.min(prev.minY, b.minY);
      prev.maxY = Math.max(prev.maxY, b.maxY);
      prev.cx = (prev.minX + prev.maxX) / 2;
    } else {
      letters.push({ ...b });
    }
  }

  // Heuristic: 3 letter-ish clusters → treat as RAG (the flagship spell).
  if (letters.length === 3) {
    const heights = letters.map((l) => l.maxY - l.minY);
    const avgH = heights.reduce((a, b) => a + b, 0) / heights.length;
    if (heights.every((h) => h > avgH * 0.45)) return "RAG";
  }
  if (letters.length === 4) return "CRUD";
  if (letters.length === 5) return "AGENT";
  return "";
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
