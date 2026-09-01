@echo off
title SketchCoder
cd /d "%~dp0"

if exist "dist\SketchCoder-Windows-x64\SketchCoder.exe" (
  cd dist\SketchCoder-Windows-x64
  call SketchCoder.bat
  exit /b %ERRORLEVEL%
)

if exist "SketchCoder.exe" (
  call SketchCoder.bat
  exit /b %ERRORLEVEL%
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js not found. Install Node or download the Windows release zip.
  pause
  exit /b 1
)

echo Starting SketchCoder dev server...
npm run dev
exit /b %ERRORLEVEL%
