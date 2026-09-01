import { create } from "zustand";
import {
  DEFAULT_NODE_SIZE,
  emptyDoc,
  parseDoc,
  serializeDoc,
  uid,
  type NodeShape,
  type NodeType,
  type SketchDoc,
  type SketchEdge,
  type SketchNode,
} from "@sketchcoder/graph";

export type Tool =
  | "select"
  | "pen"
  | "rect"
  | "rounded"
  | "diamond"
  | "arrow"
  | "label";

export type Viewport = { x: number; y: number; zoom: number };

export type InkStroke = {
  id: string;
  points: { x: number; y: number }[];
  fading: boolean;
};

export type ScaffoldFile = { path: string; content: string };

export type Generation = {
  status: "idle" | "running" | "done" | "error";
  phase: "idle" | "capturing" | "reading" | "writing";
  pattern: string;
  summary: string;
  nextSteps: string[];
  files: ScaffoldFile[];
  activeFile: string | null;
  pulsingNodeId: string | null;
  error: string | null;
  readText: string;
};

type Snapshot = {
  nodes: SketchNode[];
  edges: SketchEdge[];
  intent: string;
  strokes: InkStroke[];
};

type Store = {
  nodes: SketchNode[];
  edges: SketchEdge[];
  intent: string;
  tool: Tool;
  pendingType: NodeType;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  editingNodeId: string | null;
  viewport: Viewport;
  spaceDown: boolean;
  ink: InkStroke | null;
  strokes: InkStroke[];
  fadingInk: InkStroke[];
  boardSize: { w: number; h: number };
  generation: Generation;
  history: Snapshot[];
  future: Snapshot[];
  setTool: (tool: Tool) => void;
  setPendingType: (type: NodeType) => void;
  setIntent: (intent: string) => void;
  setViewport: (viewport: Viewport) => void;
  setSpaceDown: (down: boolean) => void;
  setBoardSize: (size: { w: number; h: number }) => void;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  setEditing: (id: string | null) => void;
  addNode: (partial: Partial<SketchNode> & { x: number; y: number }) => string;
  updateNode: (id: string, patch: Partial<SketchNode>) => void;
  moveNode: (id: string, x: number, y: number) => void;
  addEdge: (from: string, to: string, label?: string) => void;
  updateEdge: (id: string, patch: Partial<SketchEdge>) => void;
  removeSelected: () => void;
  loadDoc: (doc: SketchDoc, opts?: { clearInk?: boolean }) => void;
  applyGeneratedGraph: (doc: SketchDoc) => void;
  exportDoc: () => SketchDoc;
  setInk: (ink: InkStroke | null) => void;
  commitStroke: (stroke: InkStroke) => void;
  clearStrokes: () => void;
  commitInkFade: (stroke: InkStroke) => void;
  clearFadedInk: (id: string) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  resetGeneration: () => void;
  patchGeneration: (patch: Partial<Generation>) => void;
  upsertFile: (file: ScaffoldFile) => void;
  persist: () => void;
  hydrate: () => void;
};

const STORAGE_KEY = "sketchcoder.doc.v1";

const idleGeneration = (): Generation => ({
  status: "idle",
  phase: "idle",
  pattern: "",
  summary: "",
  nextSteps: [],
  files: [],
  activeFile: null,
  pulsingNodeId: null,
  error: null,
  readText: "",
});

function snapshotOf(
  s: Pick<Store, "nodes" | "edges" | "intent" | "strokes">
): Snapshot {
  return {
    nodes: structuredClone(s.nodes),
    edges: structuredClone(s.edges),
    intent: s.intent,
    strokes: structuredClone(s.strokes),
  };
}

