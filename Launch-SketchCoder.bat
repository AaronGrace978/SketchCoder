@echo off
title SketchCoder
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  if exist "%LOCALAPPDATA%\Programs\node-portable\node-v22.20.0-win-x64\node.exe" (
    set "PATH=%LOCALAPPDATA%\Programs\node-portable\node-v22.20.0-win-x64;%PATH%"
  )
)

if exist "node_modules\electron\dist\electron.exe" (
  echo Starting SketchCoder Electron...
  call npx electron .
  exit /b %ERRORLEVEL%
)

if exist "dist\win-unpacked\SketchCoder.exe" (
  start "" "dist\win-unpacked\SketchCoder.exe"
  exit /b 0
)

echo Install deps first: npm install
echo Then run: npm run electron:dev
pause
exit /b 1
