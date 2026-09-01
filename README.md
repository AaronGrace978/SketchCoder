# SketchCoder

<img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/95775a77-35ad-4b3a-b9ed-6c582bd5d18c" />

Draw Projects Like a Boss.

Sketch systems with your mouse — or spell a word like **RAG** — and the agent screenshots the board and writes the scaffolding.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or the port Next prints). Studio lives at `/studio`.

Optional vision reading of handwriting — add `apps/web/.env.local`:

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

Without a key, Generate still works from the graph, OCR/heuristics, and pattern templates.

## What it does

1. **Pen** — write `RAG`, `CRUD`, `AGENT`, or freehand a diagram
2. **Generate** — captures a full-board screenshot and reads the ink
3. **Scaffold** — expands into a system graph and streams runnable files (zip export included)

### Solid draw → build paths

| You do | What happens |
| --- | --- |
| Write **RAG** with the pen, Generate | OCR/word detect → full RAG graph → zip with file-backed index |
| Load RAG demo, Generate | Streams the citation pipeline scaffold |
| Draw Client → API → Store | Matches CRUD (or your typed nodes) and scaffolds |
| Intent field says “production RAG…” | Same expansion without handwriting |

Ctrl+Z undoes a Generate board replace. Optional vision: set `OPENAI_API_KEY` in `apps/web/.env.local`.

```bash
npm run verify   # offline smoke tests for scaffold paths
```

## Monorepo

| Path | Role |
| --- | --- |
| `apps/web` | Next.js landing + studio canvas |
| `packages/graph` | Sketch document model + pattern demos |
| `packages/templates` | RAG / CRUD / agent / webhook scaffolds |
| `packages/agent` | Generate stream + vision prompt |

## Scripts

```bash
npm run dev    # studio + landing
npm run build  # production build
```
