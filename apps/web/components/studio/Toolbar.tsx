"use client";

import { NODE_TYPES, NODE_TYPE_META } from "@sketchcoder/graph";
import { useSketch, type Tool } from "@/lib/store";

const TOOLS: { id: Tool; mark: string; title: string }[] = [
  { id: "select", mark: "V", title: "Select" },
  { id: "pen", mark: "/", title: "Pen — write words or freehand" },
  { id: "rect", mark: "□", title: "Box" },
  { id: "rounded", mark: "◯", title: "Service" },
  { id: "diamond", mark: "◇", title: "Decision" },
  { id: "arrow", mark: "→", title: "Arrow" },
  { id: "label", mark: "T", title: "Label" },
];

export function Toolbar() {
  const tool = useSketch((s) => s.tool);
  const pendingType = useSketch((s) => s.pendingType);
  const selected = useSketch((s) => s.nodes.find((n) => n.id === s.selectedNodeId));

  return (
    <div className="pointer-events-none absolute bottom-7 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2">
      <div className="pointer-events-auto flex items-center gap-1 border border-line bg-graphite/90 px-2 py-1.5 backdrop-blur-sm">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            title={`${t.title} (${t.mark})`}
            onClick={() => useSketch.getState().setTool(t.id)}
            className={`min-w-9 px-2 py-1.5 font-mono text-[13px] tracking-wide ${
              tool === t.id ? "bg-paper text-bone" : "text-muted hover:text-bone"
            }`}
          >
            {t.mark}
          </button>
        ))}
      </div>
      <div className="pointer-events-auto flex items-center gap-1 border border-line bg-graphite/90 px-2 py-1 backdrop-blur-sm">
        {NODE_TYPES.map((type) => (
          <button
            key={type}
            title={NODE_TYPE_META[type].hint}
            onClick={() => {
              useSketch.getState().setPendingType(type);
              if (selected) useSketch.getState().updateNode(selected.id, { type });
            }}
            className={`px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${
              (selected?.type ?? pendingType) === type
                ? "text-brass"
                : "text-muted hover:text-bone"
            }`}
          >
            {NODE_TYPE_META[type].label}
          </button>
        ))}
      </div>
    </div>
  );
}
