"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_NODE_SIZE, NODE_TYPE_META } from "@sketchcoder/graph";
import {
  bbox,
  dist,
  edgePath,
  hitNode,
  nearestNode,
  nodeCenter,
  pathFromPoints,
  polylineLength,
  screenToWorld,
  type Pt,
} from "@/lib/geometry";
import { SHAPE_FOR_TOOL, useSketch, type Tool } from "@/lib/store";
import { NodeBlock } from "./NodeBlock";

export function SketchCanvas({
  readOnly = false,
  className = "",
}: {
  readOnly?: boolean;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [draft, setDraft] = useState<null | { kind: "shape" | "arrow"; a: Pt; b: Pt }>(null);
  const drag = useRef<null | { mode: "pan" | "node" | "ink" | "shape" | "arrow"; id?: string; last: Pt; origin?: Pt; startNode?: { x: number; y: number } }>(null);

  const nodes = useSketch((s) => s.nodes);
  const edges = useSketch((s) => s.edges);
  const tool = useSketch((s) => s.tool);
  const viewport = useSketch((s) => s.viewport);
  const spaceDown = useSketch((s) => s.spaceDown);
  const selectedNodeId = useSketch((s) => s.selectedNodeId);
  const selectedEdgeId = useSketch((s) => s.selectedEdgeId);
  const pulsingNodeId = useSketch((s) => s.generation.pulsingNodeId);
  const ink = useSketch((s) => s.ink);
  const strokes = useSketch((s) => s.strokes);
  const fadingInk = useSketch((s) => s.fadingInk);
  const generating = useSketch((s) => s.generation.status === "running");
  const phase = useSketch((s) => s.generation.phase);
  const readText = useSketch((s) => s.generation.readText);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
      useSketch.getState().setBoardSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    const onWheelNative = (event: WheelEvent) => {
      event.preventDefault();
      const vp = useSketch.getState().viewport;
      const rect = el.getBoundingClientRect();
      const cursor = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      const factor = event.deltaY > 0 ? 0.94 : 1.06;
      const zoom = Math.min(2.4, Math.max(0.28, vp.zoom * factor));
      const wx = (cursor.x - vp.x) / vp.zoom;
      const wy = (cursor.y - vp.y) / vp.zoom;
      useSketch.getState().setViewport({
        zoom,
        x: cursor.x - wx * zoom,
        y: cursor.y - wy * zoom,
      });
    };
    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener("wheel", onWheelNative);
    };
  }, []);

  function worldFromEvent(e: React.PointerEvent | PointerEvent): Pt {
    const rect = wrapRef.current!.getBoundingClientRect();
    return screenToWorld({ x: e.clientX, y: e.clientY }, rect, useSketch.getState().viewport);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (readOnly) return;
    if (e.button === 1 || (e.button === 0 && (spaceDown || e.altKey))) {
      drag.current = { mode: "pan", last: { x: e.clientX, y: e.clientY } };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const p = worldFromEvent(e);
    const s = useSketch.getState();
    const hit = hitNode(s.nodes, p);

    if (s.tool === "select" || s.tool === "label") {
      if (hit) {
        s.selectNode(hit.id);
        s.selectEdge(null);
        if (s.tool === "label") s.setEditing(hit.id);
        drag.current = {
          mode: "node",
          id: hit.id,
          last: p,
          origin: p,
          startNode: { x: hit.x, y: hit.y },
        };
        s.pushHistory();
      } else {
        s.selectNode(null);
        s.selectEdge(null);
        s.setEditing(null);
        drag.current = { mode: "pan", last: { x: e.clientX, y: e.clientY } };
      }
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (s.tool === "arrow") {
      if (!hit) return;
      s.selectNode(hit.id);
      drag.current = { mode: "arrow", id: hit.id, last: p };
      setDraft({ kind: "arrow", a: nodeCenter(hit), b: p });
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (s.tool === "pen") {
      const stroke = { id: `ink_${Date.now()}`, points: [p], fading: false };
      s.setInk(stroke);
      drag.current = { mode: "ink", last: p };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (s.tool === "rect" || s.tool === "rounded" || s.tool === "diamond") {
      drag.current = { mode: "shape", last: p, origin: p };
      setDraft({ kind: "shape", a: p, b: p });
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    if (d.mode === "pan") {
      const vp = useSketch.getState().viewport;
      useSketch.getState().setViewport({
        ...vp,
        x: vp.x + (e.clientX - d.last.x),
        y: vp.y + (e.clientY - d.last.y),
      });
      d.last = { x: e.clientX, y: e.clientY };
      return;
    }
    const p = worldFromEvent(e);
    if (d.mode === "node" && d.id && d.startNode && d.origin) {
      useSketch.getState().moveNode(
        d.id,
        d.startNode.x + (p.x - d.origin.x),
        d.startNode.y + (p.y - d.origin.y)
      );
    }
    if (d.mode === "ink") {
      const current = useSketch.getState().ink;
      if (current && dist(current.points[current.points.length - 1], p) > 1.4) {
        useSketch.getState().setInk({
          ...current,
          points: [...current.points, p],
        });
      }
    }
    if (d.mode === "shape" && d.origin) {
      setDraft({ kind: "shape", a: d.origin, b: p });
    }
    if (d.mode === "arrow") {
      const from = useSketch.getState().nodes.find((n) => n.id === d.id);
      if (from) setDraft({ kind: "arrow", a: nodeCenter(from), b: p });
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    drag.current = null;
    if (!d || readOnly) {
      setDraft(null);
      return;
    }
    const p = worldFromEvent(e);
    const s = useSketch.getState();

    if (d.mode === "node") {
      s.persist();
    }

    if (d.mode === "ink") {
      const stroke = s.ink;
      if (stroke) interpretInk(stroke);
    }

    if (d.mode === "shape" && d.origin && (s.tool === "rect" || s.tool === "rounded" || s.tool === "diamond")) {
      const box = bbox([d.origin, p]);
      const w = Math.max(DEFAULT_NODE_SIZE.w, box.w);
      const h = Math.max(DEFAULT_NODE_SIZE.h, box.h);
      s.addNode({
        x: box.x,
        y: box.y,
        w,
        h,
        shape: SHAPE_FOR_TOOL[s.tool],
        type: s.pendingType,
        label: NODE_TYPE_META[s.pendingType].label,
      });
    }

    if (d.mode === "arrow" && d.id) {
      const target = hitNode(s.nodes, p) ?? nearestNode(s.nodes, p, 28);
      if (target && target.id !== d.id) s.addEdge(d.id, target.id);
    }

    setDraft(null);
  }

  function interpretInk(stroke: { id: string; points: Pt[] }) {
    const s = useSketch.getState();
    const points = stroke.points;
    const len = polylineLength(points);
    if (len < 10) {
      s.setInk(null);
      return;
    }

    const start = points[0];
    const end = points[points.length - 1];
    const a = nearestNode(s.nodes, start, 28);
    const b = nearestNode(s.nodes, end, 28);
    const box = bbox(points);
    const aspect = box.w / Math.max(8, box.h);
    const skinny = aspect > 4.5 || aspect < 0.22;
    // Handwriting is usually short-ish strokes; don't steal letter ink as edges.
    const looksLikeConnector =
      skinny && len > 120 && box.w > 140 && Math.min(box.w, box.h) < 36;

    if (
      a &&
      b &&
      a.id !== b.id &&
      looksLikeConnector &&
      s.nodes.length >= 2
    ) {
      s.commitInkFade({ ...stroke, fading: true });
      window.setTimeout(() => s.clearFadedInk(stroke.id), 420);
      s.addEdge(a.id, b.id);
      return;
    }

    s.commitStroke({ ...stroke, fading: false });
  }

  function onPointerCancel(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    drag.current = null;
    setDraft(null);
    if (!d || readOnly) return;
    if (d.mode === "ink") {
      const stroke = useSketch.getState().ink;
      if (stroke && stroke.points.length > 2) {
        useSketch.getState().commitStroke({ ...stroke, fading: false });
      } else {
        useSketch.getState().setInk(null);
      }
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }

  const cursor = readOnly
    ? "default"
    : spaceDown
      ? "grab"
      : tool === "select"
        ? "default"
        : "crosshair";

  return (
    <div
      ref={wrapRef}
      className={`relative h-full w-full overflow-hidden ${className}`}
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div
        className="dot-grid absolute inset-0 origin-top-left"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          backgroundPosition: "0 0",
        }}
      />
      <svg
        width={size.w}
        height={size.h}
        className="absolute inset-0"
        style={{ opacity: generating ? 0.72 : 1, transition: "opacity 240ms ease" }}
      >
        <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
          {edges.map((edge) => {
            const from = nodes.find((n) => n.id === edge.from);
            const to = nodes.find((n) => n.id === edge.to);
            if (!from || !to) return null;
            const d = edgePath(from, to);
            const selected = edge.id === selectedEdgeId;
            const mid = nodeCenter({
              ...from,
              x: (from.x + to.x) / 2,
              y: (from.y + to.y) / 2,
              w: 0,
              h: 0,
            });
            return (
              <g key={edge.id}>
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  onPointerDown={(ev) => {
                    if (readOnly) return;
                    ev.stopPropagation();
                    useSketch.getState().selectEdge(edge.id);
                    useSketch.getState().selectNode(null);
                  }}
                />
                <path
                  d={d}
                  fill="none"
                  stroke={selected ? "var(--brass)" : "rgba(232,226,214,0.32)"}
                  strokeWidth={selected ? 1.6 : 1.15}
                  markerEnd="url(#arrowhead)"
                />
                {edge.label ? (
                  <text
                    x={mid.x}
                    y={mid.y - 8}
                    textAnchor="middle"
                    fill="var(--muted)"
                    fontSize={11}
                    fontFamily="var(--font-mono)"
                  >
                    {edge.label}
                  </text>
                ) : null}
              </g>
            );
          })}
          {draft?.kind === "arrow" ? (
            <path
              d={`M ${draft.a.x} ${draft.a.y} L ${draft.b.x} ${draft.b.y}`}
              fill="none"
              stroke="var(--brass)"
              strokeWidth={1.2}
              strokeDasharray="4 4"
            />
          ) : null}
          {draft?.kind === "shape" ? (
            <DraftShape a={draft.a} b={draft.b} tool={tool} />
          ) : null}
          {nodes.map((node) => (
            <NodeBlock
              key={node.id}
              node={node}
              selected={node.id === selectedNodeId}
              pulsing={node.id === pulsingNodeId}
            />
          ))}
          {[...strokes, ink, ...fadingInk].filter(Boolean).map((stroke) =>
            stroke ? (
              <path
                key={stroke.id}
                d={pathFromPoints(stroke.points)}
                fill="none"
                stroke="var(--bone)"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={stroke.fading ? "ink-fade" : undefined}
                opacity={0.92}
              />
            ) : null
          )}
        </g>
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L7,3 L0,6" fill="none" stroke="rgba(232,226,214,0.55)" />
          </marker>
        </defs>
      </svg>
      <LabelEditor />
      {generating ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-ink/55">
          <div className="border border-line bg-graphite px-8 py-5 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
              {phase === "capturing"
                ? "Capturing board"
                : phase === "reading"
                  ? "Reading sketch"
                  : "Writing scaffold"}
            </p>
            <p className="mt-2 text-[18px] tracking-[-0.02em] text-bone">
              {phase === "capturing"
                ? "Screenshot…"
                : phase === "reading"
                  ? readText
                    ? `Saw “${readText}”`
                    : "Vision on the ink…"
                  : "Files streaming in"}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DraftShape({ a, b, tool }: { a: Pt; b: Pt; tool: Tool }) {
  const box = bbox([a, b]);
  const w = Math.max(24, box.w);
  const h = Math.max(24, box.h);
  if (tool === "diamond") {
    const cx = box.x + w / 2;
    const cy = box.y + h / 2;
    return (
      <polygon
        points={`${cx},${box.y} ${box.x + w},${cy} ${cx},${box.y + h} ${box.x},${cy}`}
        fill="rgba(201,163,106,0.06)"
        stroke="var(--brass)"
        strokeDasharray="5 4"
      />
    );
  }
  return (
    <rect
      x={box.x}
      y={box.y}
      width={w}
      height={h}
      rx={tool === "rounded" ? 18 : 2}
      fill="rgba(201,163,106,0.06)"
      stroke="var(--brass)"
      strokeDasharray="5 4"
    />
  );
}

function LabelEditor() {
  const id = useSketch((s) => s.editingNodeId);
  const node = useSketch((s) => s.nodes.find((n) => n.id === id));
  const viewport = useSketch((s) => s.viewport);
  if (!node) return null;
  return (
    <input
      autoFocus
      value={node.label}
      onChange={(e) => useSketch.getState().updateNode(node.id, { label: e.target.value })}
      onBlur={() => useSketch.getState().setEditing(null)}
      onKeyDown={(e) => {
        if (e.key === "Enter") useSketch.getState().setEditing(null);
      }}
      className="absolute z-10 bg-paper text-bone outline-none border border-line px-2 py-1 text-[15px]"
      style={{
        left: node.x * viewport.zoom + viewport.x + 12,
        top: node.y * viewport.zoom + viewport.y + node.h * viewport.zoom * 0.42,
        width: Math.max(80, (node.w - 24) * viewport.zoom),
      }}
    />
  );
}
