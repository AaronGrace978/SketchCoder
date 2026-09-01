# Build installable SketchCoder Electron package for the current platform.
param(
  [ValidateSet("all", "windows", "macos", "linux")]
  [string]$Platform = "windows"
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Push-Location $Root

switch ($Platform) {
  "windows" { npm run package:windows }
  "macos" { npm run package:macos }
  "linux" { npm run package:linux }
  "all" {
    Write-Host "Electron builds are OS-native. Building Windows on this machine."
    Write-Host "macOS/Linux artifacts are produced by GitHub Actions on tag push."
    npm run package:windows
  }
}

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Pop-Location
Get-ChildItem (Join-Path $Root "dist") -File -ErrorAction SilentlyContinue |
  ForEach-Object { Write-Host "  $($_.FullName)" }
