"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ragDemoDoc } from "@sketchcoder/graph";
import { SketchCanvas } from "@/components/canvas/SketchCanvas";
import { Rail } from "@/components/studio/Rail";
import { SettingsPanel } from "@/components/studio/SettingsPanel";
import { Toolbar } from "@/components/studio/Toolbar";
import { cancelGenerate } from "@/lib/generate";
import { useSketch, type Tool } from "@/lib/store";

const KEY_TOOLS: Record<string, Tool> = {
  v: "select",
  p: "pen",
  r: "rect",
  o: "rounded",
  d: "diamond",
  a: "arrow",
  t: "label",
};

export function StudioApp({ loadDemo }: { loadDemo?: boolean }) {
  useEffect(() => {
    const s = useSketch.getState();
    s.hydrate();
    if (loadDemo) s.loadDoc(ragDemoDoc());
  }, [loadDemo]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (e.code === "Space" && !typing) {
        e.preventDefault();
        useSketch.getState().setSpaceDown(true);
      }
      if (typing) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) useSketch.getState().redo();
        else useSketch.getState().undo();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        useSketch.getState().removeSelected();
      }
      const tool = KEY_TOOLS[e.key.toLowerCase()];
      if (tool) useSketch.getState().setTool(tool);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") useSketch.getState().setSpaceDown(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const generating = useSketch((s) => s.generation.status === "running");

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-ink">
      <div className="relative min-w-0 flex-1">
        <header className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-start justify-between px-6 pt-5">
          <Link href="/" className="pointer-events-auto text-[22px] tracking-[-0.03em] text-bone">
            SketchCoder
          </Link>
          <div className="pointer-events-auto flex items-center gap-5">
            <SettingsPanel />
            {generating ? (
              <button
                type="button"
                className="font-mono text-[11px] uppercase tracking-[0.16em] text-brass hover:text-bone"
                onClick={() => cancelGenerate()}
              >
                Cancel
              </button>
            ) : null}
            <button
              type="button"
              className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted hover:text-bone"
              onClick={() => {
                cancelGenerate();
                useSketch.getState().clearStrokes();
              }}
            >
              Clear ink
            </button>
            <button
              type="button"
              className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted hover:text-bone"
              title="Clear boxes, ink, intent, and demo"
              onClick={() => {
                cancelGenerate();
                useSketch.getState().clearBoard();
              }}
            >
              Clear board
            </button>
            <button
              type="button"
              className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted hover:text-bone"
              onClick={() => {
                cancelGenerate();
                useSketch.getState().loadDoc(ragDemoDoc());
              }}
            >
              Load RAG demo
            </button>
          </div>
        </header>
        <SketchCanvas />
        <Toolbar />
        <div className="grain" />
      </div>
      <Rail />
    </div>
  );
}
