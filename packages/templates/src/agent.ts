import type { SketchDoc } from "@sketchcoder/graph";
import { file, labelOf, slug, type PatternMatch, type ScaffoldResult } from "./types";

export function buildAgent(doc: SketchDoc, match: PatternMatch): ScaffoldResult {
  const model = labelOf(match.slots.model, "Model");
  const api = labelOf(match.slots.api, "Agent API");
  const client = labelOf(match.slots.client, "Chat UI");
  const tools = doc.nodes.filter(
    (n) => n.type === "external" || n.type === "service" || n.type === "store"
  );
  const pkg = slug(doc.intent || "chat-agent");

  const toolFns = tools
    .map((t) => {
      const name = slug(t.label).replace(/-/g, "_") || "tool";
      return [
        `{`,
        `  name: "${name}",`,
        `  description: "${t.label} (${t.type})",`,
        `  async run(input: string) {`,
        `    return { ok: true, tool: "${name}", echo: input };`,
        `  },`,
        `}`,
      ].join("\n  ");
    })
    .join(",\n  ");

  const files = [
    file("README.md", [
      `# ${pkg}`,
      "",
      `Chat agent scaffold. ${client} → ${api} → ${model}, with tools derived from the sketch.`,
      "",
      "## Tools",
      "",
      ...tools.map((t) => `- ${t.label} (${t.type})`),
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
      `  "scripts": { "dev": "tsx watch src/server.ts" },`,
      `  "dependencies": { "openai": "^4.77.0" },`,
      `  "devDependencies": { "tsx": "^4.19.2", "typescript": "^5.7.3" }`,
      `}`,
    ]),
    file(".env.example", ["OPENAI_API_KEY=", "OPENAI_MODEL=gpt-4o-mini"]),
    file("src/tools.ts", [
      "export type Tool = {",
      "  name: string;",
      "  description: string;",
      "  run: (input: string) => Promise<unknown>;",
      "};",
      "",
      "export const tools: Tool[] = [",
      `  ${toolFns || `{ name: "noop", description: "Placeholder", async run() { return { ok: true }; } }`},`,
      "];",
      "",
      "export const toolSpec = tools.map((t) => ({",
      "  type: \"function\" as const,",
      "  function: {",
      "    name: t.name,",
      "    description: t.description,",
      "    parameters: {",
      "      type: \"object\",",
      "      properties: { input: { type: \"string\" } },",
      "      required: [\"input\"],",
      "    },",
      "  },",
      "}));",
    ]),
    file("src/agent.ts", [
      `/** ${model} with a single tool loop. */`,
      "import OpenAI from \"openai\";",
      "import { tools, toolSpec } from \"./tools\";",
      "",
      "const client = new OpenAI();",
      "",
      "export async function runAgent(message: string) {",
      "  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [",
      "    { role: \"system\", content: \"Use tools when they would improve the answer. Be concise.\" },",
      "    { role: \"user\", content: message },",
      "  ];",
      "  for (let i = 0; i < 4; i++) {",
      "    const res = await client.chat.completions.create({",
      "      model: process.env.OPENAI_MODEL ?? \"gpt-4o-mini\",",
      "      messages,",
      "      tools: toolSpec,",
      "    });",
      "    const choice = res.choices[0];",
      "    const msg = choice.message;",
      "    messages.push(msg);",
      "    if (!msg.tool_calls?.length) return msg.content ?? \"\";",
      "    for (const call of msg.tool_calls) {",
      "      const tool = tools.find((t) => t.name === call.function.name);",
      "      const args = JSON.parse(call.function.arguments || \"{}\");",
      "      const output = tool ? await tool.run(args.input ?? \"\") : { error: \"unknown tool\" };",
      "      messages.push({",
      "        role: \"tool\",",
      "        tool_call_id: call.id,",
      "        content: JSON.stringify(output),",
      "      });",
      "    }",
      "  }",
      "  return \"Stopped after tool loop limit.\";",
      "}",
    ]),
    file("src/server.ts", [
      `/** ${api} */`,
      "import { createServer } from \"node:http\";",
      "import { runAgent } from \"./agent\";",
      "",
      "createServer(async (req, res) => {",
      "  if (req.method === \"POST\" && req.url === \"/api/chat\") {",
      "    const chunks: Buffer[] = [];",
      "    for await (const c of req) chunks.push(c as Buffer);",
      "    const { message } = JSON.parse(Buffer.concat(chunks).toString());",
      "    const reply = await runAgent(message);",
      "    res.writeHead(200, { \"content-type\": \"application/json\" });",
      "    res.end(JSON.stringify({ reply }));",
      "    return;",
      "  }",
      "  res.writeHead(404);",
      "  res.end();",
      `}).listen(3000, () => console.log(${JSON.stringify(api + " on :3000")}));`,
    ]),
  ];

  const nodeFiles: Record<string, string[]> = {};
  if (match.slots.model) nodeFiles[match.slots.model.id] = ["src/agent.ts"];
  if (match.slots.api) nodeFiles[match.slots.api.id] = ["src/server.ts"];
  for (const t of tools) nodeFiles[t.id] = ["src/tools.ts"];

  return {
    pattern: "agent",
    summary: `Chat agent around ${model} with ${tools.length} sketched tool(s).`,
    nextSteps: [
      "Replace tool stubs in src/tools.ts with real adapters.",
      "Add conversation memory if the sketch includes a store.",
    ],
    files,
    nodeFiles,
  };
}
