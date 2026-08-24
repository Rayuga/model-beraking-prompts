@echo off
setlocal
cd /d "%~dp0"
if "%PORT%"=="" set PORT=3000
if "%SEED_PATH%"=="" set SEED_PATH=%~dp0..\..\environment\assets\threadline_seed.json
npm.cmd start
