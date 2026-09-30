# Round 2 scripted golden verification

Executed from `F:\Documents\turing-workspace\model-beraking-prompts` on 29 September 2026, using this exact PowerShell command:

```powershell
docker run --rm --name coldwater-qc-round2-reviewer3 --network none --mount 'type=bind,source=F:/Documents/turing-workspace/model-beraking-prompts/.qc-cache/coldwater-2026-09-29-round2/task,target=/task,readonly' --mount 'type=bind,source=F:/Documents/turing-workspace/model-beraking-prompts/qc/runs/coldwater-2026-09-29-round2/golden,target=/evidence' -e CW_CASE=golden -e CW_MANIFEST=frozen_round2_inputs.json colderwater-verifier:20260927-structural python3 /evidence/drivers/launch_workflow.py
```

Local image ID, observed using `docker image inspect colderwater-verifier:20260927-structural --format '{{.Id}}'`:

`sha256:4c96ab17508d744cbaa41bba896ea15798092536664db85a6d8b6e48783bc535`

No host ports were published. Container networking was disabled; browser and app communicated over container-local port 3000. `/task` was read-only. Only this `golden` directory was mounted writable at `/evidence`. The launcher copied the frozen app into a disposable `/tmp/cw-structural-workflow/app`, with a fresh SQLite database. It launched the app as UID/GID 65534 with sanitized PATH, NODE_PATH, HOME, DB_PATH and PORT. The container was removed after completion. No paid provider or platform was invoked.

The new manifest `frozen_round2_inputs.json` binds 57 outcomes, 23 protocols and 23 solution files to round input hash `f7258ff3b83e02bd781bc1d4ed013f8b125d0a31cf246ef3b6193a3410020fe2`. It was generated from this round's TOML and prompt, bypassing the historical driver's stale 37-scenario assertion. Manifest SHA256 is `aced3a109ddd9efded5ac526d9df9ad946cd0bd3f590cac377e3a5aca82afb84`.

The copied runtime driver adds the required S04 uncancelled four-second callback control and records baseline marker counts before supersede/Stop. It also supplements S02 fresh-global evidence with the actual S04 A assignment and B output. Historical driver files outside this directory were not edited.

Results: [run-golden-20260929-063444/RESULTS.json](run-golden-20260929-063444/RESULTS.json), with raw [pre-results.json](run-golden-20260929-063444/pre-results.json), [post-results.json](run-golden-20260929-063444/post-results.json) and [actual-restart.json](run-golden-20260929-063444/actual-restart.json). All 57 fresh fact keys passed, with no missing or failed keys; all 26 phase observations passed. Exactly one canonical restart call changed the app PID from 16 to 336. S04's positive callback completed in 4001.7 ms; its delayed marker count remained 1 after the supersede trial. Actual Chromium was Google Chrome for Testing 152.0.7977.8 and MCP was 0.0.79.

The 97.203-second wall duration measures this scripted reference run. It is not production LLM judge duration, reward discrimination evidence, an Oracle score, or full verifier/provider completion evidence. The inherited `drivers/README.md` describes preparation before the historical freeze; this file and the named raw results document which current 57 facts were subsequently exercised. No historical qualification is removed.
