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

# macOS arm64
MAC_ARM="$DIST/SketchCoder-macOS-arm64"
stage_app "$MAC_ARM/app"
write_readme "$MAC_ARM"
pkg_launcher "node20-macos-arm64" "$MAC_ARM/SketchCoder"
chmod +x "$MAC_ARM/SketchCoder"

APP_BUNDLE="$MAC_ARM/SketchCoder.app"
mkdir -p "$APP_BUNDLE/Contents/MacOS" "$APP_BUNDLE/Contents/Resources"
cp "$MAC_ARM/SketchCoder" "$APP_BUNDLE/Contents/MacOS/SketchCoder"
cp "$ROOT/packaging/macos/Info.plist" "$APP_BUNDLE/Contents/Info.plist"
cp -a "$MAC_ARM/app" "$APP_BUNDLE/Contents/Resources/app"
if [[ -f "$ICON" ]]; then
  cp "$ICON" "$APP_BUNDLE/Contents/Resources/icon.png"
fi

(cd "$DIST" && zip -r -q "SketchCoder-macOS-arm64.zip" "SketchCoder-macOS-arm64")

# macOS x64
MAC_X="$DIST/SketchCoder-macOS-x64"
stage_app "$MAC_X/app"
write_readme "$MAC_X"
pkg_launcher "node20-macos-x64" "$MAC_X/SketchCoder"
chmod +x "$MAC_X/SketchCoder"
(cd "$DIST" && zip -r -q "SketchCoder-macOS-x64.zip" "SketchCoder-macOS-x64")

ls -lh "$DIST"/*.zip
