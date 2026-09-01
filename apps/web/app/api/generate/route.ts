import { generateScaffold } from "@sketchcoder/agent";
import { validateDoc, type SketchDoc } from "@sketchcoder/graph";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json()) as {
    doc?: unknown;
    imageDataUrl?: string;
    ocrText?: string;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
  const checked = validateDoc(body.doc);
  if (!checked.ok) {
    return Response.json({ error: checked.error }, { status: 400 });
  }
  const doc: SketchDoc = checked.doc;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        for await (const event of generateScaffold(doc, {
          apiKey: body.apiKey || process.env.OPENAI_API_KEY || undefined,
          baseUrl: body.baseUrl || process.env.OPENAI_BASE_URL,
          model: body.model || process.env.OPENAI_MODEL,
          imageDataUrl: body.imageDataUrl,
          ocrText: body.ocrText,
        })) {
          send(event);
          if (event.type === "file") await sleep(70);
          if (event.type === "pulse") await sleep(120);
          if (event.type === "read") await sleep(220);
          if (event.type === "graph") await sleep(180);
        }
      } catch (err) {
        send({
          type: "done",
          summary: err instanceof Error ? err.message : "Generate failed",
          nextSteps: [],
          pattern: "generic",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
