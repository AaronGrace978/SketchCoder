# Build installable SketchCoder packages for Windows, macOS, and Linux.
param(
  [ValidateSet("all", "windows", "macos", "linux")]
  [string]$Platform = "all"
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Web = Join-Path $Root "apps\web"
$DistRoot = Join-Path $Root "dist"
$PkgVersion = "6.6.0"

function Stage-App($TargetApp) {
  $Standalone = Join-Path $Web ".next\standalone"
  if (-not (Test-Path $Standalone)) {
    throw "Standalone build missing at $Standalone"
  }
  if (Test-Path $TargetApp) { Remove-Item -Recurse -Force $TargetApp }
  New-Item -ItemType Directory -Force -Path $TargetApp | Out-Null
  Copy-Item -Recurse -Force (Join-Path $Standalone "*") $TargetApp
  New-Item -ItemType Directory -Force -Path (Join-Path $TargetApp "apps\web\.next") | Out-Null
  Copy-Item -Recurse -Force (Join-Path $Web ".next\static") (Join-Path $TargetApp "apps\web\.next\static")
  if (Test-Path (Join-Path $Web "public")) {
    Copy-Item -Recurse -Force (Join-Path $Web "public") (Join-Path $TargetApp "apps\web\public")
  }
}

function Write-Readme($Dir) {
  @"
SketchCoder - installable build

Run the launcher in this folder. Studio opens at http://127.0.0.1:3005/studio

Optional vision (handwriting): create app/apps/web/.env.local with:
  OPENAI_API_KEY=sk-...
  OPENAI_MODEL=gpt-4o-mini
"@ | Set-Content -Encoding UTF8 (Join-Path $Dir "README.txt")
}

function Pkg-Launcher($Target, $OutPath) {
  npx --yes "@yao-pkg/pkg@$PkgVersion" scripts/launcher.cjs `
    --targets $Target `
    --output $OutPath `
    --compress GZip
  if ($LASTEXITCODE -ne 0) {
  if ($Platform -eq "all") {
    Write-Warning "pkg failed for $Target (cross-compile may be unavailable on this OS). Skipping."
    return $false
  }
  throw "pkg failed for $Target"
  }
  return $true
}

Write-Host "=== Building Next.js standalone ==="
Push-Location $Root
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Pop-Location

if (Test-Path $DistRoot) { Remove-Item -Recurse -Force $DistRoot }
New-Item -ItemType Directory -Force -Path $DistRoot | Out-Null

$iconSrc = Join-Path $Root "packaging\icons\icon-512.png"
if (-not (Test-Path $iconSrc)) {
  $fallback = Join-Path $Root "assets\sketchcoder-v0.1-cover.png"
  if (Test-Path $fallback) { Copy-Item $fallback $iconSrc }
}

# --- Windows x64 ---
if ($Platform -in @("all", "windows")) {
Write-Host "=== Windows x64 ==="
$WinDir = Join-Path $DistRoot "SketchCoder-Windows-x64"
$WinApp = Join-Path $WinDir "app"
Stage-App $WinApp
Write-Readme $WinDir
Pkg-Launcher "node20-win-x64" (Join-Path $WinDir "SketchCoder.exe")
Copy-Item (Join-Path $Root "packaging\windows\SketchCoder.bat") (Join-Path $WinDir "SketchCoder.bat")
$WinZip = Join-Path $DistRoot "SketchCoder-Windows-x64.zip"
Compress-Archive -Path (Join-Path $WinDir "*") -DestinationPath $WinZip -Force

# Inno Setup installer (if available)
$Iss = Join-Path $Root "packaging\windows\installer.iss"
$Iscc = @(
  "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
  "${env:ProgramFiles}\Inno Setup 6\ISCC.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($Iscc -and (Test-Path $Iss)) {
  Write-Host "=== Windows Setup.exe (Inno Setup) ==="
  & $Iscc $Iss
  if ($LASTEXITCODE -ne 0) { Write-Warning "Inno Setup failed; zip still available." }
} else {
  Write-Host "Inno Setup not found - shipping zip + portable exe only."
  Copy-Item (Join-Path $Root "packaging\windows\Install.bat") (Join-Path $WinDir "Install.bat")
}

}

# --- macOS arm64 ---
if ($Platform -in @("all", "macos")) {
Write-Host "=== macOS arm64 ==="
$MacArmDir = Join-Path $DistRoot "SketchCoder-macOS-arm64"
$MacArmApp = Join-Path $MacArmDir "app"
Stage-App $MacArmApp
Write-Readme $MacArmDir
Pkg-Launcher "node20-macos-arm64" (Join-Path $MacArmDir "SketchCoder") | Out-Null
if (Test-Path (Join-Path $MacArmDir "SketchCoder")) {
$AppBundle = Join-Path $MacArmDir "SketchCoder.app"
New-Item -ItemType Directory -Force -Path (Join-Path $AppBundle "Contents\MacOS") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $AppBundle "Contents\Resources") | Out-Null
Copy-Item (Join-Path $MacArmDir "SketchCoder") (Join-Path $AppBundle "Contents\MacOS\SketchCoder")
Copy-Item (Join-Path $Root "packaging\macos\Info.plist") (Join-Path $AppBundle "Contents\Info.plist")
Copy-Item -Recurse -Force $MacArmApp (Join-Path $AppBundle "Contents\Resources\app")
if (Test-Path $iconSrc) {
  Copy-Item $iconSrc (Join-Path $AppBundle "Contents\Resources\icon.png")
}
$MacArmZip = Join-Path $DistRoot "SketchCoder-macOS-arm64.zip"
Compress-Archive -Path (Join-Path $MacArmDir "*") -DestinationPath $MacArmZip -Force
}

}

# --- macOS x64 ---
if ($Platform -in @("all", "macos")) {
Write-Host "=== macOS x64 ==="
$MacXDir = Join-Path $DistRoot "SketchCoder-macOS-x64"
$MacXApp = Join-Path $MacXDir "app"
Stage-App $MacXApp
Write-Readme $MacXDir
Pkg-Launcher "node20-macos-x64" (Join-Path $MacXDir "SketchCoder") | Out-Null
if (Test-Path (Join-Path $MacXDir "SketchCoder")) {
$MacXZip = Join-Path $DistRoot "SketchCoder-macOS-x64.zip"
Compress-Archive -Path (Join-Path $MacXDir "*") -DestinationPath $MacXZip -Force
}
}

# --- Linux x64 (Steam Deck / desktop) ---
if ($Platform -in @("all", "linux")) {
Write-Host "=== Linux x64 ==="
$LinDir = Join-Path $DistRoot "SketchCoder-Linux-x64"
$LinApp = Join-Path $LinDir "app"
Stage-App $LinApp
Write-Readme $LinDir
Pkg-Launcher "node20-linux-x64" (Join-Path $LinDir "sketchcoder") | Out-Null
if (Test-Path (Join-Path $LinDir "sketchcoder")) {
if (Test-Path $iconSrc) { Copy-Item $iconSrc (Join-Path $LinDir "icon-512.png") }
Copy-Item (Join-Path $Root "packaging\linux\STEAMDECK.md") (Join-Path $LinDir "STEAMDECK.md")
$hero = Join-Path $Root "packaging\icons\steam-hero.png"
if (Test-Path $hero) { Copy-Item $hero (Join-Path $LinDir "steam-hero.png") }
$desktop = Get-Content (Join-Path $Root "packaging\linux\sketchcoder.desktop") -Raw
$desktop = $desktop.Replace("PLACEHOLDER_BIN", "`$HOME/SketchCoder/sketchcoder")
$desktop = $desktop.Replace("PLACEHOLDER_ICON", "`$HOME/SketchCoder/icon-512.png")
$desktop | Set-Content -Encoding UTF8 (Join-Path $LinDir "sketchcoder.desktop")
Copy-Item (Join-Path $Root "packaging\linux\install-linux.sh") (Join-Path $LinDir "install-linux.sh")
if (Get-Command tar -ErrorAction SilentlyContinue) {
  Push-Location $DistRoot
  tar -czf "SketchCoder-Linux-x64.tar.gz" "SketchCoder-Linux-x64"
  Pop-Location
} else {
  $LinZip = Join-Path $DistRoot "SketchCoder-Linux-x64.zip"
  Compress-Archive -Path (Join-Path $LinDir "*") -DestinationPath $LinZip -Force
}
}
}

Write-Host ""
Write-Host "=== Done ==="
Get-ChildItem $DistRoot -File | ForEach-Object { Write-Host "  $($_.FullName)" }
Write-Host ""
