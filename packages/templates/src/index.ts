import type { SketchDoc } from "@sketchcoder/graph";
import type { ScaffoldResult } from "./types";
import { matchPattern } from "./match";
import { buildRag } from "./rag";
import { buildCrud } from "./crud";
import { buildAgent } from "./agent";
import { buildWebhook } from "./webhook";
import { buildGeneric } from "./generic";

export function scaffoldFromGraph(doc: SketchDoc): ScaffoldResult {
  const match = matchPattern(doc);
  switch (match.kind) {
    case "rag":
      return buildRag(doc, match);
    case "crud":
      return buildCrud(doc, match);
    case "agent":
      return buildAgent(doc, match);
    case "webhook":
      return buildWebhook(doc, match);
    default:
      return buildGeneric(doc, match);
  }
}

export { matchPattern } from "./match";
export { PATTERN_LABEL } from "./match";
export type { ScaffoldFile, ScaffoldResult, PatternKind, PatternMatch } from "./types";
