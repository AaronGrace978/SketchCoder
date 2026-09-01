import type { SketchDoc } from "@sketchcoder/graph";
import { normalizeSketchDoc } from "@sketchcoder/graph";
import type { ScaffoldResult } from "./types";
import { matchPattern } from "./match";
import { buildRag } from "./rag";
import { buildCrud } from "./crud";
import { buildAgent } from "./agent";
import { buildWebhook } from "./webhook";
import { buildGeneric } from "./generic";

export function scaffoldFromGraph(doc: SketchDoc): ScaffoldResult {
  const normalized = normalizeSketchDoc(doc);
  const match = matchPattern(normalized);
  switch (match.kind) {
    case "rag":
      return buildRag(normalized, match);
    case "crud":
      return buildCrud(normalized, match);
    case "agent":
      return buildAgent(normalized, match);
    case "webhook":
      return buildWebhook(normalized, match);
    default:
      return buildGeneric(normalized, match);
  }
}

export { matchPattern } from "./match";
export { PATTERN_LABEL } from "./match";
export type { ScaffoldFile, ScaffoldResult, PatternKind, PatternMatch } from "./types";
