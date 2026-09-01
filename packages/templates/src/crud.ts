import type { SketchDoc } from "@sketchcoder/graph";
import { file, labelOf, slug, type PatternMatch, type ScaffoldResult } from "./types";

export function buildCrud(doc: SketchDoc, match: PatternMatch): ScaffoldResult {
  const api = labelOf(match.slots.api, "API");
  const store = labelOf(match.slots.store, "Store");
  const client = labelOf(match.slots.client, "Client");
  const resource = inferResource(doc.intent);
  const Resource = resource.charAt(0).toUpperCase() + resource.slice(1);
  const pkg = slug(doc.intent || "crud-api");

  const files = [
    file("README.md", [
      `# ${pkg}`,
      "",
      `CRUD scaffold from SketchCoder. ${client} talks to ${api}, which persists through ${store}.`,
      "",
      "## Run",
      "",
      "```bash",
      "npm install",
      "npm run dev",
      "```",
    ]),
    file("package.json", [
      `{`,
      `  "name": "${pkg}",`,
      `  "private": true,`,
      `  "type": "module",`,
      `  "scripts": { "dev": "tsx watch src/server.ts" },`,
      `  "devDependencies": { "tsx": "^4.19.2", "typescript": "^5.7.3" }`,
      `}`,
    ]),
    file("src/types.ts", [
      `export type ${Resource} = {`,
      "  id: string;",
      "  title: string;",
      "  body: string;",
      "  updatedAt: string;",
      "};",
    ]),
    file("src/store.ts", [
      `/** ${store} — replace with Postgres when you need durability. */`,
      `import type { ${Resource} } from "./types";`,
      "",
      `const rows = new Map<string, ${Resource}>();`,
      "",
      `export const repo = {`,
      `  list(): ${Resource}[] {`,
      "    return [...rows.values()];",
      "  },",
      `  get(id: string) {`,
      "    return rows.get(id) ?? null;",
      "  },",
      `  create(input: { title: string; body: string }): ${Resource} {`,
      "    const row = {",
      "      id: crypto.randomUUID(),",
      "      title: input.title,",
      "      body: input.body,",
      "      updatedAt: new Date().toISOString(),",
      "    };",
      "    rows.set(row.id, row);",
      "    return row;",
      "  },",
      `  update(id: string, input: { title?: string; body?: string }) {`,
      "    const current = rows.get(id);",
      "    if (!current) return null;",
      "    const next = { ...current, ...input, updatedAt: new Date().toISOString() };",
      "    rows.set(id, next);",
      "    return next;",
      "  },",
      "  remove(id: string) {",
      "    return rows.delete(id);",
      "  },",
      "};",
    ]),
    file("src/server.ts", [
      `/** ${api} */`,
      "import { createServer } from \"node:http\";",
      "import { repo } from \"./store\";",
      "",
      `const prefix = "/${resource}s";`,
      "",
      "const server = createServer(async (req, res) => {",
      "  const url = new URL(req.url ?? \"/\", \"http://localhost\");",
      "  const json = (code: number, body: unknown) => {",
      "    res.writeHead(code, { \"content-type\": \"application/json\" });",
      "    res.end(JSON.stringify(body));",
      "  };",
      "  try {",
      "    if (req.method === \"GET\" && url.pathname === prefix) return json(200, repo.list());",
      "    if (req.method === \"POST\" && url.pathname === prefix) {",
      "      const body = JSON.parse(await readBody(req));",
      "      return json(201, repo.create(body));",
      "    }",
      `    const matchId = url.pathname.match(new RegExp(\"^\" + prefix + \"/([^/]+)$\"));`,
      "    if (matchId) {",
      "      const id = matchId[1];",
      "      if (req.method === \"GET\") {",
      "        const row = repo.get(id);",
      "        return row ? json(200, row) : json(404, { error: \"not found\" });",
      "      }",
      "      if (req.method === \"PUT\") {",
      "        const body = JSON.parse(await readBody(req));",
      "        const row = repo.update(id, body);",
      "        return row ? json(200, row) : json(404, { error: \"not found\" });",
      "      }",
      "      if (req.method === \"DELETE\") {",
      "        return repo.remove(id) ? json(204, {}) : json(404, { error: \"not found\" });",
      "      }",
      "    }",
      "    json(404, { error: \"not found\" });",
      "  } catch (err) {",
      "    json(400, { error: String(err) });",
      "  }",
      "});",
      "",
      "function readBody(req: import(\"node:http\").IncomingMessage) {",
      "  return new Promise<string>((resolve) => {",
      "    const chunks: Buffer[] = [];",
      "    req.on(\"data\", (c) => chunks.push(c));",
      "    req.on(\"end\", () => resolve(Buffer.concat(chunks).toString(\"utf8\")));",
      "  });",
      "}",
      "",
      "server.listen(3000, () => console.log(`${prefix} listening on :3000`));",
    ]),
    file("src/client.ts", [
      `/** ${client} — thin fetch wrapper. */`,
      `const base = "/${resource}s";`,
      "",
      "export const api = {",
      "  list: () => fetch(base).then((r) => r.json()),",
      "  get: (id: string) => fetch(`${base}/${id}`).then((r) => r.json()),",
      "  create: (body: unknown) =>",
      "    fetch(base, {",
      "      method: \"POST\",",
      "      headers: { \"content-type\": \"application/json\" },",
      "      body: JSON.stringify(body),",
      "    }).then((r) => r.json()),",
      "  update: (id: string, body: unknown) =>",
      "    fetch(`${base}/${id}`, {",
      "      method: \"PUT\",",
      "      headers: { \"content-type\": \"application/json\" },",
      "      body: JSON.stringify(body),",
      "    }).then((r) => r.json()),",
      "  remove: (id: string) => fetch(`${base}/${id}`, { method: \"DELETE\" }),",
      "};",
    ]),
  ];

  const nodeFiles: Record<string, string[]> = {};
  if (match.slots.store) nodeFiles[match.slots.store.id] = ["src/store.ts"];
  if (match.slots.api) nodeFiles[match.slots.api.id] = ["src/server.ts"];
  if (match.slots.client) nodeFiles[match.slots.client.id] = ["src/client.ts"];

  return {
    pattern: "crud",
    summary: `CRUD API for ${resource}: list/create/update/delete persisted in ${store}.`,
    nextSteps: [
      `Replace the in-memory Map in src/store.ts.`,
      `Add validation on POST /${resource}s.`,
    ],
    files,
    nodeFiles,
  };
}

function inferResource(intent: string): string {
  const text = intent.toLowerCase();
  const forMatch = text.match(/\bfor\s+([a-z][a-z0-9_-]*)/i);
  if (forMatch?.[1] && !/^(a|an|the|my|our|crud|rest|api)$/i.test(forMatch[1])) {
    return slug(forMatch[1]);
  }
  const noun = text.match(
    /\b(notes?|posts?|users?|items?|tasks?|books?|products?|orders?|docs?|documents?)\b/i
  );
  if (noun?.[1]) return slug(noun[1].replace(/s$/, "") || noun[1]);
  const words = intent
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter((w) => w.length > 2 && !/^(crud|rest|api|with|list|create|update|delete|the|and)$/i.test(w));
  return slug(words[0] || "item");
}
