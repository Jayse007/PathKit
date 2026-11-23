@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 echo setup: Node.js was not found. Install Node.js 24 from nodejs.org, then run this again.& exit /b 1
node scripts\setup.mjs
exit /b %errorlevel%
