@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-gpu.ps1"
set "APOLLO_SETUP_EXIT=%ERRORLEVEL%"
echo.
if not "%APOLLO_SETUP_EXIT%"=="0" echo Installation did not complete. Keep the error above for diagnosis.
pause
exit /b %APOLLO_SETUP_EXIT%
