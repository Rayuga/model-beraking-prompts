# Unapplied shared-harness correction

The [proposed patch](shared-test-sh.patch) fixes the inherited restart, cleanup and scored-suite failure branches in the shared `tests/test.sh`. It has **not** been applied to the template or Colderwater task. All 11 proposed offline controls passed; the original failed five corresponding controls. This is a scoped engineering proposal, not task QC clearance.

## Owner decision

Approve this exact patch as a shared-template correction, with the same approved bytes subsequently synchronized into affected tasks. The workspace rule prohibits task-local shared-harness drift, so an author must not apply it only to Colderwater to silence a finding. No message has been sent to an owner and no task has been uploaded.

After owner approval, review and apply the shared correction, synchronize the task's inherited file, prepare a new frozen candidate, and run the required three complete independent reviews. The configured workload, verifier launch/grading and empirical reward-discrimination/ranking measurements are still required separately. This proposal does not authorize provider spending.

## Change and scope

The patch changes only `projects/webdev-task-template/tests/test.sh`:

- One shared `stop_app_group` function sends TERM, waits up to five seconds, sends KILL to survivors and waits up to one further second. An outer eight-second `timeout` bounds the helper itself. It confirms that no live process remains in the recorded group; zombie processes do not count as live listeners. The generated restart script receives this same function through Bash `declare -f`.
- Restart aborts if the old process group cannot be stopped. Before reporting readiness it checks that the replacement PID is live and owns a listening TCP socket on port 3000, then performs the existing HTTP probe and checks replacement liveness again. The socket check runs as the existing application UID 65534 so it can inspect that process's descriptors without adding container capabilities.
- EXIT cleanup uses the bounded stop function, replacing the unbounded `wait`. Cleanup failures remain visible on stderr and `ensure_reward` still executes.
- A nonzero scored-suite exit calls the existing `write_zero_reward`. The fallback becomes `graded=0/no_op=1`; suite logs, suite reward JSON and existing diagnostic details remain on disk. Successful grading and real product gate failures retain their existing behavior.

No changes to task files, `score.py`, `restart_mcp.py`, scoring policy, suite commands, app launch environment, image, judge configuration, prompts, criteria, or the existing 1500/11100/13200/55-second suite/verifier/MCP limits are proposed. The new eight-second deadline bounds termination only. The full [proposed file](proposed-test.sh) and original snapshot are included for inspection.

## Measured controls

All controls ran in the cached verifier image `sha256:46fefc505dbcabf0d6cb4e54fea8f0880acde2f7896587750af967427598977d`, using `--pull never --network none`, no host ports and only this proposal directory mounted. Fixtures were disposable Node processes with the canonical low-privilege identity and process-group launch. The helper-generation segment, cleanup functions and suite tail were extracted from each exact source. The scorer and scoring policy were unchanged; suite statuses/data were synthetic. [Raw results](evidence/results.json) include exact internal commands, return codes, process IDs, elapsed times, stdout, stderr, reward records and generated-helper hashes. Each control directory retains generated scripts and diagnostic files.

| Control | Original | Proposed |
|---|---|---|
| `bash -n` | Pass | Pass |
| Ordinary restart | Pass, PID 8 to 24 | Pass, PID 180 to 198, 0.761 s |
| Old server ignores TERM | **Fail**, exit 0, old PID 34 still serving; replacement 100 fails `EADDRINUSE`; volatile marker retained | Pass, old PID 209 gone, replacement 227 serving, volatile marker gone and disk marker retained, 5.784 s |
| Unrelated listener with a briefly live replacement that owns no socket | **Fail**, reports success | Pass, exits 1 in 2.023 s |
| Cleanup of its own direct TERM-resistant child | **Fail**, still blocked at the test's 10-second cutoff; child remains live | Pass, exits 0 and child terminated, 5.252 s |
| Scored-suite status 124 | **Fail**, stale `graded=1/no_op=0` | Pass, fallback `graded=0/no_op=1`, diagnostics retained |
| Scored-suite status 2 | **Fail**, stale `graded=1/no_op=0` | Pass, fallback `graded=0/no_op=1`, diagnostics retained |
| Gate-suite status 124 | Pass, plain zero | Pass, unchanged |
| Real product gate failure | Pass, graded gate failure; scored suite skipped | Pass, unchanged |
| Successful synthetic grade F=.5/P=1/V=1 | Pass, reward .7 | Pass, unchanged |
| Malformed scored result | Pass, plain zero with scorer error | Pass, unchanged |

`git apply --check` passed against the current canonical file. All 26 source bindings remained unchanged after testing. No original failing control was discarded or rewritten as a pass.

## Source and evidence binding

Canonical template and task `tests/test.sh` SHA256: `bd68259276ca4b034654efc8a1723a4e702ed62dbe590af6201565f43eabe5aa`.

Proposed `tests/test.sh` SHA256: `72ff3e9091c3b9a50b63e61bf2bb89ca4581a874ff5079000cb76ed152c741af`.

[source-bindings.json](source-bindings.json) records current rule, workbook, skill/reference, template/task shared-file and committed-audit evidence hashes. [evidence-manifest.json](evidence-manifest.json) binds proposal artifacts and raw controls. [commands.json](commands.json) records the host commands and their results. [prepare.py](prepare.py) reproducibly creates the patch from the asserted canonical hash; [probe.py](probe.py) runs the offline controls.

This proposal follows `AGENTS.md`, `qc/README.md`, `qc/REVIEW_POLICY.md`, authoring context/workflow, and the `harbor-webdev-rubric-qc` skill with its staged, quality and deterministic references. The actual root workbook was read through its XLSX XML; [workbook-inventory.json](workbook-inventory.json) retains the full 53 quality and 48 deterministic inventory plus internal annotations for internal use only. Relevant quality rows are 21, 35 and 49. The committed row reports and coordinator probe records were read as historical evidence; no active reviewer's findings were consulted.

## Limits requiring explicit owner review

These controls establish the local process and failure-record mechanisms. They do not execute the whole test entrypoint, MCP single-use wrapper, RewardKit judge, golden task workflows or hosted QC. They do not establish Oracle/model scores, production workload timing, reward ranking or acceptance.

Linux `/proc` availability and descriptor visibility were measured in this cached image. Other verifier container security profiles need validation. The supported runtime is one Node process; applications that deliberately move descendants into unrelated process groups or pass listening sockets to another process are outside these controls. SIGKILL cannot make a kernel task stuck in uninterruptible I/O terminate; the helper fails within its bound instead of asserting restart success. That failure branch is source-checked, not reproduced with an actual unkillable process.

The inherited HTTP readiness loop still performs up to 120 probes, each with network operations and sleeps. Its legacy "within 30 seconds" error is nominal, not a strict wall-clock bound; the unchanged MCP wrapper imposes its separate 55-second timeout. This patch bounds shutdown/cleanup and rejects false readiness, but does not claim to fix every startup/readiness timing issue. The socket observation is evidence of ownership at the check, not a guarantee that an arbitrary app can never crash later.