export const useSketch = create<Store>((set, get) => ({
  nodes: [],
  edges: [],
  intent: "",
  tool: "pen",
  pendingType: "service",
  selectedNodeId: null,
  selectedEdgeId: null,
  editingNodeId: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  spaceDown: false,
  ink: null,
  strokes: [],
  fadingInk: [],
  boardSize: { w: 1200, h: 800 },
  generation: idleGeneration(),
  history: [],
  future: [],
  setTool: (tool) => set({ tool }),
  setPendingType: (pendingType) => set({ pendingType }),
  setIntent: (intent) => {
    set({ intent });
    get().persist();
  },
  setViewport: (viewport) => set({ viewport }),
  setSpaceDown: (spaceDown) => set({ spaceDown }),
  setBoardSize: (boardSize) => set({ boardSize }),
  selectNode: (id) =>
    set({ selectedNodeId: id, selectedEdgeId: id ? null : get().selectedEdgeId }),
  selectEdge: (id) =>
    set({ selectedEdgeId: id, selectedNodeId: id ? null : get().selectedNodeId }),
  setEditing: (editingNodeId) => set({ editingNodeId }),
  addNode: (partial) => {
    get().pushHistory();
    const id = partial.id ?? uid("n");
    const node: SketchNode = {
      id,
      type: partial.type ?? get().pendingType,
      label: partial.label ?? "Untitled",
      x: partial.x,
      y: partial.y,
      w: partial.w ?? DEFAULT_NODE_SIZE.w,
      h: partial.h ?? DEFAULT_NODE_SIZE.h,
      shape: partial.shape ?? "rounded",
      notes: partial.notes,
    };
    set((s) => ({
      nodes: [...s.nodes, node],
      selectedNodeId: id,
      selectedEdgeId: null,
    }));
    get().persist();
    return id;
  },
  updateNode: (id, patch) => {
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    }));
    get().persist();
  },
  moveNode: (id, x, y) => {
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
    }));
  },
  addEdge: (from, to, label) => {
    if (from === to) return;
    const exists = get().edges.some(
      (e) => (e.from === from && e.to === to) || (e.from === to && e.to === from)
    );
    if (exists) return;
    get().pushHistory();
    const edge: SketchEdge = { id: uid("e"), from, to, label };
    set((s) => ({ edges: [...s.edges, edge], selectedEdgeId: edge.id }));
    get().persist();
  },
  updateEdge: (id, patch) => {
    set((s) => ({
      edges: s.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
    get().persist();
  },
  removeSelected: () => {
    const { selectedNodeId, selectedEdgeId } = get();
    if (!selectedNodeId && !selectedEdgeId) {
      if (get().strokes.length) {
        get().pushHistory();
        set({ strokes: [] });
        get().persist();
      }
      return;
    }
    get().pushHistory();
    set((s) => ({
      nodes: selectedNodeId ? s.nodes.filter((n) => n.id !== selectedNodeId) : s.nodes,
      edges: s.edges.filter((e) => {
        if (selectedEdgeId && e.id === selectedEdgeId) return false;
        if (selectedNodeId && (e.from === selectedNodeId || e.to === selectedNodeId))
          return false;
        return true;
      }),
      selectedNodeId: null,
      selectedEdgeId: null,
      editingNodeId: null,
    }));
    get().persist();
  },
  loadDoc: (doc, opts) => {
    set({
      nodes: doc.nodes,
      edges: doc.edges,
      intent: doc.intent,
      selectedNodeId: null,
      selectedEdgeId: null,
      history: [],
      future: [],
      strokes: opts?.clearInk === false ? get().strokes : [],
      ink: null,
      fadingInk: [],
    });
    get().persist();
  },
  applyGeneratedGraph: (doc) => {
    // Keep undo history so Generate does not permanently wipe a sketch.
    get().pushHistory();
    set({
      nodes: doc.nodes,
      edges: doc.edges,
      intent: doc.intent || get().intent,
      selectedNodeId: null,
      selectedEdgeId: null,
      strokes: [],
      ink: null,
      fadingInk: [],
      editingNodeId: null,
    });
    get().persist();
  },
  exportDoc: () => ({
    version: 1,
    intent: get().intent,
    nodes: get().nodes,
    edges: get().edges,
  }),
  setInk: (ink) => set({ ink }),
  commitStroke: (stroke) => {
    get().pushHistory();
    set((s) => ({
      ink: null,
      strokes: [...s.strokes, { ...stroke, fading: false }],
    }));
    get().persist();
  },
  clearStrokes: () => {
    set({ strokes: [], ink: null, fadingInk: [] });
    get().persist();
  },
  commitInkFade: (stroke) =>
    set((s) => ({
      ink: null,
      fadingInk: [...s.fadingInk, { ...stroke, fading: true }],
    })),
  clearFadedInk: (id) =>
    set((s) => ({ fadingInk: s.fadingInk.filter((k) => k.id !== id) })),
  pushHistory: () =>
    set((s) => ({
      history: [...s.history.slice(-40), snapshotOf(s)],
      future: [],
    })),
  undo: () => {
    const { history } = get();
    if (!history.length) return;
    const prev = history[history.length - 1];
    set((s) => ({
      history: history.slice(0, -1),
      future: [snapshotOf(s), ...s.future],
      nodes: prev.nodes,
      edges: prev.edges,
      intent: prev.intent,
      strokes: prev.strokes,
    }));
    get().persist();
  },
  redo: () => {
    const { future } = get();
    if (!future.length) return;
    const next = future[0];
    set((s) => ({
      future: future.slice(1),
      history: [...s.history, snapshotOf(s)],
      nodes: next.nodes,
      edges: next.edges,
      intent: next.intent,
      strokes: next.strokes,
    }));
    get().persist();
  },
  resetGeneration: () => set({ generation: idleGeneration() }),
  patchGeneration: (patch) =>
    set((s) => ({ generation: { ...s.generation, ...patch } })),
  upsertFile: (file) =>
    set((s) => {
      const files = s.generation.files.some((f) => f.path === file.path)
        ? s.generation.files.map((f) => (f.path === file.path ? file : f))
        : [...s.generation.files, file];
      return {
        generation: {
          ...s.generation,
          files,
          activeFile: s.generation.activeFile ?? file.path,
        },
      };
    }),
  persist: () => {
    if (typeof window === "undefined") return;
    const doc: SketchDoc = get().exportDoc();
    localStorage.setItem(
      STORAGE_KEY,
      serializeDoc({
        ...doc,
        // strokes kept separately
      } as SketchDoc)
    );
    localStorage.setItem(
      "sketchcoder.ink.v1",
      JSON.stringify(get().strokes.map((s) => ({ id: s.id, points: s.points })))
    );
  },
  hydrate: () => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      set({ ...emptyDoc(), nodes: [], edges: [] });
    } else {
      try {
        const doc = parseDoc(raw);
        set({ nodes: doc.nodes, edges: doc.edges, intent: doc.intent });
      } catch {
        /* ignore */
      }
    }
    try {
      const inkRaw = localStorage.getItem("sketchcoder.ink.v1");
      if (inkRaw) {
        const strokes = JSON.parse(inkRaw) as InkStroke[];
        set({
          strokes: strokes.map((s) => ({ ...s, fading: false })),
        });
      }
    } catch {
      /* ignore */
    }
  },
}));

export const SHAPE_FOR_TOOL: Record<
  Extract<Tool, "rect" | "rounded" | "diamond">,
  NodeShape
> = {
  rect: "rect",
  rounded: "rounded",
  diamond: "diamond",
};
