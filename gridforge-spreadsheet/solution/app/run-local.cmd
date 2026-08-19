@echo off
setlocal
set PORT=3000
set BASE_URL=http://localhost:3000
set RESET_SEED=1
set APP=%~dp0
set NODE=%APP%..\..\..\.tools\node-v22.23.2-win-x64\node.exe
set NPM=%APP%..\..\..\.tools\node-v22.23.2-win-x64\npm.cmd
cd /d "%APP%"
echo Starting GridForge browser app on http://127.0.0.1:3000/
echo Keep this window open while testing.
if not exist "node_modules\express\package.json" (
  echo Installing dependencies for local testing...
  if exist "%NPM%" (
    call "%NPM%" install --omit=dev --no-audit --no-fund
  ) else (
    call npm install --omit=dev --no-audit --no-fund
  )
)
if exist "%NODE%" (
  "%NODE%" --experimental-sqlite src/index.js
) else (
  node --experimental-sqlite src/index.js
)
echo.
echo GridForge stopped. If this was unexpected, copy the error above.
pause
