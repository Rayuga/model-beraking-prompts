# Generic helper result and authoritative interpretation

The preserved `generic-breaker-audit.json` was executed on Ridgeline's initial 24-criterion candidate. It identifies the staged profile and reports one `verifier_contract` failure, with the message `tests/test.sh: app database cleared before grading`.

This message names a missing regex match, not an observed deletion. In `codearena-task-breaker/scripts/audit_task_source.py:376`, the helper requires a literal `rm -f "$APP_DB"`. The current staged template has no such deletion, and the runtime contract requires ordinary starts and verification restarts to preserve durable orders, attempts, cancellations and stock. The task's installer separately resets only its own closed database when installing the golden. Adding a database deletion to the grading harness would introduce a real persistence defect.

The raw helper failure is therefore retained and adjudicated as an obsolete assertion, not silently labelled a passing helper execution. Exact canonical Python/scoring comparisons, the reviewed launch flow and actual restart/installer observations are the relevant evidence. The separately reproduced false restart success is a real defect; it is addressed by stopping the old process group and verifying replacement liveness, without deleting state.

The helper's heuristic enforcement share is distinct from the task metadata's manually identified nine adversarial request/replay criteria. A broad keyword detector also counts some quantity-boundary checks; its percentage is not a measured difficulty score. The final report must state the resulting parsed weights/count and new source hash separately from this initial helper run.
