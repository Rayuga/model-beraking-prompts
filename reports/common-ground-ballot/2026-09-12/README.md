# Common Ground Ballot: Run Review

Status: **not ready for delivery**. Review date: 2026-09-12.

| Run | Final reward | Functional passed | Functional | Polish | Visual |
| --- | ---: | ---: | ---: | ---: | ---: |
| oracle | 0.8928 | 16/19 | 0.8214 | 1.0000 | 1.0000 |
| gpt-5.4-mini | 0.5714 | 6/19 | 0.2857 | 1.0000 | 1.0000 |
| gemini-3.7-flash | 0.7572 | 13/19 | 0.6786 | 0.7500 | 1.0000 |
| claude-haiku-4-5 | 0.0000 | 0/19 | 0.0000 | 0.0000 | 0.0000 |
| nop | 0.0000 | not graded | 0.0000 | 0.0000 | 0.0000 |

The formal model band is 0.1-0.7 and Oracle acceptance is at least 0.95. Only GPT is numerically in band. NOP zero is the expected empty-submission control. Haiku zero is not an in-band functioning app result.

## Export Integrity

All four jobs finished without trial errors. Every non-NOP trial returns all 33 criteria: Render 2, Constraints 2, Functional 19, Polish 4, Visual 6. All 12 prompt/judge/runner/reward provenance checks match the working task, including Functional r4 with the approval explanatory-note requirement removed. Final rewards agree across result.json, reward.json and reward.txt and with the 60/20/20 gated formula.

Use final reward 0.8928 for Oracle, not the intermediate 0.9643 aggregate printed in rewardkit.log.

## Golden Checks

The local golden suite passed 13 groups on its diagnostic rerun, including the three behaviors missing from Oracle evidence, exact receipt replay, and two real server restarts. Captured Oracle application files match the current golden: True.

The first local attempt passed 12 groups then stopped at the strict mobile theme-button geometry assertion. Only a screenshot before that assertion and geometry logging were added to the external driver; app and assertions were unchanged. The second attempt passed all 13 groups. The first result is preserved; its timing/geometry cause is not conclusively established. This is local regression evidence, not a replacement Oracle score.

## Failed-Check Assessment

### oracle

- `draft_edit_and_open_lock` (1.5): **judge_procedure**. Current-revision edit refusal was not captured while the ballot was Open; the judge progressed to Published.
- `single_choice_private_vote` (2.0): **judge_evidence_loss**. Visible voting and privacy worked, but the successful Owen request/response capture was lost.
- `close_boundary_and_hidden_results` (1.5): **judge_procedure**. The judge did not capture a fresh Member non-2xx vote refusal while Closed; hidden results and the close transition succeeded.

### gemini-3.7-flash

- `fixed_eligibility_snapshot` (1.5): **judge_procedure**. The ineligible Owen probe was sent only after publication; a terminal-state refusal cannot establish eligibility enforcement.
- `cross_ballot_choice_rejection` (1.0): **judge_procedure**. A later cross-ballot request returned 400 unchanged, but the required pre-participation rejection plus legitimate positive control was not established.
- `vote_retry_idempotency` (1.5): **app_defect_source_confirmed**. api.js checks current status/revision before looking up an existing operation receipt, so exact original retries conflict with the revision changed by the first vote.
- `close_boundary_and_hidden_results` (1.5): **judge_evidence_gap**. Close and fresh Member refusal were observed, but hidden-results evidence was missing for all required roles before publication.
- `stale_revision_and_terminal_safety` (2.0): **judge_procedure**. The stale probe targeted an invalid lifecycle state; the fractional-revision refusal does not replace a valid previous-revision conflict probe.
- `durable_reauthentication_and_seed_safety` (1.5): **app_defect_source_confirmed**. Sessions/data/restarts persisted, but replay after publication is rejected before the receipt lookup. This is a second consequence of the same replay-order bug.
- `accessible_keyboard_forms` (1.0): **app_defect_judge_observed**. The judge reports missing visible focus, escaping dialog focus, Escape not closing, and no trigger-focus restoration; not independently browser-retested here.

### gpt-5.4-mini

