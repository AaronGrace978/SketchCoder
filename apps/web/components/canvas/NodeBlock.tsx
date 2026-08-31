"use client";

import { NODE_TYPE_META } from "@sketchcoder/graph";
import type { SketchNode } from "@sketchcoder/graph";
import { useSketch } from "@/lib/store";
import { TYPE_TONE } from "@/lib/tones";

export function NodeBlock({
  node,
  selected,
  pulsing,
}: {
  node: SketchNode;
  selected: boolean;
  pulsing: boolean;
}) {
  const tone = TYPE_TONE[node.type];
  const stroke = selected ? "var(--brass)" : "rgba(232,226,214,0.28)";
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;

  return (
    <g
      onDoubleClick={(e) => {
        e.stopPropagation();
        useSketch.getState().setEditing(node.id);
      }}
    >
      {node.shape === "diamond" ? (
        <polygon
          points={`${cx},${node.y} ${node.x + node.w},${cy} ${cx},${node.y + node.h} ${node.x},${cy}`}
          fill="rgba(18,20,26,0.92)"
          stroke={stroke}
          strokeWidth={selected ? 1.6 : 1.15}
          className={pulsing ? "node-pulse" : undefined}
        />
      ) : (
        <rect
          x={node.x}
          y={node.y}
          width={node.w}
          height={node.h}
          rx={node.shape === "rounded" ? 18 : 3}
          fill="rgba(18,20,26,0.92)"
          stroke={stroke}
          strokeWidth={selected ? 1.6 : 1.15}
          className={pulsing ? "node-pulse" : undefined}
        />
      )}
      <text
        x={cx}
        y={node.y + 22}
        textAnchor="middle"
        fill={tone}
        fontSize={10}
        letterSpacing={1.8}
        fontFamily="var(--font-mono)"
      >
        {NODE_TYPE_META[node.type].label.toUpperCase()}
      </text>
      <text
        x={cx}
        y={node.y + node.h * 0.62}
        textAnchor="middle"
        fill="var(--bone)"
        fontSize={15}
        fontFamily="var(--font-display)"
      >
        {node.label}
      </text>
    </g>
  );
}
