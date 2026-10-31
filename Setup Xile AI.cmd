@echo off
rem Installs Xile AI's parts and puts the "Xile AI" icon on the desktop. Safe to run again.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup.ps1"
echo.
pause
