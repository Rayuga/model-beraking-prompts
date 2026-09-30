# Local QC

The workbook defines the checks; `harbor-webdev-rubric-qc/SKILL.md` defines how to apply them. Neither substitutes for the other. Read [review policy](REVIEW_POLICY.md) for repository-specific corrections and recurrent failures. The pipeline freezes the task, workbook, skill and template, and records checker/policy hashes; it then requires three independent complete reviews of the same bytes.

Use `python scripts/qc_pipeline.py prepare projects/<task> --run <unique-name>` to generate review instructions. Run all three instructions in parallel in separate agent contexts. Each reviewer covers all53 quality rows and all48 deterministic checks; different emphasis is additional, not a division of the checklist. They must not read each other's reports before completing their own.

Use `python scripts/qc_pipeline.py reconcile qc/runs/<unique-name>` afterward. Missing reports, missing/duplicate rows, source changes, unresolved findings or unavailable required evidence block local clearance. A single credible failure is not outvoted. Fix the source and start a new frozen round; refute a false positive with cited evidence and an explicit adjudication record. Never repeatedly rerun unchanged candidates until a favorable answer appears.

Three local reviews are our workspace policy. The user's report of three portal reviews and an Opus5.5 portal QC reviewer is recorded as user-supplied information, not independently verified platform configuration. That source-QC reviewer is distinct from the task's app-scoring model in `task.toml`. Do not change the template model settings to imitate portal QC.

Local success is not portal acceptance. Exact judge completion time, Oracle grade and target-model score need their own measured evidence. Parser tests, generated spreadsheets and scripted browser checks cannot establish them.

Use `python scripts/qc_pipeline.py export qc/runs/<unique-name>` to build `QC_REVIEW.xlsx` using the supplied skill's builder. It includes all three original reviews and the local release status, with internal workbook annotations removed. Export can succeed for a **BLOCKED** candidate: creating a report is not clearance. Stale or incomplete reports cannot export.

The repository needs Python 3.11+ and `openpyxl` for this workflow. They are available in this workspace. No paid provider call or portal upload occurs in these commands; the agent coordinator actually launches the three reviews. The script does not fake agents or infer a model identity.

## Resolving a disputed finding

Keep original reports intact. `adjudications.json` is a list of decisions with `key` (`reviewer-2:quality:<check_id>`), `status` (`refuted` or `evidence_supplied`), `reason`, `evidence_refs`, exact `evidence_sha256`, `confirmed_by` (another assigned reviewer), and `confirmation_ref` (a JSON file).

That confirmation file must identify the same `key`, `status`, `input_sha256`, evidence hashes and confirming `reviewer`, plus its own reason. An evidence file's presence does not prove its argument; the independent reviewer must assess it. Fixes are never same-hash adjudications: prepare a new round. Required runtime rows cannot be dismissed as false positives.

## Runtime evidence

`runtime-evidence.json` must contain records keyed by `timeouts_fit_the_work`, `verifier_image_can_launch_and_grade`, `reward_is_graded_not_binary_and_discriminates`, and `reward_ranking_is_monotone`. Each has `observed: true`, the current `input_sha256`, the command actually executed, and `artifacts` mapping repository-relative raw-log paths to SHA256. Logs should show the actual environment, commands, duration, results and failures. Reviewers must verify relevance and sufficiency; schema checks cannot prove the logs tell the truth. Do not create records for runs that did not happen.

Runtime gaps block clearance even if a reviewer mistakenly writes Pass. Scripted golden evidence is useful product evidence; full judge duration and empirical score behavior remain separate. Missing credentials must remain visible.

## Safe cleanup and recovery

Preview with `powershell -NoProfile -File scripts/cleanup_workspace.ps1`. Apply the inspected plan with `-Apply`. Only bounded, unmodified, committed archive-check extractions and Python bytecode caches are eligible. ZIPs, source and unique evidence stay. Each deletion manifest names its restore commit; use `git restore --source <commit> -- "<listed-path>"` if needed.

Packaging now validates archives in a temporary directory and releases it afterward. `.qc-cache/` contains reproducible review snapshots and is ignored by Git; keep manifests/reports under `qc/runs/`. Keep the cache while a review is active; deleting it invalidates reconciliation. Historical deleted extraction references can be recovered from Git, not silently treated as current evidence.
