The initial and managed restart launch paths now enter the server entry directory before executing Node. This supports ordinary relative file reads and static public paths for both /app and the relocated /tmp/coursemark-submission runtime.

The standalone fixture uses the actual tests/test.sh and tests/app-lifecycle.sh. A synthetic RewardKit command invokes runtime assertions only; it is not a model evaluation. It checks the selected entry, inherited verifier working directory, real HTTP root and health responses, relative seed loading, changed process ID and persisted runtime counter.

- app-result.json: 11 checks passed with the normal writable /app runtime.
- relocated-result.json: 11 checks passed with a read-only /app mount forcing the actual relocation branch.
- negative-control.json: two former launch-shape controls fail with ENOENT for relative seed_data.json when inheriting the verifier directory, confirming the fixture detects the regression.

Both positive cases begin and restart from /tmp/verifier-cwd. Source hashes are recorded in the result JSON. All checks used cached image coursemark-tests:1.0.17 with networking disabled; this is runtime diagnostic evidence, not validation of a freshly built verifier image or an Oracle score.

run-case.sh accepts app or relocated. It expects the current task mounted read-only at /source and this delivery at /evidence. For relocated, also mount cwd-runtime/fixture read-only at /app. The files in this diagnostic folder are excluded from the upload archive.
