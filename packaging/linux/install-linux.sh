#!/bin/bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
chmod +x "$DIR/sketchcoder"
DESKTOP="$HOME/.local/share/applications/sketchcoder.desktop"
mkdir -p "$HOME/.local/share/applications"
sed "s|\$HOME/SketchCoder|$DIR|g" "$DIR/sketchcoder.desktop" > "$DESKTOP"
chmod +x "$DESKTOP"
echo "Installed menu shortcut. Launch SketchCoder from your app menu."
