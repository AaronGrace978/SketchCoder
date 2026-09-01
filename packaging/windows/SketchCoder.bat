@echo off
title SketchCoder
cd /d "%~dp0"

if exist "%~dp0SketchCoder.exe" (
  "%~dp0SketchCoder.exe"
  exit /b %ERRORLEVEL%
)

echo.
echo  SketchCoder.exe was not found in this folder.
echo  Make sure you extracted the full zip, or run from the install directory.
echo.
pause
exit /b 1
