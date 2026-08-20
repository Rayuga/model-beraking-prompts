# PatchPad Model Run b7a904c5

This is a cleaned copy of the model-created PatchPad app and verifier evidence from `job-b7a904c5`.

Raw agent traces, completions, logs, SQLite databases, and `.jwt_secret` were intentionally not committed.

## Run Locally

The generated app hardcodes `/assets/incident_seed.json`. On Windows, create `C:\assets\incident_seed.json` from `patchpad-editor/environment/assets/incident_seed.json` before starting.

```powershell
New-Item -ItemType Directory -Force -Path C:\assets | Out-Null
Copy-Item patchpad-editor\environment\assets\incident_seed.json C:\assets\incident_seed.json -Force
cd model-runs\patchpad-editor-b7a904c5\app
$env:PORT = "3001"
npm.cmd start
```

Open `http://localhost:3001`.

## Run Result

- Task: `webdev/patchpad-editor`
- Trial: `task__AGHJ6TP`
- Model: `openrouter/openai/gpt-5.6-sol`
- Reward: `0.7097`
- Browser score: `0.71`
