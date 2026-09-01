# Start Next.js then open Electron against the studio (Windows).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$env:PORT = if ($env:PORT) { $env:PORT } else { "3005" }
$env:ELECTRON_START_URL_PORT = $env:PORT

Push-Location $Root

$nodePath = "C:\Users\AGrac\AppData\Local\Programs\node-portable\node-v22.20.0-win-x64"
if (Test-Path $nodePath) {
  $env:Path = "$nodePath;$env:Path"
}

Write-Host "Starting Next.js on port $($env:PORT)..."
$dev = Start-Process -PassThru -NoNewWindow -FilePath "npm" -ArgumentList @("run", "dev") -WorkingDirectory $Root

$url = "http://127.0.0.1:$($env:PORT)"
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  try {
    $null = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    $ready = $true
    break
  } catch {
    Start-Sleep -Milliseconds 500
  }
}

if (-not $ready) {
  Write-Warning "Dev server slow to start — launching Electron anyway."
}

Write-Host "Opening Electron..."
npx --yes electron .
$exit = $LASTEXITCODE

if ($dev -and -not $dev.HasExited) {
  Stop-Process -Id $dev.Id -Force -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process -Filter "ParentProcessId=$($dev.Id)" -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

Pop-Location
exit $exit
