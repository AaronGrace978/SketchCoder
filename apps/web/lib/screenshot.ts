import type { SketchEdge, SketchNode } from "@sketchcoder/graph";
import type { InkStroke, Viewport } from "./store";
import { edgePath } from "./geometry";

const BOARD_BG = "#0b0c0f";
const BONE = "#e8e2d6";
const BRASS = "#c9a36a";
const MUTED = "#8d877b";
const LINE = "rgba(232,226,214,0.28)";

export type BoardSnapshot = {
  nodes: SketchNode[];
  edges: SketchEdge[];
  strokes: InkStroke[];
  viewport: Viewport;
  width: number;
  height: number;
};

/** Renders the live board into a PNG data URL for vision / OCR. */
export function captureBoardPng(board: BoardSnapshot): string {
  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = Math.max(640, Math.floor(board.width * scale));
  canvas.height = Math.max(400, Math.floor(board.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.scale(scale, scale);
  ctx.fillStyle = BOARD_BG;
  ctx.fillRect(0, 0, board.width, board.height);

  // Dot grid
  ctx.fillStyle = "rgba(232,226,214,0.08)";
  for (let x = 0; x < board.width; x += 22) {
    for (let y = 0; y < board.height; y += 22) {
      ctx.beginPath();
      ctx.arc(x, y, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.save();
  ctx.translate(board.viewport.x, board.viewport.y);
  ctx.scale(board.viewport.zoom, board.viewport.zoom);

  for (const edge of board.edges) {
    const from = board.nodes.find((n) => n.id === edge.from);
    const to = board.nodes.find((n) => n.id === edge.to);
    if (!from || !to) continue;
    const d = edgePath(from, to);
    strokeSvgPath(ctx, d, LINE, 1.4);
  }

  for (const node of board.nodes) {
    drawNode(ctx, node);
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = BONE;
  ctx.lineWidth = 3.2;
  for (const stroke of board.strokes) {
    if (stroke.points.length < 2) continue;
    ctx.beginPath();
    stroke.points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
  }

  ctx.restore();
  return canvas.toDataURL("image/png");
}

function drawNode(ctx: CanvasRenderingContext2D, node: SketchNode) {
  ctx.fillStyle = "rgba(18,20,26,0.96)";
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1.4;
  if (node.shape === "diamond") {
    const cx = node.x + node.w / 2;
    const cy = node.y + node.h / 2;
    ctx.beginPath();
    ctx.moveTo(cx, node.y);
    ctx.lineTo(node.x + node.w, cy);
    ctx.lineTo(cx, node.y + node.h);
    ctx.lineTo(node.x, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    roundRect(ctx, node.x, node.y, node.w, node.h, node.shape === "rounded" ? 18 : 3);
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = BRASS;
  ctx.font = "10px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(node.type.toUpperCase(), node.x + node.w / 2, node.y + 22);
  ctx.fillStyle = BONE;
  ctx.font = "15px Georgia, serif";
  ctx.fillText(node.label, node.x + node.w / 2, node.y + node.h * 0.62);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Minimal SVG path stroker for M/L/C commands used by the board. */
function strokeSvgPath(
  ctx: CanvasRenderingContext2D,
  d: string,
  color: string,
  width: number
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  const tokens = d.match(/[MLC]|-?\d*\.?\d+/g) || [];
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === "M") {
      const x = Number(tokens[i++]);
      const y = Number(tokens[i++]);
      ctx.moveTo(x, y);
    } else if (cmd === "L") {
      const x = Number(tokens[i++]);
      const y = Number(tokens[i++]);
      ctx.lineTo(x, y);
    } else if (cmd === "C") {
      const x1 = Number(tokens[i++]);
      const y1 = Number(tokens[i++]);
      const x2 = Number(tokens[i++]);
      const y2 = Number(tokens[i++]);
      const x = Number(tokens[i++]);
      const y = Number(tokens[i++]);
      ctx.bezierCurveTo(x1, y1, x2, y2, x, y);
    } else {
      // bare numbers from pathFromPoints "M x y L x y"
      i--;
      break;
    }
  }
  // Fallback for pathFromPoints style without repeated L cmds handled above
  if (d.includes("L") || d.startsWith("M")) {
    ctx.stroke();
    return;
  }
  ctx.stroke();
}

/** High-contrast ink-only crop for OCR of handwritten words. */
export function captureInkOcrPng(strokes: InkStroke[]): string | null {
  if (!strokes.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of strokes) {
    for (const p of s.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  if (!Number.isFinite(minX)) return null;
  const pad = 40;
  const w = Math.max(120, maxX - minX + pad * 2);
  const h = Math.max(80, maxY - minY + pad * 2);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w * 2);
  canvas.height = Math.ceil(h * 2);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(2, 2);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue;
    ctx.beginPath();
    stroke.points.forEach((p, idx) => {
      const x = p.x - minX + pad;
      const y = p.y - minY + pad;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  return canvas.toDataURL("image/png");
}

export { MUTED };
