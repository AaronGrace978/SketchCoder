# Windows-only packaging for CI and local release builds.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot "package-all.ps1") -Platform windows
