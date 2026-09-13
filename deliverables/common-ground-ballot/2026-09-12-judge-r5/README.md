# Common Ground Ballot: Final Pre-Run Check

Use `common-ground-ballot.zip` from this folder for the complete platform run.
It preserves the previous release and includes Functional prompt r7, Polish r3,
33 criteria and the unchanged criterion weights. Task version remains 1.0.0.

Only `tests/functional/judge.toml` and `tests/functional/prompt.md` differ from
judge-r4. Configuration, instructions, seed and golden application are unchanged.

## Final Corrections

- Malformed lifecycle probes use fresh operation ids so a replay mismatch cannot
  hide fractional-revision acceptance. The otherwise-valid seeded Draft is the
  negative control, followed by its normal valid Open action.
- Closed voting is tested with eligible, not-yet-participated Owen on Future
  roster probe. Its snapshot still includes him despite his paused current roster
  status. A duplicate-participation error on Courtyard cannot substitute for this
  lifecycle check. Courtyard retains the all-role hidden-results observations.
- The too-few-choices test first sets the approval limit to one, preventing an
  unrelated limit error from masking missing choice-count validation.

## Local Verification

- Rebuilt image `ballot-verifier:20260912-judge-r5`.
- 16/16 golden browser regression groups passed, including both real restarts,
  exact rendered result totals, six mobile workspaces and the new negative controls.
- No browser errors. Runtime, syntax, 33-criterion discovery and submission-UID
  verifier isolation checks passed.
- A disposable mutant allowed Closed voting while retaining duplicate protection.
  The old participated-user probe passed; the new eligible-unparticipated probe
  detected its incorrect 201 success. This is an expected negative-control failure,
  not a golden failure. See `negative-control-results.json`.
- Exact image prompt hashes and package checks are recorded alongside the ZIP.

All tests above are local and unpaid. No new full Oracle, model run or platform QC
has been completed for this archive. The prior r5 scores remain Oracle 0.9595,
GPT 0.7393, Gemini 0.6536 and Haiku 0; they are not scores for this revised package.
Oracle 1.0 or all models in band cannot be guaranteed. No further scope or weight
changes are recommended before the user's complete platform run.
