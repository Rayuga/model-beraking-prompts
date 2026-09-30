# Repair provenance

These files record the 30 September task-owned repair and its local probes. They live outside the task archive.

`apply_repairs.py` and `update_drivers.py` are historical one-time transformations of the pre-repair source and drivers. **Do not rerun them on the repaired task**; use the committed/current source instead. They deliberately assert their original input patterns.

`prepare_golden.py <existing-frozen-run-name>` copies the current probe drivers into that run's `golden` directory and binds them to the frozen task. Do not replace drivers inside completed historical run directories. Use a fresh run/evidence directory for changed inputs.

The final executed driver copies, raw observations and file hashes are preserved under `qc/runs/coldwater-2026-09-30-repair3/golden/run-golden-20260930-092021`. Later standalone surface captures preserve their own driver copies. These are scripted browser checks, not LLM judge calls.

`reproduce_restart.py` is an isolated fixture for the inherited canonical helper defect. It must run only in a disposable container, not against the user's running app. The frozen task is mounted read-only, fixture processes live in the container, and only result files go to the evidence mount.
