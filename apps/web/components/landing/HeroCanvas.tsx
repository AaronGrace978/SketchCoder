"use client";

const NODES = [
  { x: 70, y: 70, label: "Corpus", type: "EXTERNAL", delay: "0.1s" },
  { x: 300, y: 70, label: "Embedder", type: "SERVICE", delay: "0.35s" },
  { x: 530, y: 70, label: "Vector store", type: "STORE", delay: "0.6s" },
  { x: 70, y: 250, label: "Chat UI", type: "CLIENT", delay: "0.85s" },
  { x: 300, y: 250, label: "Ask API", type: "API", delay: "1.1s" },
  { x: 530, y: 250, label: "Retriever", type: "SERVICE", delay: "1.35s" },
  { x: 760, y: 160, label: "Grounded LLM", type: "MODEL", delay: "1.6s" },
];

const EDGES: [number, number, number][] = [
  [0, 1, 1.9],
  [1, 2, 2.15],
  [3, 4, 2.4],
  [4, 5, 2.65],
  [2, 5, 2.9],
  [5, 6, 3.15],
  [6, 4, 3.4],
];

export function HeroCanvas() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="dot-grid absolute inset-0 opacity-80" />
      <svg
        viewBox="0 0 1040 420"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        {EDGES.map(([from, to, t], i) => {
          const a = NODES[from];
          const b = NODES[to];
          const x1 = a.x + 188;
          const y1 = a.y + 38;
          const x2 = b.x;
          const y2 = b.y + 38;
          const dx = Math.max(40, Math.abs(x2 - x1) * 0.4);
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke="rgba(232,226,214,0.28)"
              strokeWidth="1.15"
              pathLength={1}
              style={{
                strokeDasharray: 1,
                strokeDashoffset: 1,
                animation: `drawIn 0.8s ${t}s ease forwards, fadeLoop 11s ${t}s ease infinite`,
              }}
            />
          );
        })}
        {NODES.map((n) => (
          <g
            key={n.label}
            style={{
              opacity: 0,
              animation: `settle 0.7s ${n.delay} ease forwards, fadeLoop 11s ${n.delay} ease infinite`,
            }}
          >
            <rect
              x={n.x}
              y={n.y}
              width="188"
              height="76"
              rx={n.type === "SERVICE" || n.type === "CLIENT" ? 18 : 3}
              fill="rgba(18,20,26,0.88)"
              stroke="rgba(232,226,214,0.28)"
            />
            <text
              x={n.x + 94}
              y={n.y + 24}
              textAnchor="middle"
              fill="var(--brass)"
              fontSize="10"
              letterSpacing="1.8"
              fontFamily="var(--font-mono)"
            >
              {n.type}
            </text>
            <text
              x={n.x + 94}
              y={n.y + 50}
              textAnchor="middle"
              fill="var(--bone)"
              fontSize="16"
              fontFamily="var(--font-display)"
            >
              {n.label}
            </text>
          </g>
        ))}
        <circle r="3.5" fill="var(--brass)">
          <animateMotion dur="11s" repeatCount="indefinite" path="M 80 108 C 240 40, 520 40, 820 198" />
        </circle>
      </svg>
      <div className="grain" />
      <style>{`
        @keyframes settle {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes fadeLoop {
          0%, 78% { opacity: 1; }
          90%, 100% { opacity: 0.15; }
        }
      `}</style>
    </div>
  );
}
