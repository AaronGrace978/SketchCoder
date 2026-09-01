# SketchCoder on Steam Deck (Desktop Mode)

1. Download **SketchCoder-Linux-x64.tar.gz** from Releases and extract to `~/SketchCoder`
2. Run `./install-linux.sh` once (adds menu shortcut)
3. Or double-click **sketchcoder** in Dolphin

## Add to Steam (non-Steam game)

1. Switch to **Desktop Mode**
2. Steam → **Add a Game** → **Add a Non-Steam Game**
3. Browse to `~/SketchCoder/sketchcoder` (or use the desktop shortcut)
4. Set name: **SketchCoder**
5. Optional: right-click → **Manage** → **Set Custom Artwork** and use `steam-hero.png` from this folder

Opens the studio at `http://127.0.0.1:3005/studio` in your default browser.

Optional vision: create `app/apps/web/.env.local` with `OPENAI_API_KEY=...`
