# Build SketchCoder Windows release (SketchCoder.exe + app folder)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Dist = Join-Path $Root "dist\SketchCoder-Windows"
$App = Join-Path $Dist "app"
$Web = Join-Path $Root "apps\web"

Write-Host "Building Next.js standalone..."
Push-Location $Root
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Pop-Location

Write-Host "Staging Windows app folder..."
if (Test-Path $Dist) { Remove-Item -Recurse -Force $Dist }
New-Item -ItemType Directory -Force -Path $App | Out-Null

$Standalone = Join-Path $Web ".next\standalone"
if (-not (Test-Path $Standalone)) {
  Write-Error "Standalone build missing. Run npm run build first."
}

Copy-Item -Recurse -Force (Join-Path $Standalone "*") $App
New-Item -ItemType Directory -Force -Path (Join-Path $App "apps\web\.next") | Out-Null
Copy-Item -Recurse -Force (Join-Path $Web ".next\static") (Join-Path $App "apps\web\.next\static")
if (Test-Path (Join-Path $Web "public")) {
  Copy-Item -Recurse -Force (Join-Path $Web "public") (Join-Path $App "apps\web\public")
}

# Optional env template beside exe
@"
# Rename to .env and place in the app folder (apps\web\.env.local) for vision:
# OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o-mini
"@ | Set-Content -Encoding UTF8 (Join-Path $Dist "OPENAI-KEY-README.txt")

Write-Host "Packaging SketchCoder.exe..."
Push-Location $Root
npx --yes @yao-pkg/pkg@6.6.0 scripts/launcher.cjs `
  --targets node20-win-x64 `
  --output (Join-Path $Dist "SketchCoder.exe") `
  --compress GZip
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Pop-Location

$Zip = Join-Path $Root "dist\SketchCoder-Windows-x64.zip"
if (Test-Path $Zip) { Remove-Item -Force $Zip }
Compress-Archive -Path (Join-Path $Dist "*") -DestinationPath $Zip -Force

Write-Host ""
Write-Host "Done:"
Write-Host "  $Dist\SketchCoder.exe"
Write-Host "  $Zip"
Write-Host ""
