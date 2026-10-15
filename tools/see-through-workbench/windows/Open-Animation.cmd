@echo off
setlocal
if exist "%~dp0..\.venv\Scripts\python.exe" (
  "%~dp0..\.venv\Scripts\python.exe" "%~dp0serve-viewer.py"
) else (
  py -3.12 "%~dp0serve-viewer.py"
)
if errorlevel 1 pause
