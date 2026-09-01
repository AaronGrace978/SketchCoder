#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/apps/web"
DIST="$ROOT/dist"
PKG_VERSION="6.6.0"
ICON="$ROOT/packaging/icons/icon-512.png"

stage_app() {
  local target="$1"
  local standalone="$WEB/.next/standalone"
  if [[ ! -d "$standalone" ]]; then
    echo "Standalone build missing at $standalone" >&2
    exit 1
  fi
  rm -rf "$target"
  mkdir -p "$target"
  cp -a "$standalone/." "$target/"
  mkdir -p "$target/apps/web/.next"
  cp -a "$WEB/.next/static/." "$target/apps/web/.next/static/"
  if [[ -d "$WEB/public" ]]; then
    mkdir -p "$target/apps/web"
    cp -a "$WEB/public" "$target/apps/web/public"
  fi
}

write_readme() {
  local dir="$1"
  cat >"$dir/README.txt" <<'EOF'
SketchCoder - installable build

Run the launcher in this folder. Studio opens at http://127.0.0.1:3005/studio

Optional vision (handwriting): create app/apps/web/.env.local with:
  OPENAI_API_KEY=sk-...
  OPENAI_MODEL=gpt-4o-mini
EOF
}

pkg_launcher() {
  local target="$1"
  local out="$2"
  npx --yes "@yao-pkg/pkg@${PKG_VERSION}" "$ROOT/scripts/launcher.cjs" \
    --targets "$target" \
    --output "$out" \
    --compress GZip
}

npm ci
npm run build

mkdir -p "$DIST"

LIN="$DIST/SketchCoder-Linux-x64"
stage_app "$LIN/app"
write_readme "$LIN"
pkg_launcher "node20-linux-x64" "$LIN/sketchcoder"
chmod +x "$LIN/sketchcoder"

if [[ -f "$ICON" ]]; then
  cp "$ICON" "$LIN/icon-512.png"
fi
cp "$ROOT/packaging/linux/STEAMDECK.md" "$LIN/STEAMDECK.md"
if [[ -f "$ROOT/packaging/icons/steam-hero.png" ]]; then
  cp "$ROOT/packaging/icons/steam-hero.png" "$LIN/steam-hero.png"
fi

sed \
  -e 's|PLACEHOLDER_BIN|$HOME/SketchCoder/sketchcoder|g' \
  -e 's|PLACEHOLDER_ICON|$HOME/SketchCoder/icon-512.png|g' \
  "$ROOT/packaging/linux/sketchcoder.desktop" >"$LIN/sketchcoder.desktop"
cp "$ROOT/packaging/linux/install-linux.sh" "$LIN/install-linux.sh"
chmod +x "$LIN/install-linux.sh"

(cd "$DIST" && tar -czf "SketchCoder-Linux-x64.tar.gz" "SketchCoder-Linux-x64")
ls -lh "$DIST"/*.tar.gz
