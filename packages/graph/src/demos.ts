import type { SketchDoc } from "./types";

export const RAG_DEMO_ID = "rag-with-citations";

export function ragDemoDoc(): SketchDoc {
  return {
    version: 1,
    intent:
      "Production RAG with citations. Chunk docs, embed, retrieve top-k with sources, ground the LLM, stream answers through an API to a chat UI.",
    nodes: [
      {
        id: "n_docs",
        type: "external",
        label: "Document corpus",
        x: 80,
        y: 120,
        w: 188,
        h: 76,
        shape: "rect",
      },
      {
        id: "n_embed",
        type: "service",
        label: "Embedder",
        x: 340,
        y: 120,
        w: 188,
        h: 76,
        shape: "rounded",
      },
      {
        id: "n_store",
        type: "store",
        label: "Vector store",
        x: 600,
        y: 120,
        w: 188,
        h: 76,
        shape: "rect",
      },
      {
        id: "n_ui",
        type: "client",
        label: "Chat UI",
        x: 80,
        y: 320,
        w: 188,
        h: 76,
        shape: "rounded",
      },
      {
        id: "n_api",
        type: "api",
        label: "Ask API",
        x: 340,
        y: 320,
        w: 188,
        h: 76,
        shape: "rect",
      },
      {
        id: "n_retriever",
        type: "service",
        label: "Retriever",
        x: 600,
        y: 320,
        w: 188,
        h: 76,
        shape: "rounded",
      },
      {
        id: "n_llm",
        type: "model",
        label: "Grounded LLM",
        x: 860,
        y: 220,
        w: 188,
        h: 76,
        shape: "rect",
      },
    ],
    edges: [
      { id: "e1", from: "n_docs", to: "n_embed", label: "chunk" },
      { id: "e2", from: "n_embed", to: "n_store", label: "index" },
      { id: "e3", from: "n_ui", to: "n_api", label: "query" },
      { id: "e4", from: "n_api", to: "n_retriever", label: "retrieve" },
      { id: "e5", from: "n_store", to: "n_retriever" },
      { id: "e6", from: "n_retriever", to: "n_llm", label: "context" },
      { id: "e7", from: "n_llm", to: "n_api", label: "stream" },
    ],
  };
}
