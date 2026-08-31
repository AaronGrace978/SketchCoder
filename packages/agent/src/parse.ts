import type { ScaffoldFile } from "@sketchcoder/templates";

export function parseModelJson(raw: string): {
  summary?: string;
  nextSteps?: string[];
  files?: ScaffoldFile[];
} | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const data = JSON.parse(trimmed) as {
      summary?: string;
      nextSteps?: string[];
      files?: ScaffoldFile[];
    };
    if (!Array.isArray(data.files)) return null;
    return data;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}
