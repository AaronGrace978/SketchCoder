"use client";

import { parseDoc, serializeDoc } from "@sketchcoder/graph";
import { downloadJson, downloadZip } from "@/lib/export";
import { runGenerate } from "@/lib/generate";
import { highlightCode, treeFromPaths, type TreeNode } from "@/lib/highlight";
import { useSketch } from "@/lib/store";

export function Rail() {
  const intent = useSketch((s) => s.intent);
  const generation = useSketch((s) => s.generation);
  const selected = useSketch((s) => s.nodes.find((n) => n.id === s.selectedNodeId));
  const selectedEdge = useSketch((s) => s.edges.find((e) => e.id === s.selectedEdgeId));
  const active = generation.files.find((f) => f.path === generation.activeFile);

  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-l border-line bg-graphite">
      <div className="border-b border-line px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">Intent</p>
        <textarea
          value={intent}
          onChange={(e) => useSketch.getState().setIntent(e.target.value)}
          placeholder="Production RAG with citations…"
          rows={3}
          className="mt-2 w-full resize-none bg-transparent text-[15px] leading-snug text-bone outline-none placeholder:text-muted/70"
        />
        <button
          onClick={() => runGenerate()}
          disabled={generation.status === "running"}
          className="mt-3 w-full bg-brass py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink disabled:opacity-50"
        >
          {generation.status === "running"
            ? generation.phase === "capturing"
              ? "Capturing…"
              : generation.phase === "reading"
                ? "Reading…"
                : "Writing…"
            : "Generate"}
        </button>
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted">
          Pen-write RAG / CRUD / AGENT, or draw typed boxes + arrows. Generate
          screenshots the board and builds a runnable zip. Ctrl+Z undoes a replace.
        </p>
      </div>

      {selected ? (
        <div className="border-b border-line px-5 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">Node</p>
          <input
            value={selected.label}
            onChange={(e) =>
              useSketch.getState().updateNode(selected.id, { label: e.target.value })
            }
            className="mt-1 w-full bg-transparent text-[16px] text-bone outline-none"
          />
        </div>
      ) : null}

      {selectedEdge ? (
        <div className="border-b border-line px-5 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">Edge</p>
          <input
            value={selectedEdge.label ?? ""}
            placeholder="embed, retrieve, stream…"
            onChange={(e) =>
              useSketch.getState().updateEdge(selectedEdge.id, {
                label: e.target.value || undefined,
              })
            }
            className="mt-1 w-full bg-transparent font-mono text-[13px] text-bone outline-none placeholder:text-muted/70"
          />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-5 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            {generation.pattern || "Scaffold"}
          </p>
          <div className="flex gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            <label className="cursor-pointer">
              Import
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  file.text().then((text) => {
                    try {
                      useSketch.getState().loadDoc(parseDoc(text));
                    } catch {
                      useSketch.getState().patchGeneration({
                        status: "error",
                        error: "Could not read that sketch file.",
                      });
                    }
                  });
                  e.target.value = "";
                }}
              />
            </label>
            <button
              onClick={() =>
                downloadJson(serializeDoc(useSketch.getState().exportDoc()))
              }
            >
              JSON
            </button>
            <button
              disabled={!generation.files.length}
              onClick={() => downloadZip(generation.files)}
              className="disabled:opacity-30"
            >
              Zip
            </button>
          </div>
        </div>
        {generation.error ? (
          <p className="px-5 text-[13px] text-brass">{generation.error}</p>
        ) : null}
        {generation.readText ? (
          <p className="px-5 pb-2 font-mono text-[11px] text-brass">
            Board read: {generation.readText}
          </p>
        ) : null}
        {generation.summary ? (
          <p className="px-5 pb-3 text-[13px] leading-relaxed text-muted">{generation.summary}</p>
        ) : (
          <p className="px-5 pb-3 text-[13px] leading-relaxed text-muted">
            Write RAG with the pen, or sketch Client → API → Store. Generate
            captures the board and streams scaffolding.
          </p>
        )}
        {generation.nextSteps.length ? (
          <ul className="px-5 pb-3 font-mono text-[11px] leading-relaxed text-muted">
            {generation.nextSteps.map((step) => (
              <li key={step} className="mt-1">
                {step}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="min-h-0 flex-1 overflow-hidden border-t border-line">
          {generation.files.length ? (
            <div className="grid h-full grid-rows-[38%_62%]">
              <ul className="scroll-thin overflow-auto px-3 py-2 font-mono text-[12px]">
                {treeFromPaths(generation.files.map((f) => f.path)).map((n) => (
                  <TreeRow key={n.path} node={n} depth={0} />
                ))}
              </ul>
              <pre className="scroll-thin overflow-auto border-t border-line bg-ink px-4 py-3 font-mono text-[11px] leading-relaxed text-bone/90">
                {active ? (
                  <code
                    dangerouslySetInnerHTML={{ __html: highlightCode(active.content) }}
                  />
                ) : null}
              </pre>
            </div>
          ) : (
            <div className="px-5 py-6 font-mono text-[12px] text-muted">No files yet.</div>
          )}
        </div>
      </div>
    </aside>
  );
}

function TreeRow({ node, depth }: { node: TreeNode; depth: number }) {
  const active = useSketch((s) => s.generation.activeFile);
  const isFile = !node.children;
  return (
    <li>
      <button
        className={`file-in block w-full truncate py-0.5 text-left ${
          active === node.path ? "text-brass" : "text-bone/80"
        }`}
        style={{ paddingLeft: 8 + depth * 12 }}
        onClick={() => {
          if (isFile) useSketch.getState().patchGeneration({ activeFile: node.path });
        }}
      >
        {node.name}
      </button>
      {node.children?.map((child) => (
        <ul key={child.path}>
          <TreeRow node={child} depth={depth + 1} />
        </ul>
      ))}
    </li>
  );
}
