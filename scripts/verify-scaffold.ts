/**
 * Offline smoke checks for draw → scaffold.
 * Run: npx tsx scripts/verify-scaffold.ts
 */
import { generateScaffold } from "../packages/agent/src/generate";
import {
  emptyDoc,
  ragDemoDoc,
  detectPatternWord,
  fuzzyDetectPatternWord,
} from "../packages/graph/src";
import { crudDemoDoc } from "../packages/graph/src/patterns";
import { scaffoldFromGraph } from "../packages/templates/src";

async function collect(
  gen: AsyncGenerator<{ type: string; [k: string]: unknown }>
) {
  const events: { type: string; [k: string]: unknown }[] = [];
  for await (const e of gen) events.push(e);
  return events;
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  assert(detectPatternWord("RAG") === "rag", "detect RAG");
  assert(detectPatternWord("R A G") === "rag", "detect spaced RAG");
  assert(detectPatternWord("crud") === "crud", "detect crud");
  assert(
    detectPatternWord("orchestration rest") !== "crud",
    "no false rest→crud via includes"
  );
  assert(detectPatternWord("restaurant") !== "rag", "no false restaurant");
  assert(fuzzyDetectPatternWord("RAQ") === "rag", "fuzzy RAQ→rag");
  assert(fuzzyDetectPatternWord("CRUO") === "crud", "fuzzy CRUO→crud");
  assert(
    fuzzyDetectPatternWord("Production RAG with citations") === "rag",
    "intent RAG"
  );

  const rag = scaffoldFromGraph(ragDemoDoc());
  assert(rag.pattern === "rag", "rag pattern");
  assert(rag.files.some((f) => f.path === "src/lib/store.ts"), "rag store file");
  assert(
    rag.files
      .find((f) => f.path === "src/lib/store.ts")
      ?.content.includes("index.json"),
    "rag store is file-backed"
  );

  const crud = scaffoldFromGraph(crudDemoDoc());
  assert(crud.pattern === "crud", "crud pattern from demo");

  const mistyped = scaffoldFromGraph({
    version: 1,
    intent: "",
    nodes: [
      {
        id: "a",
        type: "service",
        label: "Client",
        x: 0,
        y: 0,
        w: 120,
        h: 60,
        shape: "rounded",
      },
      {
        id: "b",
        type: "service",
        label: "REST API",
        x: 200,
        y: 0,
        w: 120,
        h: 60,
        shape: "rect",
      },
      {
        id: "c",
        type: "service",
        label: "Database",
        x: 400,
        y: 0,
        w: 120,
        h: 60,
        shape: "rect",
      },
    ],
    edges: [
      { id: "e1", from: "a", to: "b" },
      { id: "e2", from: "b", to: "c" },
    ],
  });
  assert(
    mistyped.pattern === "crud",
    `label inference → crud (got ${mistyped.pattern})`
  );

  const empty = emptyDoc();
  const fromWord = await collect(generateScaffold(empty, { ocrText: "RAG" }));
  assert(fromWord.some((e) => e.type === "graph"), "OCR RAG yields graph");
  assert(fromWord.some((e) => e.type === "file"), "OCR RAG yields files");
  assert(
    fromWord.filter((e) => e.type === "file").length >= 8,
    "OCR RAG yields enough files"
  );

  const intentOnly = await collect(
    generateScaffold(emptyDoc("Production RAG with citations"), {})
  );
  assert(intentOnly.some((e) => e.type === "file"), "intent-only RAG scaffolds");

  const drawn = await collect(generateScaffold(ragDemoDoc(), {}));
  assert(drawn.some((e) => e.type === "file"), "drawn rag demo scaffolds");
  assert(drawn.some((e) => e.type === "done"), "drawn rag completes");

  const boxesPlusWord = await collect(
    generateScaffold(
      {
        version: 1,
        intent: "",
        nodes: [
          {
            id: "n1",
            type: "service",
            label: "Untitled",
            x: 10,
            y: 10,
            w: 100,
            h: 60,
            shape: "rounded",
          },
        ],
        edges: [],
      },
      { ocrText: "RAG", imageDataUrl: "data:image/png;base64,aa" }
    )
  );
  const read = boxesPlusWord.find((e) => e.type === "read");
  assert(
    read && (read as { pattern?: string }).pattern === "rag",
    "OCR beats stray boxes"
  );
  assert(boxesPlusWord.some((e) => e.type === "graph"), "OCR replaces sparse boxes");

  console.log("verify-scaffold: all checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
