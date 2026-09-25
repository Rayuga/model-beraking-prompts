# Pellmoor run review — 14 September 2026

GPT-5.4 mini is above the requested 0.1–0.7 band. The current exports do not establish a passing final submission. Gemini is retained as an unrestricted comparison. The golden solution passed every Functional and Polish criterion; its two Visual deductions account for its 0.9833 overall result.

## Recorded scores

| Model | Overall | Functional | Polish | Visual | Render / Constraints |
|---|---:|---:|---:|---:|---|
| oracle | 0.9833 | 1.0000 | 1.0000 | 0.9167 | 1 / 1 |
| gpt-5.4-mini | 0.7661 | 0.8408 | 0.6000 | 0.7083 | 1 / 1 |
| gemini/gemini-3.7-flash | 0.8469 | 0.8726 | 0.7000 | 0.9167 | 1 / 1 |
| claude-haiku-4-5 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0 / 0 |
| nop | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0 / 0 |

## Provenance and score integrity

All five trials report task checksum `224f99f19440005bf0daced00a014c02da076607f887316ba9871b04c2e3e659`. All prompt, judge, runner and reward-config hashes match the preserved 13 September hardened package. Its ZIP SHA-256 is `78e09b260ff8162f3d29ffd504a3524a9ecbe229ab6e3e9e74ad99b74dc22033`; ZIP hashes and the platform task checksum are different identifiers.

All 181 exported files remain byte-for-byte unchanged. Oracle's seven deployed source files match the previous golden sources. Each graded trial contains all 52 expected criterion outcomes. Weighted means and the gated 60/20/20 formula reproduce every recorded result within rounding. No trial reports an exception; agent/verifier durations are within their configured limits. The no-op correctly has graded=0 and no_op=1. The non-no-op runs have graded=1 and no_op=0.

The exported judge metadata identifies codex / gpt-5.6-luna. The model agents ran at high reasoning effort; this is distinct from the verifier configuration at max. These exports contain verdict reasoning, configuration and model trajectories, but do not independently prove every judge action or launch-time environment value. Treat a verdict description of a setup mistake as an evidence limitation, not as a newly verified product failure.

## GPT-5.4 mini: what failed

Functional: 28/32 full-credit criteria, 66/78.5 weighted points = 0.8408. Four deductions were recorded:

| Criterion | Weight lost | Interpretation |
|---|---:|---|
| Append-only notes | 1 | Judge says notes, attribution, timestamps and activity persisted, but penalizes newest-first display. The brief did not require oldest-first. This is an unsupported presentation restriction. |
| Malformed / identity-changing writes | 8 | Acceptance of Boolean scores and client capacity/version claims is a real contract violation. Exported code coerces score/revision values with Number(...). A numeric header is necessarily text, so string-revision claims need the actual request location distinguished. |
| Pending duplicate prevention | 1 | The judge reports Save remained enabled during a delayed real response and a second request was sent. This is a concrete pending-state failure. |
| Capacity release / old receipts | 2.5 | Judge reports the saved full-capacity rejection was replayed after the other candidate had been hired, not while an opening was free. This missed the required checkpoint; it does not demonstrate reexecution of a saved receipt. |

If both disputed criteria eventually pass a correct rerun, the arithmetic increase would be about 0.0268, yielding approximately 0.7928 with everything else fixed. This is a sensitivity calculation, not a rescored result. Fairness corrections therefore do not solve the upper-band problem.

Polish failed four independent criteria: document width 442px at a 390px viewport; no navigation landmark; candidate keyboard activation left focus on BODY; no usable close/dismiss/Escape path for the drawer. The other six Polish criteria passed.

Visual earned typography=1, contrast=0.5, spacing=0.5, hierarchy=1, craft=0.75 and responsive consistency=0.5. Dark funnel labels were hard to read, and mobile capacity/funnel content was clipped. These are recorded normalized values, not raw 0–5 anchors.

## GPT: recorded passes and a missed defect

The judge awarded passes for all basic seeded-data, workflow, permission, scoring-boundary, funnel, persistence and documentation checks. It also passed stale-view conflict handling, simultaneous-write arbitration, durable success/rejection receipts, panel invalidation, offer reopening, frozen assessment history, capacity races and actor/session retry scoping. Its backend contains real SQLite transaction and durable receipt handling; treating these as unimplemented would contradict the evidence.

A targeted local run of the unmodified exported GPT backend additionally reproduced acceptance of Boolean, array and string scores, numeric-string JSON revisions and supplied capacity fields. It also found that one screening-to-interview action creates two activity events (assessment_version plus stage_change), despite the brief and complete-panel workflow criterion requiring one event per action. That criterion was recorded as a pass: it is a missed defect. The revised judge explicitly counts before/after event IDs at each step. These cached-runtime diagnostics are not platform rescoring; see `gpt-targeted-probes.json` for dependency and scope limits.

Detecting this extra weight-2 failure alone would reduce overall reward by only about 0.0153 with all other outcomes fixed. It cannot establish the requested band, particularly if the questionable deductions are corrected.

