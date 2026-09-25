# r18 verifier repair evidence

The final deliverable is
[Common Ground Ballot r18](../../../deliverables/common-ground-ballot/2026-09-16-verifier-repair-r18/README.md).
Read that release note for scope, validation and the pending platform Oracle.

The source changes preserve the golden/public task, all 68 criterion identities
and weights, and the score formula. `package.py` checks those invariants against
the immutable r17 ZIP, compares the actual image's verifier files with the new
source, validates the archive, and freezes the successful bytes. The delivered
ZIP hash is `35809a2ac0264b81e238bb5c80d670132f67c68c9de075f646504a1577fb88e8`.

- `package-audit.json`, `source-hashes.json`, `image-test-hashes.json` and
  `changes.diff` describe the final package.
- `trace-results.json`: eight wrapper tests, including verdict/exit preservation,
  missing final output, redaction, session-file selection and termination.
- `validation-runtime`, `validation-harness`, `validation-recovery`,
  `validation-boundaries`: 105 applicable existing regression groups run with
  the new verifier image and unchanged golden app.
- `helper-integration/helper-results.json`: nineteen passing integration groups
  using the actual Playwright MCP 0.0.79, loaded exactly as the prompt instructs.
  Per-step files retain the underlying observations. The exported Oracle server
  and UI match the golden solution byte-for-byte.
- `helper-capabilities`: actual MCP tool schema and environment probe. The VM
  lacks Node imports and global timers, but `browser_run_code_unsafe` supports
  `filename`; do not invent a Node import loader for this helper.

Development failures are preserved in `helper-integration-first-attempt` and
`helper-integration-second-attempt`. A convenience method that called direct
fetch from the installed helper stalled during the omitted-revision probe.
The exact internal VM cause was not established. That method is absent from the
final helper. Separate native browser arm/send/collect calls passed the fresh
control and the complete integration suite. `helper-direct-control` preserves
the narrower five-case confirmation before the final full nineteen-case run.

`frozen-preflight-first-attempt` and `candidate-preflight-first-attempt.zip`
preserve a preflight failure: the rewritten prompt expressed independent
scoring but omitted the exact common boilerplate recognized by the checker.
The final prompt explicitly includes independent evaluation, continuation after
individual failures and a verdict for every criterion. The final archive passes
179 standard checks and 472 upload checks. The checker itself was not weakened.

No fresh scored Oracle/model run was available locally; these observations do
not prove the full autonomous judge will finish or score Oracle 1.0. The revised
workflow now retains event logs and timings to diagnose the next platform run.
