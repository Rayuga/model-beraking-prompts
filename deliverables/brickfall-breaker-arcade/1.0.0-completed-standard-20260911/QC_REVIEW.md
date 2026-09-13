# Brickfall source, coverage and fairness review

Manual review against the supplied WebDev Rubrics QC workbook, task/upload-check
documents and current task standards. This is not an executed platform rubric
verdict. The platform's 53 authoring checks are distinct from this task's 37
submission-scoring criteria and the 116 local configuration assertions.

## Earlier reported issues

| Finding | Current disposition |
| --- | --- |
| Blank drop representation makes wall digests ambiguous | overview.md explicitly defines empty/absent drop as the empty string; all ten hashes independently checked. |
| Paused 1000-speed fixture conflicts with normal cap | physics.md explicitly exempts the paused load and applies the cap by its first step; real load/Advance checked. |
| Exact tick/width/threshold telemetry not requested as UI | Shared Functional guidance preserves exact values but permits captured simulation/snapshot evidence; it does not require extra ranked labels. The lab's visible telemetry remains required. |
| Short/inconsistent time budgets | Exact current lead budgets retained: 12000 nested within 12600 and 13200; agent 7200. This is budget consistency, not proof every model can finish. |
| Collapsed terminal/drill distinctions | The existing 22 Functional criteria already separate terminal finish/retry/refresh/restart and individual Multiball, Sticky, Last ball, Extra life, Final wall checks; preserved. |
| Binary aesthetic criteria and vague five-HUD wording | Migration splits five concrete interaction checks from six anchored Visual axes. Semantic check explicitly enumerates all six required HUD values. |
| Mobile waiver grants credit for missing surfaces | Current Visual scores actual presentation with explicit anchors; required mobile surfaces and input remain in interface.md and the relevant dimensions. |
| Later Polish gameplay changes Polly seed records | Pinned RewardKit 0.1.7 serial execution order was locally verified; Functional completes before Polish. Functional records seeded Polly history before Polly mutations; later dimensions accept resulting state. |
| Missing prompt version/provenance | All five r1 identifiers present and runner logs exact prompt/judge/config/runner hashes. |
| Golden mobile overlay clips a button | Small mobile-only CSS fix; containment and real hit-testing now pass. |

## Requirement-to-verifier coverage

| Brief area | Current checks |
| --- | --- |
| Sign-in, bearer identity and account isolation | Shared protected-data gates; seeded_sign_in_and_token_basics; complete_session_security_and_isolation. |
| Initial leaderboard and ten workbook walls/constants | initial_global_leaderboard_core; level_manifest_and_constants; all_seeded_walls_and_fresh_runs. |
| Mira checkpoint, freeze, terminal outcome and records | mira_checkpoint_freeze_and_restore; terminal_finish_and_records; terminal_receipt_retry; terminal_refresh_durability; terminal_keyboard_restart. |
| Dev extra-life threshold and level progression | dev_checkpoint_threshold_and_progression. |
| Personal history and exact terminal snapshots | polly_personal_history_and_snapshots, plus terminal record checks. |
| Paddle input, pause, full save/restore and Assist | ranked_controls_pause_save_restore; assist_and_manual_takeover; interaction Polish. |
| Collision, combo, fast-ball cap and seven drills | brick_types_fixed_step_and_combo; power_relay_exclusivity_and_timer; multiball_secondary_loss; sticky_capture_launch_and_expiry; last_ball_life_loss_cleanup; extra_life_threshold_once; final_wall_completion_bonus. |
| Transactional revision, receipts and duplicate activation | two_tab_revisions_receipts_and_duplicate_guard, ranked/terminal/progression replay observations. |
| Accessible DOM/HUD, focus, touch and feedback | Five Polish checks, with six named HUD values and non-colour brick/item cues. |
| Responsive visual presentation | Six anchored Visual axes, including 375px consistency, with appearance-only scoring. |
| Runtime entry and same-origin delivery | test.sh entry/readiness checks; Render and Constraints; shared protected-data gate. |

The matrix maps feature families, not a claim of exhaustive grading of every
implementation detail. For example, per-user password salting is a source-level
requirement not directly proven by these browser-only observations. Local restart
testing verifies the golden app; it is not a new graded restart criterion.

## Preserved boundaries and remaining risks

- No golden-specific paths/selectors were added to submitted judges. Local
  regression selectors target the reference only and are not packaged.
- Controlled request replay uses observed requests, not invented routes or
  forged game state. Gates do not mutate ranked data or revoke other sessions.
- No criteria were dropped to improve an Oracle score. Render, Constraints and
  all 22 Functional criterion definitions and weights match the baseline exactly.
- Visual stays appearance-only. An app satisfying the gates but missing deeper
  functionality can still earn presentation credit; the user previously deferred
  changing this floor. This release does not claim to eliminate that policy risk.
- Positive intermediate gate weights and final runner aggregation differ by
  design in the supplied standard. The final gated 60/20/20 arithmetic is tested;
  it was not redesigned to match RewardKit's intermediate aggregate.
- Reference Visual wording includes a 0 anchor while the pinned Likert scale
  normalizes 1..5 to 0..1. The reference convention is preserved, not independently
  validated by a full judge returning every possible raw rating.
- Some binary interaction criteria have multiple related observations; a future
  semantic review may request finer splitting. No new split or weight changes
  were made without fresh evidence/authorization to change the accepted standard.
- Static/reference conformity does not establish exact-image runtime compatibility
  or a semantic QC pass. Build failures and incomplete paid validation are listed
  explicitly in README.md.
