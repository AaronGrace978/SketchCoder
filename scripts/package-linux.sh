#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npm run package:linux
ls -lh dist/SketchCoder-Linux* 2>/dev/null || ls -lh dist
