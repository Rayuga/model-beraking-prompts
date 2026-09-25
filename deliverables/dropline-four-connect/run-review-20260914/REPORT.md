# Dropline Four Connect: September 14 run review

## Conclusion

The new GPT score meets the requested below-0.7 target and its basic gates pass.
The package is not fully cleared against the user's requirement that every
Oracle Functional criterion pass: one Oracle criterion remains failed. Several
model deductions explicitly lack completed execution evidence and should not
be represented as proven implementation defects.

| Run | Overall | Functional | Functional passed | Polish | Visual |
| --- | ---: | ---: | ---: | ---: | ---: |
| Oracle | 0.9819 | 0.9699 | 42/43 | 1.0000 | 1.0000 |
| GPT-5.4-mini, high | 0.6710 | 0.5564 | 24/43 | 0.7273 | 0.9583 |
| Gemini 3.7 Flash, high | 0.7588 | 0.9098 | 38/43 | 0.2727 | 0.7917 |
| Claude Haiku 4.5 | 0.1543 | 0.0602 | 3/43 | 0.0909 | 0.5000 |
| NOP | 0 | 0 | Not graded | 0 | 0 |

All four non-NOP runs scored Render=1 and Constraints=1. The earlier GPT
blocking-overlay failure is not present in this attempt's reported gates.
NOP is explicitly no_op=1/graded=0, not a paid browser-judge success/failure.
Only GPT's below-0.7 target is established here; no universal model range was
assumed. Gemini is above 0.7 if an admin requires that limit for every model.

## Package and score integrity

- All five trials share platform task checksum
  `1e20304a1bfc87a83541f5d69a81e11e4a1415fd56a8c027e9f592787e53cae9`.
- Every exported judge/prompt, runner and reward-configuration provenance hash
  matches the current repository source. Functional prompt is r4.
- Current source matches all entries in the shared-journey ZIP, SHA-256
  `62b389d1a28c388e5e15ddf6467f42695ed106913ce3f27979d17151fa59f7f8`.
  A platform task checksum and a ZIP hash are different identifiers; equality
  between them is not claimed.
- Every exported Oracle app file corresponding to a current golden file matches
  it byte-for-byte.
- Dimension scores recompute from criteria/weights, and final scores recompute
  from the required gated 0.6/0.2/0.2 formula, within output rounding.
  RewardKit's intermediate aggregate is not the final platform reward; for
  example GPT's rewardkit.log says 0.8903, but the required post-processed result
  is correctly 0.6710.
- No trial reports an exception. Completed agent builds took approximately
  9 minutes GPT, 9 minutes Gemini, and 10 minutes Haiku; these were not observed
  two-hour agent cutoffs. This does not prove every judge action was completed.
- Fresh repository standard checks: 139 passed. No new platform rubric run or
  paid Oracle/model run was launched during this review.

## Oracle: the outstanding failure

`analysis_operation_receipts` (weight 2 of Functional total 66.5) failed.
The judge says accepted/edit receipts were durable, but a repeated analysis
activation during a delayed first response produced two moves/revisions.
That one deduction accounts for the complete gap from Oracle 1.0.

Fresh diagnostic reproduction used the exported Oracle source read-only, a
fresh temporary database and the cached verifier image. Setup used real UI
sign-in, a completed match and a new analysis. The real first response was held
unchanged while a second physical activation occurred. All four cases passed:
same-button mouse, different-button mouse, keyboard Enter and keyboard Space.
Each produced one request, one new node and one revision, and the controls were
disabled before response delivery. See oracle-pending.cjs and oracle-pending.json.

The claimed duplicate-move failure was not reproduced. A browser actionability
wait can postpone a second click until the first completes, which would instead
be a legitimate next move; that is a plausible explanation, not an established
account of this judge run. Its detailed judge browser trace is absent from the
export. Builder agent trajectories are not judge action traces. Keep the recorded
Oracle score unchanged and resolve the discrepancy before claiming all Functional
criteria pass. No golden or verifier change was made for this diagnosis.

## GPT: real shortcomings and incomplete evidence

The new run is `run-d1aa8553-76f0-45ef-af0d-ab6b31c49a80`.
Reported concrete failures include duplicate study creation on exact retry,
analysis Redo returning 400, accepted forbidden input fields, incorrect tactical
outcomes/terminal recommendations and missing interactive proof expansion.
Polish failures concern pending preview/commit controls and keyboard proof access.
These are judge-reported observations; this review did not locally reproduce
every model defect.

Nine failed Functional criteria explicitly report incomplete execution/evidence:

- multi_tab_revision_and_duplicate_guard
- cross_tab_sign_out_revocation
- analysis_ownership_boundaries
- analysis_stale_edit_and_recovery
- restart_persistence_and_seed_idempotence
- transplant_illegal_descendant_rollback
- tactics_opponent_defence_and_loss
- tactics_readonly_repeatability
- tactics_server_input_boundaries

These carry total Functional weight 14/66.5. They are not proven passes either.
If all nine passed after proper execution, with everything else unchanged, the
score would be approximately 0.7973. This is a sensitivity calculation, not a
corrected score or prediction. Therefore 0.6710 is the recorded result, not proof
that the implementation necessarily remains below 0.7 under complete measurement.

## Gemini

Run `run-0f04760e-8281-47e4-b9e0-3c71ad4e9a16` passed 38/43 Functional.
Reported failures concern keyboard Redo focus, accepting forbidden fields and
an unknown action, plus one missing restart checkpoint. In that restart criterion
the judge explicitly observed persistence across two restarts but did not exercise
Redo between them. Do not call that evidence of broken persistence. Its 1/66.5
weight would add about 0.0090 overall if properly tested and passed; this is not
an awarded correction. Other reported shortcomings include mobile analysis
overflow, pointer-only tree/proof rows and pending-control behavior.

## Haiku

Run `run-61c34403-be40-4fd0-8ec6-b26df53f080b` passed 3/43 Functional.
Reported failures include a seeded Redo HTTP 500, wrong gravity/full-column/win
behavior, archive/undo mismatch and reset revision errors. Analysis creation was
unimplemented, so its dependent advanced features could not be exercised. Its
low score is primarily missing/broken functionality, not a failed startup gate.
No model-source edits were made to improve the recorded result.

## Next steps and limitations

1. Resolve Oracle's pending-activation discrepancy using the detailed judge
   trace if available, or a focused properly timed observation. Do not remove
   the requirement or change reported scores to reach 1.0.
2. Treat unexecuted GPT/Gemini checks as an evidence gap, not confirmed app
   defects. Obtain the judge trace or complete those observations before giving
   an unqualified fairness or stable-range endorsement.
3. Preserve all attempts. The old zero-score GPT run is no longer in the current
   run directory; its prior local gate-audit evidence remains in deliverables.
4. No source, ZIP, weights, requirements or gate configuration was changed.
   Fresh exact-image builds and all model-browser regressions were not run.
   The new local Oracle diagnostic used cached dropline-verifier-local:v6.0.3.

Full per-criterion failures, run identifiers and integrity checks: audit.json.