- `draft_validation_and_creation` (1.5): **app_defect_source_confirmed**. The Ballots UI edits only drafts[0] and exposes Save draft/Open this draft; there is no visible create workflow. Source agrees with the judge.
- `draft_edit_and_open_lock` (1.5): **blocked_by_missing_creation**. The distinctive Verifier draft could not be created; the full edit/open/lock sequence was not performed.
- `fixed_eligibility_snapshot` (1.5): **blocked_by_missing_creation**. Existing Courtyard and roster controls worked, but new Verifier/Future snapshots could not be established.
- `cross_ballot_choice_rejection` (1.0): **blocked_by_missing_creation**. The new Verifier ballot was unavailable for the required pre-vote cross-ballot probe.
- `single_choice_private_vote` (2.0): **judge_evidence_loss**. Visible votes, privacy, invalid-input refusals and published totals worked; exact successful request/response evidence was not retained.
- `vote_retry_idempotency` (1.5): **judge_evidence_gap**. No captured successful request remained to perform an exact replay; this is not an observed retry defect.
- `operation_id_mismatch_safety` (1.5): **judge_evidence_gap**. No retained successful operation id/request remained for the mismatch probe.
- `approval_selection_limits` (1.5): **blocked_by_missing_creation**. The Open Verifier approval ballot was unavailable; the limits workflow was not executed.
- `identified_turnout_without_choice_link` (1.5): **mixed_dependency**. Existing Courtyard privacy/turnout worked, but the new approval ballot and its one-participant check were unavailable.
- `close_boundary_and_hidden_results` (1.5): **judge_procedure**. The fresh Member HTTP refusal was captured only after publication, not during the required Closed phase.
- `stale_revision_and_terminal_safety` (2.0): **ambiguous_wrong_state_probe**. Terminal/older writes were refused, but a role/state error rather than stale-data feedback was recorded; the export does not establish a correct stale-only control.
- `audit_privacy_and_lifecycle_scope` (1.5): **mixed_dependency**. Recorded lifecycle/membership events, privacy and refusal non-mutation worked; create/edit/open audit coverage was blocked by absent creation.
- `durable_reauthentication_and_seed_safety` (1.5): **mixed_dependency_and_evidence**. Existing sessions/state survived restarts, but the successful-vote replay evidence and new Verifier records were missing.

### Haiku

All dimensions fail the shared login gate. Correct seeded Ruth/Leila credentials returned 401 even though health and the sign-in shell loaded. The captured app includes `.seed-applied`. `database.js:126` returns early whenever that file exists; the verifier legitimately removes the declared database and its WAL/SHM files for a fresh seed but retains other app files. The marker therefore survives an empty database and prevents creation of the seeded accounts.

Independent offline probe using the actual captured database.js and a disposable fresh SQLite database:
- Marker retained: 0 users; correct Ruth authentication fails.
- Marker absent: 4 users; correct Ruth authentication succeeds.

This probe does not modify the export, invoke a provider, or replace its recorded score. It directly tests initialization/authentication, not a full HTTP/browser model rerun.

## What To Do Next

1. Preserve all exported scores and record the current run as not ready for delivery.
2. Make Open and Closed checkpoints explicit barriers before progressing lifecycle state; capture the open-edit refusal, all-role hidden reads and fresh-member closed refusal in their valid states.
3. Register request/response capture before submitting each successful vote and retain the complete private evidence securely outside the app across navigation and restarts; never print session tokens.
4. Keep all existing behavioral assertions, correct isolated stale/eligibility controls, and distinguish blocked setup from demonstrated failures.
5. Validate the revised procedure on the golden solution, then run the full platform Oracle before making further model-run decisions. No scored rerun was started by this audit.

No task files, model artifacts, rubric weights or recorded rewards were changed for this audit. No new paid run or platform QC was executed. Missing judge evidence must not be relabeled as a pass.

Evidence: [full analysis](ballot-run-analysis.json), [criterion matrix](criterion-matrix.csv), [golden rerun](browser-results.json), [first golden attempt](browser-results-first-attempt.json), [Haiku reproduction](haiku-seed-marker-reproduction.json).
