import type { SketchDoc, SketchNode } from "@sketchcoder/graph";

export type ScaffoldFile = {
  path: string;
  content: string;
};

export type ScaffoldResult = {
  pattern: PatternKind;
  summary: string;
  nextSteps: string[];
  files: ScaffoldFile[];
  nodeFiles: Record<string, string[]>;
};

export type PatternKind = "rag" | "crud" | "agent" | "webhook" | "generic";

export type PatternMatch = {
  kind: PatternKind;
  score: number;
  slots: Record<string, SketchNode>;
};

export function nodeByType(doc: SketchDoc, type: SketchNode["type"]): SketchNode[] {
  return doc.nodes.filter((n) => n.type === type);
}

export function labelOf(node: SketchNode | undefined, fallback: string): string {
  return node?.label?.trim() || fallback;
}

export function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "module";
}

export function file(
  path: string,
  lines: string[]
): ScaffoldFile {
  return { path, content: lines.join("\n") + "\n" };
}
