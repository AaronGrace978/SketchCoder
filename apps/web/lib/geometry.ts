import type { SketchNode } from "@sketchcoder/graph";

export type Pt = { x: number; y: number };

export function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function nodeCenter(n: SketchNode): Pt {
  return { x: n.x + n.w / 2, y: n.y + n.h / 2 };
}

export function nodeContains(n: SketchNode, p: Pt, pad = 0): boolean {
  return p.x >= n.x - pad && p.x <= n.x + n.w + pad && p.y >= n.y - pad && p.y <= n.y + n.h + pad;
}

export function hitNode(nodes: SketchNode[], p: Pt): SketchNode | undefined {
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (nodeContains(nodes[i], p, 4)) return nodes[i];
  }
  return undefined;
}

export function nearestNode(nodes: SketchNode[], p: Pt, max = 36): SketchNode | undefined {
  let best: SketchNode | undefined;
  let bestD = max;
  for (const n of nodes) {
    const c = nodeCenter(n);
    const d = nodeContains(n, p, 12) ? 0 : dist(c, p) - Math.max(n.w, n.h) / 2;
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

export function portToward(n: SketchNode, toward: Pt): Pt {
  const c = nodeCenter(n);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return { x: dx > 0 ? n.x + n.w : n.x, y: c.y };
  }
  return { x: c.x, y: dy > 0 ? n.y + n.h : n.y };
}

export function edgePath(from: SketchNode, to: SketchNode): string {
  const a = portToward(from, nodeCenter(to));
  const b = portToward(to, nodeCenter(from));
  const dx = Math.max(48, Math.abs(b.x - a.x) * 0.45);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

export function pathFromPoints(points: Pt[]): string {
  if (!points.length) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}

export function bbox(points: Pt[]): { x: number; y: number; w: number; h: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function polylineLength(points: Pt[]): number {
  let n = 0;
  for (let i = 1; i < points.length; i++) n += dist(points[i - 1], points[i]);
  return n;
}

export function screenToWorld(
  client: Pt,
  rect: DOMRect,
  viewport: { x: number; y: number; zoom: number }
): Pt {
  return {
    x: (client.x - rect.left - viewport.x) / viewport.zoom,
    y: (client.y - rect.top - viewport.y) / viewport.zoom,
  };
}
