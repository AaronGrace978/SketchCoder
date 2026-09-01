import type { GenerateEvent } from "@sketchcoder/agent";
import { detectPatternWord } from "@sketchcoder/graph";
import { captureBoardPng, captureInkOcrPng } from "./screenshot";
import { loadSettings, settingsForApi } from "./settings";
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
  const intentHint = detectPatternWord(store.intent)?.toUpperCase() || "";
  const localHint = ocrText || intentHint;

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
        try {
          const event = JSON.parse(line.slice(5).trim()) as GenerateEvent;
          applyEvent(event);
        } catch {
          /* skip bad SSE chunk */
        }
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
    // Snapshot first so Ctrl+Z can restore the pre-generate sketch.
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

  // Prefer real OCR. Cluster guess is only a weak fallback.
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    await worker.setParameters({
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ",
    });
    const result = await worker.recognize(inkPng);
    await worker.terminate();
    const text = (result.data.text || "").trim();
    if (text && detectPatternWord(text)) return text;
    if (text.length >= 2) return text;
  } catch {
    /* fall through */
  }

  return guessWordFromStrokeClusters(strokes);
}

/** Weak fallback only when OCR fails — never short-circuit real reading. */
function guessWordFromStrokeClusters(
  strokes: { points: { x: number; y: number }[] }[]
): string {
  if (strokes.length < 2 || strokes.length > 10) return "";
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

  // Require letter-like tall clusters sitting in a horizontal word row.
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
