# Local QC

The workbook defines the checks; `harbor-webdev-rubric-qc/SKILL.md` defines how to apply them. Neither substitutes for the other. Read [review policy](REVIEW_POLICY.md) for repository-specific corrections and recurrent failures. The pipeline freezes the task, workbook, skill, template and review mode, and records checker/policy hashes. The 1 October user instruction requires ONE audit round: one separate fresh reviewer context per each of 53 quality rows, plus a separate complete review of the 48 deterministic rows.

Use `python scripts/qc_pipeline.py prepare projects/<task> --run <unique-name> --mode single-per-row` to generate instructions. This mode is the prepare default. Run `per-row-review/prompts/01.md` through `53.md` in 53 separate fresh contexts, and `per-row-review/prompts/deterministic.md` for the complete deterministic review. Batch scheduling is allowed within available concurrency; a quality reviewer context cannot be reused for another row. Reviewers must not read each other's reports before finishing. The tools generate blank templates only; the coordinator launches the actual reviewers.

Each quality reviewer saves one flat JSON row to `per-row-review/rows/NN.json`, preserving its assigned `row-reviewer-NN` identity, row ID/number and input hash. Complete `read_sources` and `sources_read` from actual reading. The deterministic reviewer fills the object template in `per-row-review/deterministic.template.json` and saves `deterministic.json`, with all 48 distinct names, verdicts, risk flags and concrete evidence. Do not use the historical task-specific `per_row_deterministic_review.py` to manufacture verdicts for a new candidate.

Use `python scripts/qc_pipeline.py reconcile qc/runs/<unique-name>` afterward. Finish this ONE round and reconcile the union of findings before fixing defects and starting another round. Missing reports, missing/duplicate rows, source changes, unresolved findings or unavailable required evidence block local clearance. A single credible failure is not outvoted. Refute a false positive with cited evidence and an explicit independently confirmed adjudication record. Never repeatedly rerun unchanged candidates until a favorable answer appears.

Historical manifests without `review_mode` continue to mean `three-full`; an explicit `--mode three-full` remains available for reproducing that historical contract. Their reports are preserved and are not converted into new row reviews. Current single-round manifests bind the mode in `inputs.review_contract`. The user's historical report of three portal reviews and an Opus5.5 portal QC reviewer is user-supplied information, not independently verified platform configuration. It does not dictate local review count or the app-scoring model in `task.toml`.

Local success is not portal acceptance. Exact judge completion time, Oracle grade and target-model score need their own measured evidence. Parser tests, generated spreadsheets and scripted browser checks cannot establish them.

Use `python scripts/qc_pipeline.py export qc/runs/<unique-name>` to build `QC_REVIEW.xlsx` using the supplied frozen skill's builder. It freshly reconciles current reports, decisions and runtime artifacts, retains the original verdicts and report hashes, and removes internal workbook annotations. A single-round workbook contains 53 quality rows and 48 deterministic rows; historical three-full exports retain all three reviews. Export can succeed for a **BLOCKED** candidate: creating a report is not clearance. Stale or incomplete reports cannot export. The prepare/collect/finalize/export per-row helper scripts delegate to this pipeline when the manifest uses `single-per-row`; historical supplementary audits keep their older path.

The repository needs Python 3.11+ and `openpyxl`. No paid provider call, Docker run or portal upload occurs in these commands. Docker runs are authorized in the current task and must be coordinated to avoid conflicting shared state; provider spending and uploads need their own existing authorization. The script does not fake agents or infer a model identity. Assigned IDs cannot prove fresh contexts; the coordinator is responsible for actual independent assignments.

## Resolving a disputed finding

Keep original reports intact. The run-root `adjudications.json` is a list of decisions with `key` (for example `row-reviewer-02:quality:<check_id>` or historical `reviewer-2:quality:<check_id>`), `status` (`refuted` or `evidence_supplied`), `reason`, `evidence_refs`, exact `evidence_sha256`, `confirmed_by` (a different assigned reviewer with a valid report), and `confirmation_ref` (a JSON file). A follow-up confirmation happens after the independent round; it does not authorize reading another review during that round.

That confirmation file must identify the same `key`, `status`, `input_sha256`, evidence hashes and confirming `reviewer`, plus its own reason. An evidence file's presence does not prove its argument; the independent reviewer must assess it. Fixes are never same-hash adjudications: prepare a new round. Required runtime rows cannot be dismissed as false positives.

## Runtime evidence

`runtime-evidence.json` must contain records keyed by `timeouts_fit_the_work`, `verifier_image_can_launch_and_grade`, `reward_is_graded_not_binary_and_discriminates`, and `reward_ranking_is_monotone`. Each has `observed: true`, the current `input_sha256`, the command actually executed, and `artifacts` mapping repository-relative raw-log paths to SHA256. Logs should show the actual environment, commands, duration, results and failures. Reviewers must verify relevance and sufficiency; schema checks cannot prove the logs tell the truth. Do not create records for runs that did not happen.

Runtime gaps block clearance even if a reviewer mistakenly writes Pass. Scripted golden evidence is useful product evidence; full judge duration and empirical score behavior remain separate. Missing credentials must remain visible.

Freeze before new measurements when the tests need `input_sha256`. Add `raw-evidence-index.json` in the prepared run afterward and include the measured artifact paths/hashes in the runtime records. Reconciliation records the current index and runtime-record hashes; export reruns all validation instead of trusting an old summary. Alternatively, `prepare --evidence <existing-index>` binds an existing index into the immutable review contract; changing that explicitly frozen index requires a new candidate. An index lists observations and never establishes them by itself.

The user permits justified timeout changes below five hours per lead guidance, with a recorded reason and authorization. There is no automatic increase. Current budgets and canonical timeout preflight remain unchanged because no full configured timing measurement justifies a particular new value; any future justified exception needs a narrow checker update before its candidate freezes.

## Safe cleanup and recovery

Preview with `powershell -NoProfile -File scripts/cleanup_workspace.ps1`. Apply the inspected plan with `-Apply`. Only bounded, unmodified, committed archive-check extractions and Python bytecode caches are eligible. ZIPs, source and unique evidence stay. Each deletion manifest names its restore commit; use `git restore --source <commit> -- "<listed-path>"` if needed.

Packaging now validates archives in a temporary directory and releases it afterward. `.qc-cache/` contains reproducible review snapshots and is ignored by Git; keep manifests/reports under `qc/runs/`. Keep the cache while a review is active; deleting it invalidates reconciliation. Historical deleted extraction references can be recovered from Git, not silently treated as current evidence.
