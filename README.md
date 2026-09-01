# SketchCoder

<img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/95775a77-35ad-4b3a-b9ed-6c582bd5d18c" />

Draw Projects Like a Boss.

Sketch systems with your mouse — or spell a word like **RAG** — and the agent screenshots the board and writes the scaffolding.

**Desktop product:** SketchCoder ships as a native **Electron** app (Windows, macOS, Linux).

## Quick start (dev)

```bash
npm install
npm run electron:dev   # Electron window + Next.js studio
# or browser-only:
npm run dev            # http://localhost:3005/studio
```

Optional vision — open **Settings** in the studio and add an Ollama Cloud or OpenAI key, or put keys in `apps/web/.env.local`:

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

Ctrl+Z undoes a Generate board replace.

```bash
npm run verify   # offline smoke tests for scaffold paths
```

## Monorepo

| Path | Role |
| --- | --- |
| `electron/` | Electron main process (desktop shell) |
| `apps/web` | Next.js landing + studio canvas |
| `packages/graph` | Sketch document model + pattern demos |
| `packages/templates` | RAG / CRUD / agent / webhook scaffolds |
| `packages/agent` | Generate stream + vision prompt |

## Scripts

```bash
npm run electron:dev     # desktop app in development
npm run package:windows  # Windows installer + zip
npm run package:macos    # macOS dmg/zip (run on macOS)
npm run package:linux    # Linux AppImage + tar.gz (run on Linux)
npm run verify
```

## Download (installable builds)

Get the latest from **[Releases](https://github.com/AaronGrace978/SketchCoder/releases)**.

| Platform | Download | Run |
| --- | --- | --- |
| **Windows x64** | `SketchCoder-Windows-x64.exe` or `.zip` | Installer, or unzip and run **SketchCoder.exe** |
| **macOS** | `SketchCoder-macOS-arm64` / `x64` (`.dmg` or `.zip`) | Open the app |
| **Linux / Steam Deck** | `.AppImage` or `.tar.gz` | Run AppImage, or extract and launch |

Studio opens inside the Electron window. No separate browser or Node install required for release builds.

### Windows

1. Download the installer or portable zip
2. Run **SketchCoder**

### macOS

1. Download the zip/dmg for your chip (arm64 = Apple Silicon, x64 = Intel)
2. Open **SketchCoder**
3. If Gatekeeper blocks it: right-click → Open → Open

### Linux / Steam Deck

1. Download the AppImage or tar.gz
2. For Steam Deck tips see `packaging/linux/STEAMDECK.md`

Build yourself: `npm run package:windows` (Windows) / `package:macos` / `package:linux` on the matching OS.
