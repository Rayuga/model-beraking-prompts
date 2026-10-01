# Final coverage repair browser evidence

The complete workflow preserves the fairness-fix2 protocols and adds `S22.restart_example_inventory`: 65 Functional facts, 2 gates, 7 Polish observations and 11 runtime compatibility regressions. These are scripted observations, not configured judge results, an Oracle score or portal clearance.

`restart_examples.cjs` reads the entire rendered built-in picker before and after S22's existing single restart. It excludes placeholders and saved records, compares names/exposed filenames with multiplicities, and ignores order. A real choice first loads editable source into a deliberately different draft as its successful control. This does not execute the example. Inventory failures are recorded separately before saved-library readbacks and the later write control.

`restart_mutations.py` changes only disposable app copies. The duplicate variant has unchanged first-start behavior; at the second startup it serves the same bundle with the built-in array repeated twice. SQL records, example source and handlers stay unchanged. The reverse-independence variant removes only the dedicated Primary saved fixture at second boot. Each run preserves the exact mutated server and hashes.

| Focused case | Example inventory | Saved durability | Subsequent writing |
|---|---|---|---|
| restart-inventory-control | Pass | Pass | Pass |
| restart-example-duplicates | Fail | Pass | Pass |
| restart-record-corruption | Pass | Fail | Pass using the existing fresh-record fallback |

`launch_restart_matrix.py` uses separate disposable databases/process groups. Each invokes the unchanged canonical MCP restart tool once and preserves requests/replies, old/new PIDs and before/after evidence. `passed` means the explicit expected vector matched; an expected mutation failure stays visible in the facts.

Prepare once from the repository root after the named source freeze exists:

```powershell
& C:/Users/00518507/AppData/Local/Programs/Python/Python312/python.exe qc/repairs/coldwater-2026-09-30-final-fixes/prepare_golden.py coldwater-2026-09-30-coverage-repair
node qc/repairs/coldwater-2026-09-30-final-fixes/drivers/prepare_fairness_variants.cjs coldwater-2026-09-30-coverage-repair
```

The preparer refuses an existing output directory. Preserve executed logs; new task bytes need a new source freeze. Corrected drivers need a preserved new execution copy and an explanation.

Use the cached verifier image without network or published ports:

```powershell
$coverageTask = (Resolve-Path .qc-cache/coldwater-2026-09-30-coverage-repair/task).Path
$coverageEvidence = (Resolve-Path qc/runs/coldwater-2026-09-30-coverage-repair/golden).Path
docker run --rm --network none --shm-size 1g --mount "type=bind,source=$coverageTask,target=/task,readonly" --mount "type=bind,source=$coverageEvidence,target=/evidence" -e CW_MANIFEST=frozen_repair_inputs.json colderwater-verifier:postrepair-audit-20260930 python3 /evidence/drivers/launch_workflow.py
docker run --rm --network none --shm-size 1g --mount "type=bind,source=$coverageTask,target=/task,readonly" --mount "type=bind,source=$coverageEvidence,target=/evidence" -e CW_MANIFEST=frozen_repair_inputs.json colderwater-verifier:postrepair-audit-20260930 python3 /evidence/drivers/launch_restart_matrix.py
docker run --rm --network none --shm-size 1g --mount "type=bind,source=$coverageTask,target=/task,readonly" --mount "type=bind,source=$coverageEvidence,target=/evidence" colderwater-verifier:postrepair-audit-20260930 python3 /evidence/drivers/launch_fairness.py
```

The retained fairness runner rechecks ten prior controls/partial implementations: golden, original Run-duration accounting, padded-create/padded-update/both refusals, delayed handler failure with immediate Stop control, broken HTML dispatch with valid JS fallback, dead handlers, dead writing and constant-zero duration. Those browser procedures are unchanged; its manifest count assertion changes from 64 to 65.

No script calls a provider, installs packages, changes task files, patches shared harness code or grades visual aesthetics. Surface captures are evidence files only.
