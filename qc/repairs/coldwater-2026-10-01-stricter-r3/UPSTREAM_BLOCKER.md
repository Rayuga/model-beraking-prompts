# Shared verifier isolation blocker

The Colderwater task files `tests/test.sh`, `tests/Dockerfile`, `tests/tools/score.py`, and `tests/tools/restart_mcp.py` match the required template. The task-specific QC review can repair its prompts, criteria, and golden app, but cannot isolate the shared runner by editing those controlled files.

Independent row 46 reviews in the R1 and R2 rounds reproduced the same issue. RewardKit 0.1.7 launches Claude with the private judge prompt in a `-p` command-line argument. The submitted app runs as UID 65534 in the same PID namespace and can read that root process's `/proc/<pid>/cmdline`, even though direct `/tests` reads and `/proc/<pid>/environ` are denied. The isolated probe used a sentinel prompt and no provider call; it proves exposure of the command-line argument, not a successful scoring exploit.

- R1: `qc/runs/coldwater-2026-10-01-history-hardening-r1/per-row-review/evidence/46/46-isolation-probe-result.json`.
- R2: `qc/runs/coldwater-2026-10-01-history-hardening-r2/per-row-review/evidence/46/runtime-probe.json` and `rows/46.json`.

Fix direction for the shared runner: pass private prompt content through a channel not visible in the app's process table, such as stdin, or isolate the app's `/proc`/PID namespace from the judge. Recheck with an unprivileged app probe and a configured judge run. The user's earlier decision to defer the shared restart issue does not cover this separate isolation issue. A task-specific QC round must keep row 46 open until the shared runner is fixed or the lead explicitly resolves the requirement.
