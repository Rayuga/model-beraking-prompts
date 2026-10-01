# Fairness repair browser evidence

This copy retains the 30 September fairness protocols and adds the independent S22 example-inventory outcome, for 65 Functional facts in the full workflow. Use [the current commands](RESTART_COVERAGE.md) for this driver generation. The commands below describe its historical fairness-fix2 base. Historical drivers/reports and the canonical helper are unchanged. These workflows measure scripted browser behavior only; they cannot establish a provider judgment, Oracle score, full judge duration, reward distribution, or portal acceptance.

`current_flow.cjs` measures S16 using a successful Run that schedules its own 4000 ms timer. S02's later button click supplies no duration evidence. `fairness_flow.cjs` supplies S03 and S24 to both the full golden and focused runner. A failed delayed interaction leaves its own failure visible while a live current or fresh immediate handler can establish the independent Stop control. If HTML dispatch cannot establish the initial fixture, the exact frozen equivalent JS fixture is attempted once. Padded-title failures retain the trimming failure while ordinary successful creation/update can supply current identity, revision and request shape to the independent collision/empty checks. Negative outcomes require actual matching successful controls.

`prepare_fairness_variants.cjs` copies the hash-bound frozen app into isolated variant folders and records each mutation and output hash. Runtime variants rebuild offline with the existing pinned Vite 7.1.7 toolchain. The app imports its existing bundled local vendor module, so no install or node_modules symlink is needed. The served app sources and rebuilt bundle are preserved together.

`fairness_probe.cjs` runs the focused browser scenarios. `launch_fairness.py` launches each copied app in a fresh disposable database as UID/GID 65534, records exact app/driver hashes, runs the probe through the pinned local Playwright dependency, and stops its own process group. It never modifies or invokes the canonical restart helper.

| Case | Required observed distinction |
|---|---|
| golden | S16 duration, S03 delayed interaction/Stop, all four S24 facts pass |
| run-duration-only | Original completed Run duration stays short after S02's actual four-second click timer; new S16 Run-duration comparison passes |
| padded-create-refused | Trimming fails; collision, empty-title and case-sensitive checks pass after ordinary creation fallback |
| padded-update-refused | Trimming fails; collision, empty-title and case-sensitive checks pass after ordinary update fallback |
| padded-both-refused | Trimming fails; both ordinary fallbacks establish the independent refusal controls |
| long-idle-handlers | Delayed interaction fails; fresh immediate handler followed promptly by Stop/recovery passes |
| broken-html-dispatch | Initial HTML fixture visibly fails; actual equivalent JS fixture establishes delayed interactions and Stop |
| never-working-handlers | Delayed interaction and Stop both fail, even though stopped-marker silence and recovery are observed |
| dead-writer | All S24 facts fail; rejection/unchanged state never substitute for successful writes |
| constant-zero-duration | The timer actually completes, but a constant duration fails S16 |

Prepare once from the repository root, after the named source freeze exists:

```powershell
& C:/Users/00518507/AppData/Local/Programs/Python/Python312/python.exe qc/repairs/coldwater-2026-09-30-fairness/prepare_golden.py coldwater-2026-09-30-fairness-fix2
node qc/repairs/coldwater-2026-09-30-fairness/drivers/prepare_fairness_variants.cjs coldwater-2026-09-30-fairness-fix2
```

Do not repeat preparation over existing evidence. If preparation or execution fails, preserve the failed artifacts and diagnose the recorded error. Source changes require a new frozen run. Driver corrections require new preserved execution copies and an explicit explanation, rather than overwriting prior logs.

Run the complete golden in one disposable offline container, with no published ports:

```powershell
$fairnessTask = (Resolve-Path .qc-cache/coldwater-2026-09-30-fairness-fix2/task).Path
$fairnessEvidence = (Resolve-Path qc/runs/coldwater-2026-09-30-fairness-fix2/golden).Path
docker run --rm --network none --shm-size 1g --mount "type=bind,source=$fairnessTask,target=/task,readonly" --mount "type=bind,source=$fairnessEvidence,target=/evidence" -e CW_MANIFEST=frozen_repair_inputs.json colderwater-verifier:postrepair-audit-20260930 python3 /evidence/drivers/launch_workflow.py
```

Run the ten focused cases in a separate disposable offline container:

```powershell
docker run --rm --network none --shm-size 1g --mount "type=bind,source=$fairnessTask,target=/task,readonly" --mount "type=bind,source=$fairnessEvidence,target=/evidence" colderwater-verifier:postrepair-audit-20260930 python3 /evidence/drivers/launch_fairness.py
```

For diagnostic execution of one case, add `-e CW_CASE=<case-name>` before the image. Both launchers create timestamped output folders with raw actions, requests, expected/observed facts, hashes and process logs. The boolean `passed` in the focused summary means the explicit expected fact vector matched actual browser observations, including expected failures. It is not an app grade. Local Node/Python parser checks establish syntax only.
