@echo off
if "%~1"=="" (
  echo Drag a character PNG or JPG onto this file.
  pause
  exit /b 2
)
"%~dp0..\.venv\Scripts\python.exe" "%~dp0..\infer.py" "%~1"
set "APOLLO_INFER_EXIT=%ERRORLEVEL%"
echo.
if not "%APOLLO_INFER_EXIT%"=="0" echo Inference did not complete. Keep the error above for diagnosis.
pause
exit /b %APOLLO_INFER_EXIT%
