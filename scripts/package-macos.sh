#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npm run package:macos
ls -lh dist/SketchCoder-macOS* 2>/dev/null || ls -lh dist
