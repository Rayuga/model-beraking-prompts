# Dropline shared-journey release

Task: `dropline-four-connect`, task version `1.0.0`, Functional prompt r4.

Upload `dropline-four-connect.zip` in this folder.
SHA-256: `62b389d1a28c388e5e15ddf6467f42695ed106913ce3f27979d17151fa59f7f8`.
The archive has exactly one `dropline-four-connect/` wrapper and 39 files.
Every archived file was read back and matched to the current source SHA-256.
Historical releases and their evidence were not changed.

## Changes

Only `tests/functional/prompt.md` and `tests/functional/judge.toml` differ from
the previous transplant/tactics release. Golden solution, task instructions,
both Dockerfiles, task configuration, runner, lifecycle helper, all other
dimensions and reward formula are byte-identical to that release.

- Run the Red-win sequence once for archive/replay and terminal history
  evidence. Retain the separate nonterminal branching leg, terminal Undo,
  reload while undone, Redo, terminal reload and archive preservation checks.
- Share one source/destination fixture across preview, atomic commit and
  recursive merge. Preserve pre-preview and pre-commit snapshots. Add the
  unrelated branch before the second preview, and capture its selected cursor
  as the second commit's baseline. No stale, invalid, private or same-study
  scenario was merged away.
- Share the tactical `2,7,3,7` fixture. The fork check's depth-three response
  is repeatability sample one; one repeat and one post-reload repeat still
  give three identical-response observations. Inspect the proof before the
  final report-invalidating edit.
- Traverse all 2,801 proof nodes through read-only processing of the actual
  UI response. Return compact structural findings, retaining the real-browser
  `[4,4,2,3]` inspection. Do not sample instead of traversing the structure.
- Permit batching ordinary visible setup clicks while awaiting each response
  and settled UI. No synthetic moves, injected state or API fixture shortcut.
- Record each criterion independently. Failure of shared setup must not
  automatically fail later criteria: attempt the later ordinary UI setup
  independently, retain prior failures, and never fabricate missing evidence.

All 60 criterion IDs/types/weights and all judge settings remain unchanged:
2 Render, 2 Constraints, 43 Functional, 7 Polish, 6 Visual. Functional total
weight is 66.5. Public agent and separate-verifier networking remain enabled.
All standard timeout values remain unchanged.

## Fresh local validation

- 139 repository standard checks passed.
- All task JSON/TOML parsed; authored JavaScript, embedded script and shell
  syntax passed in the Docker regression setup.
- 49 API/browser regression groups passed, including rejection/receipt
  behavior, two actual process restarts, saved study persistence, durable
  transplant previews/receipts and deterministic tactical reports.
- Twelve independently generated tactical fixtures were exercised within
  those regression groups, including the complete depth-four tree.
- Three additional shared-journey real-browser groups passed. All moves,
  forks, preview/commit and tactical actions in these groups used visible
  controls; read-only server snapshots checked state integrity.
- Three layout/reduced-motion groups passed at desktop 1280 and mobile 375.
- Twelve reward formula/input-validation cases passed.
- All 39 archive entries matched source hashes; only the two intended files
  differ from the preceding ZIP. All 60 criterion identities/types/weights,
  runtime configuration and current runner prompt provenance matched.

The actual `solve.sh` and `test.sh` ran in a new cached-image container. The
unpaid RewardKit stand-in executed local regressions and supplied synthetic
dimension inputs to test runner post-processing. Its 0.58 output is NOT an
Oracle score. No paid judge, model or platform QC was launched.

The extra shared-journey harness initially overconstrained an archive's
internal auto-increment row ID across Undo/Redo. The contract's stable match
identity, completion ordering and all record contents were already preserved;
the harness now compares those rather than the internal row ID. Its tactical
UI check also inspected lazy children before the details-toggle handler had
rendered them. Awaiting the actual child nodes fixed that test race. Attempts
1-3 are preserved in this folder. No golden code or graded requirement was
changed for these harness corrections. The final three-group run passed.

## Remaining risks / not tested

This reduces repeated actions but does not prove the full Codex judge will
finish within 9,000 seconds. The local fixed-selector browser script's runtime
does not measure judge reasoning/tool-call overhead. No current full Oracle or
model score is available, and Oracle 1.0 is not guaranteed.

The screenshot also questioned the agent's 7,200-second implementation budget.
That issue is not resolved by sharing verifier setup. The shared standard
prohibits unilateral timeout increases. If platform QC still flags feasibility,
the next decision is a lead-approved budget exception or a user-approved scope
change reflected consistently in instructions, golden solution and grading.

Both exact Dockerfiles are unchanged. This release used cached
`dropline-verifier-local:v6.0.3` with the available Chromium path linked into
the expected executable path. Fresh exact-image builds were not repeated;
the previous release recorded repository/PyPI availability failures. Cached
image regressions are not a claim that fresh builds or all platform QC pass.