The complete recorded Functional pass list follows, including the missed-defect criterion above. All four Render/Constraints criteria also received passes. Full per-criterion reasoning for every model is in `criterion-results.csv` and `run-review.json`.

- `authentication_sessions_and_revocation`
- `seeded_pipeline_and_empty_vacancy`
- `candidate_panel_score_note_fidelity`
- `exact_derived_funnel`
- `duplicate_rule_and_cross_vacancy_identity`
- `role_enforcement_is_server_side`
- `legal_stage_move_and_independent_applications`
- `skip_and_large_backstep_are_atomic_rejections`
- `terminal_candidates_are_locked_and_retained`
- `score_boundaries_and_panel_ownership`
- `offer_requires_a_complete_independent_panel`
- `funnel_ripple_after_real_progress`
- `candidate_views_and_activity_stay_coherent`
- `stale_revision_rejects_then_allows_reviewed_retry`
- `simultaneous_writes_commit_at_most_once`
- `successful_retry_replays_one_result`
- `rejected_retry_and_payload_mismatch_are_stable`
- `worded_action_and_error_feedback`
- `runtime_manifest_routes`
- `backstep_terminal_loss_attribution`
- `panel_change_invalidates_entire_assessment`
- `panel_removal_and_readdition_require_fresh_scores`
- `reopened_assessment_and_frozen_stages`
- `seeded_capacity_and_hired_offer_conversion`
- `competing_offers_cannot_overbook`
- `receipt_identity_is_person_scoped_and_session_independent`
- `durable_cross_role_audit_after_reload`
- `success_and_rejection_receipts_survive_restart`

## Gemini and Haiku

Gemini-3.7-flash passed 30/32 Functional criteria (68.5/78.5 weighted points). A missing expected-revision header was accepted and mutated a candidate: a real failure. The other deduction describes removing Ruth while she was still assigned, then treating success as failure of an absent-member removal. That is an invalid probe premise. Its Polish losses concern sign-in landmarks, drawer focus and small touch targets. Its sole Visual deduction is responsive consistency (0.5). Gemini has no requested score-band restriction.

Haiku-4.5 received zero because the local page returned HTTP 500 with EACCES at `/tests/public/index.html`. Its exported server uses `express.static("public")`, which resolves from the process working directory. The hosting note promises startup in `/app`, but the previous verifier inherited `/tests`, which it also made inaccessible to the application user. This is a reproducible launcher mismatch and makes the zero unsuitable as clean capability evidence. The isolated witness in `launcher-regression.json` uses the exact old/new launch commands and the same relative-static pattern: old root=500, corrected root=200. It is not a full Haiku rerun; other defects may remain.

## Golden visual corrections

The original Oracle scored Visual=0.9167, with four criteria at full credit and spacing/responsiveness at 0.75 each. Its recorded deductions name wrapped drawer actions and horizontally scrolling mobile vacancy tabs. The revised golden uses an aligned two-column action grid, larger drawer controls, and a two-column mobile vacancy grid. Narrow funnel labels and counts now sit above their bars so they remain visible at 390px and 320px. Successful login clears stale signed-out feedback.

Browser checks pass for desktop 1280px and mobile 390px/320px in both themes, including actual SVG text bounds, page/drawer overflow, all vacancy cards, manager actions and coordinator controls. The 19 base regression groups and nine extended workflow groups pass, including real process restarts. Screenshots were inspected. These checks support the fixes but do not establish a new Visual=1.0 or Oracle score.

## Verifier corrections and stricter observations

The runner and restart helper now start from the application root while retaining the unprivileged user and stripped environment. Notes may display either chronological direction while retaining immutable attribution. Panel-removal probes first establish absence. Capacity replay evidence must be captured while room exists, before the next offer/hire. All five shared gates now explicitly test the same protected read anonymously before and after an exact wrong-password attempt, checking for leaked record content without clearing an improperly granted session.

The agent-visible reliability brief explicitly rejects coercion of JSON score/revision types and supplied server-owned fields; valid textual HTTP revision headers remain acceptable. The malformed-write criterion now checks the exact protected state after each individual probe using a fresh operation identity and otherwise valid metadata. This prevents later activity from hiding an earlier unauthorized mutation. No criterion IDs or weights, Visual anchors, final formula, model configuration or timeouts were changed.

## How to deepen the task fairly

See `HARDENING_PROPOSAL.md`. Further reduction cannot be guaranteed by prompt wording. The existing five integrity criteria already carry 40/78.5 Functional weight, and GPT passed four of them. The next useful change is a disclosed product workflow with new independent outcomes, implemented in the golden solution and validated before evaluation. Arbitrary extra penalties, duplicated deductions, hidden requirements and selecting only favorable runs would not be defensible.

## Release status

This folder is a review candidate, not a final in-range submission. Fresh exact-image builds and full Oracle/GPT runs must validate the frozen revision. The current machine’s attempted exact builds encountered Debian/PyPI network failures; cached-image local checks must not be described as successful exact builds. See `VALIDATION.md` for the completed checks and remaining limits.
