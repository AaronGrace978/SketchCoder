export const runtime = "nodejs";

function normalizeBaseUrl(baseUrl?: string): string {
  const raw = (baseUrl || "https://api.openai.com/v1").trim().replace(/\/$/, "");
  if (raw.endsWith("/api")) return `${raw}/v1`;
  return raw;
}

export async function POST(req: Request) {
  const body = (await req.json()) as { apiKey?: string; baseUrl?: string };
  const apiKey = body.apiKey?.trim();
  if (!apiKey) {
    return Response.json({ error: "API key required" }, { status: 400 });
  }

  const base = normalizeBaseUrl(body.baseUrl);
  const url = `${base}/models`;

  try {
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return Response.json(
        { error: text || `Model list failed (${res.status})` },
        { status: res.status }
      );
    }
    const json = (await res.json()) as { data?: { id: string }[] };
    const models = (json.data ?? []).map((m) => m.id).filter(Boolean).sort();
    return Response.json({ models });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Model list failed" },
      { status: 500 }
    );
  }
}
