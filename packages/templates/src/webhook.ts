import type { SketchDoc } from "@sketchcoder/graph";
import { file, labelOf, slug, type PatternMatch, type ScaffoldResult } from "./types";

export function buildWebhook(doc: SketchDoc, match: PatternMatch): ScaffoldResult {
  const queue = labelOf(match.slots.queue, "Queue");
  const api = labelOf(match.slots.api, "Webhook");
  const external = labelOf(match.slots.external, "Provider");
  const service = labelOf(match.slots.service, "Worker");
  const pkg = slug(doc.intent || "webhook-worker");

  const files = [
    file("README.md", [
      `# ${pkg}`,
      "",
      `${external} hits ${api}, jobs land on ${queue}, ${service} processes them.`,
      "",
      "```bash",
      "npm install && npm run dev",
      "```",
    ]),
    file("package.json", [
      `{`,
      `  "name": "${pkg}",`,
      `  "private": true,`,
      `  "type": "module",`,
      `  "scripts": { "dev": "tsx watch src/index.ts" },`,
      `  "devDependencies": { "tsx": "^4.19.2", "typescript": "^5.7.3" }`,
      `}`,
    ]),
    file("src/queue.ts", [
      `/** ${queue} — in-process FIFO. Swap for Redis / SQS. */`,
      "export type Job = { id: string; type: string; payload: unknown; attempts: number };",
      "",
      "const jobs: Job[] = [];",
      "const waiters: Array<(job: Job) => void> = [];",
      "",
      "export function enqueue(type: string, payload: unknown): Job {",
      "  const job = { id: crypto.randomUUID(), type, payload, attempts: 0 };",
      "  const waiter = waiters.shift();",
      "  if (waiter) waiter(job);",
      "  else jobs.push(job);",
      "  return job;",
      "}",
      "",
      "export function take(): Promise<Job> {",
      "  const job = jobs.shift();",
      "  if (job) return Promise.resolve(job);",
      "  return new Promise((resolve) => waiters.push(resolve));",
      "}",
    ]),
    file("src/worker.ts", [
      `/** ${service} */`,
      "import { take } from \"./queue\";",
      "",
      "export async function startWorker() {",
      "  for (;;) {",
      "    const job = await take();",
      "    job.attempts += 1;",
      "    try {",
      "      console.log(\"processing\", job.type, job.id);",
      "      // TODO: handle job.payload",
      "    } catch (err) {",
      "      console.error(\"job failed\", job.id, err);",
      "    }",
      "  }",
      "}",
    ]),
    file("src/http.ts", [
      `/** ${api} — ingest from ${external}. */`,
      "import { createServer } from \"node:http\";",
      "import { enqueue } from \"./queue\";",
      "",
      "export function startHttp() {",
      "  return createServer(async (req, res) => {",
      "    if (req.method !== \"POST\" || req.url !== \"/webhook\") {",
      "      res.writeHead(404);",
      "      res.end();",
      "      return;",
      "    }",
      "    const chunks: Buffer[] = [];",
      "    for await (const c of req) chunks.push(c as Buffer);",
      "    const payload = JSON.parse(Buffer.concat(chunks).toString() || \"{}\");",
      "    const job = enqueue(payload.type ?? \"event\", payload);",
      "    res.writeHead(202, { \"content-type\": \"application/json\" });",
      "    res.end(JSON.stringify({ id: job.id }));",
      "  }).listen(3000, () => console.log(\"webhook on :3000/webhook\"));",
      "}",
    ]),
    file("src/index.ts", [
      "import { startHttp } from \"./http\";",
      "import { startWorker } from \"./worker\";",
      "",
      "startHttp();",
      "startWorker();",
    ]),
  ];

  const nodeFiles: Record<string, string[]> = {};
  if (match.slots.queue) nodeFiles[match.slots.queue.id] = ["src/queue.ts"];
  if (match.slots.service) nodeFiles[match.slots.service.id] = ["src/worker.ts"];
  if (match.slots.api) nodeFiles[match.slots.api.id] = ["src/http.ts"];
  if (match.slots.external) nodeFiles[match.slots.external.id] = ["src/http.ts"];

  return {
    pattern: "webhook",
    summary: `Webhook worker: ${api} enqueues onto ${queue}; ${service} drains the jobs.`,
    nextSteps: [
      "Verify provider signatures before enqueue.",
      "Replace the in-process queue with Redis when you add a second instance.",
    ],
    files,
    nodeFiles,
  };
}
