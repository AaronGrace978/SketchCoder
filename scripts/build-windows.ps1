# Build SketchCoder Windows Electron release
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Push-Location $Root
npm run package:windows
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Pop-Location
Write-Host ""
Write-Host "Done. See dist/ for SketchCoder-Windows-*"
