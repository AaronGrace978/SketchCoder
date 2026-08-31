import { graphSummary, type SketchDoc } from "@sketchcoder/graph";
import type { ScaffoldResult } from "@sketchcoder/templates";

export function adaptPrompt(doc: SketchDoc, base: ScaffoldResult): string {
  return [
    "You adapt a SketchCoder scaffold to match a sketched system graph.",
    "Return ONLY valid JSON with this shape:",
    '{ "summary": string, "nextSteps": string[], "files": [{ "path": string, "content": string }] }',
    "Keep every original path unless a rename is clearly required.",
    "Preserve runnable TypeScript. Interpolate node labels from the graph.",
    "Do not wrap in markdown.",
    "",
    graphSummary(doc),
    "",
    "Base files:",
    ...base.files.map((f) => `--- ${f.path} ---\n${f.content}`),
  ].join("\n");
}
