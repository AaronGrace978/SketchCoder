import type { SketchDoc } from "@sketchcoder/graph";
import { file, slug, type PatternMatch, type ScaffoldResult } from "./types";

export function buildGeneric(doc: SketchDoc, _match: PatternMatch): ScaffoldResult {
  const pkg = slug(doc.intent || "system");
  const modules = doc.nodes.map((n) => {
    const name = slug(n.label);
    return file(`src/modules/${name}.ts`, [
      `/** ${n.type}: ${n.label} */`,
      `export const ${name.replace(/-/g, "_")} = {`,
      `  id: "${n.id}",`,
      `  kind: "${n.type}" as const,`,
      `  label: ${JSON.stringify(n.label)},`,
      `  async ready() {`,
      `    return true;`,
      `  },`,
      `};`,
    ]);
  });

  const wiring = doc.edges.map((e) => {
    const from = doc.nodes.find((n) => n.id === e.from);
    const to = doc.nodes.find((n) => n.id === e.to);
    const a = slug(from?.label ?? e.from).replace(/-/g, "_");
    const b = slug(to?.label ?? e.to).replace(/-/g, "_");
    const label = e.label ? JSON.stringify(e.label) : "undefined";
    return `  { from: ${a}, to: ${b}, label: ${label} },`;
  });

  const imports = doc.nodes
    .map((n) => {
      const name = slug(n.label);
      const ident = name.replace(/-/g, "_");
      return `import { ${ident} } from "./modules/${name}";`;
    })
    .join("\n");

  const files = [
    file("README.md", [
      `# ${pkg}`,
      "",
      doc.intent || "System scaffold generated from a SketchCoder graph.",
      "",
      "## Nodes",
      "",
      ...doc.nodes.map((n) => `- **${n.label}** (${n.type})`),
      "",
      "## Edges",
      "",
      ...doc.edges.map((e) => {
        const from = doc.nodes.find((n) => n.id === e.from)?.label ?? e.from;
        const to = doc.nodes.find((n) => n.id === e.to)?.label ?? e.to;
        return `- ${from} → ${to}${e.label ? ` (${e.label})` : ""}`;
      }),
    ]),
    file("package.json", [
      `{`,
      `  "name": "${pkg}",`,
      `  "private": true,`,
      `  "type": "module",`,
      `  "scripts": { "dev": "tsx src/index.ts" },`,
      `  "devDependencies": { "tsx": "^4.19.2", "typescript": "^5.7.3" }`,
      `}`,
    ]),
    ...modules,
    file("src/index.ts", [
      imports,
      "",
      "export const graph = [",
      ...wiring,
      "];",
      "",
      "async function main() {",
      "  console.log(\"modules\", graph.length ? graph : \"no edges sketched\");",
      "}",
      "",
      "main();",
    ]),
  ];

  const nodeFiles: Record<string, string[]> = {};
  for (const n of doc.nodes) {
    nodeFiles[n.id] = [`src/modules/${slug(n.label)}.ts`];
  }

  return {
    pattern: "generic",
    summary: `Mapped ${doc.nodes.length} nodes and ${doc.edges.length} edges into typed modules.`,
    nextSteps: ["Fill each module stub with the real adapter for that box."],
    files,
    nodeFiles,
  };
}
