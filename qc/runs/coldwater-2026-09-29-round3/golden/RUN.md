# Fresh Round 3 scripted golden verification

Executed from `F:\Documents\turing-workspace\model-beraking-prompts` on 2026-09-29:

```powershell
docker run --rm --name coldwater-qc-round3-reviewer3 --network none --mount 'type=bind,source=F:/Documents/turing-workspace/model-beraking-prompts/.qc-cache/coldwater-2026-09-29-round3/task,target=/task,readonly' --mount 'type=bind,source=F:/Documents/turing-workspace/model-beraking-prompts/qc/runs/coldwater-2026-09-29-round3/golden,target=/evidence' -e CW_CASE=golden -e CW_MANIFEST=frozen_round3_inputs.json colderwater-verifier:20260927-structural python3 /evidence/drivers/launch_workflow.py
```

`docker image inspect colderwater-verifier:20260927-structural --format '{{.Id}}'` returned `sha256:4c96ab17508d744cbaa41bba896ea15798092536664db85a6d8b6e48783bc535`.

No published ports; Docker network `none`. `/task` was read-only and `/evidence` writable. The app was copied into a new container-local `/tmp/cw-structural-workflow/app`, with a fresh database at `app/app.db`, and started as UID/GID 65534 with sanitized environment. The container was removed on exit. No workspace database or frozen task file was mutated.

[RESULTS.json](run-golden-20260929-064533/RESULTS.json) records successful completion: 58 fresh outcome facts, zero missing/failed/reused facts, all 26 phase observations passed. [actual-restart.json](run-golden-20260929-064533/actual-restart.json) records exactly one actual process restart via the frozen restart MCP and helper extracted from frozen test.sh. Elapsed wall time was 96.916598673 seconds (pre 5.960082703; post 84.986229873). This is scripted Playwright time, not LLM judge duration.

[frozen_round3_inputs.json](frozen_round3_inputs.json) binds the current functional rubric/prompt, app context, restart sources and all 23 solution files to input `e44eb4441cce58fef6401ac7e41a19f572585beb0880b142b5ca580041e9f5a7`. It contains 58 outcomes and 23 protocols. RESULTS records manifest, criterion, actual app and copied-driver hashes. The executed drivers are preserved inside the run directory. The copied runtime driver establishes S04's exact four-second positive control before its cancellation trials. The copied S22 driver emits durability immediately after readback, before the later write, then emits write success after fresh readback; a missing/unusable old Primary has a bounded fresh-record fallback. This run did not need that fallback.

The copied drivers/README.md and unused prepare_inputs.cjs retain historical qualifications; their old inventory is not this run's inventory. `prepare_round3.py` generated the new manifest and copied/updated the runtime driver; library_flow.cjs was then patched for S22 before execution. Only the linked current run establishes the 58 fresh observations.

A separate tooling smoke was executed:

```powershell
docker run --rm --network none --mount 'type=bind,source=F:/Documents/turing-workspace/model-beraking-prompts/qc/runs/coldwater-2026-09-29-round3/golden,target=/evidence' colderwater-verifier:20260927-structural python3 /evidence/tooling_smoke.py
```

[tooling-smoke.json](tooling-smoke.json) records the actual configured Playwright MCP initialize/list/call exchange, independent browser context and locally fulfilled HTTPS route. Its copied client's cosmetic `round2-qc` name/probe hostname are unchanged; this log is from the fresh Round 3 command above. No provider or app score was involved.

These results are reproducible local source/tooling/reference evidence, not an Oracle score or full RewardKit/provider grading run. No paid call was made. Production workload, weak/partial reward discrimination and empirical reward ordering remain unmeasured.
