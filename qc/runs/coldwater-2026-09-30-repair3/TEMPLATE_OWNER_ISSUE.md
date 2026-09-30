# Shared restart helper: reproduced defect

The Colderwater task preserves the canonical `tests/test.sh` byte-for-byte. Its SHA256 is `bd68259276ca4b034654efc8a1723a4e702ed62dbe590af6201565f43eabe5aa`. An isolated offline reproduction of its actual extracted restart helper confirms the prior QC concern.

- Synthetic old server PID 7 ignored TERM and continued answering HTTP.
- The helper waited approximately five seconds, then started replacement PID 67.
- Replacement failed with `EADDRINUSE` on port 3000.
- The helper nevertheless exited 0 and logged `pid=67 ready=1`.
- The responding server after the claimed restart was still PID 7.

Raw result: [inherited-restart-counterexample.json](inherited-restart-counterexample.json). Reproducer: [reproduce_restart.py](../../repairs/coldwater-2026-09-30/reproduce_restart.py). It ran in a disposable container with no external network or host port mapping; cleanup killed only the fixture's process groups. No task or template code was patched.

This can falsely establish process-restart persistence. A canonical fix should require termination of the old process group, bound shutdown and cleanup, and verify that the replacement is alive and owns the responding listener before reporting success. The separate canonical cleanup `wait` has no timeout; that concern remains source evidence and was not reproduced here.

The ordinary golden run DID replace PID 16 with PID 338 and preserved its records. That establishes the golden's normal restart behavior, not the correctness of the helper under adverse conditions.

Suggested message to the template owner, not sent:

> We found a reproducible issue in the unchanged template restart helper. If the old app ignores TERM, the new process fails with EADDRINUSE, but the helper still returns success because the old server answers its HTTP check. We reproduced this in an isolated container and kept the task harness unchanged. Could this be fixed in the shared template with bounded shutdown and verification that the replacement process actually started? The golden's normal restart passes; this concerns the shared check's reliability.
