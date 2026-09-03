# Brickfall Breaker Arcade — Evaluation Report

Deterministic full-stack brick breaker — golden Oracle, GPT-5.4-mini, Haiku, no-op and QC evidence.

## Product overview

Brickfall Breaker Arcade is a signed-in, server-backed canvas game that combines deterministic fixed-step physics with ten seeded walls, exact scoring and power-up rules, resumable runs, personal terminal history, a shared leaderboard, optimistic concurrency and idempotent SQLite persistence. A protected mechanics lab exercises the same engine through seven exact, non-scoring checkpoints.

## Overall scores

| Run | Final | Constraints | Functional | Render | Polish |
| --- | ---: | ---: | ---: | ---: | ---: |
| Oracle v2.2.1 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| GPT-5.4-mini untouched | 0.2182 | 1.0000 | 0.0000 | 1.0000 | 0.5455 |
| Claude Haiku 4.5 graded run | 0.0000 | 0.0000 | 0.0000 | 1.0000 | 0.2727 |
| No-op | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |

The Haiku model completed and produced an application artifact. Its first verifier handoff returned an ungraded no-op, but regrading the exact artifact produced a valid result with `graded=1` and `no_op=0`.

## Feature and subfeature coverage

### Application boundary and authentication

- Vanilla canvas client with a same-origin Node.js, Express and SQLite runtime.
- Seeded Mira, Dev and Polly accounts with salted passwords and SQLite-backed 64-hex bearer sessions.
- Account-wide sign-out, invalid-password rejection and strict isolation of saves, progress and history.

### Gameplay, physics and controls

- Ten deterministic walls, fixed 1/120-second simulation steps and bounded ball speeds.
- Face and corner collision handling, anti-tunnelling, paddle steering and at-most-once brick damage per step.
- Pointer, touch and keyboard play with launch, pause, restart and an ordinary-speed Assist paddle.

### Bricks, power-ups and progression

- Normal, strong and solid bricks with exact combo-scaled scoring and deterministic drops.
- Exclusive wide, slow, multiball and sticky effects with simulation-time expiry and restoration.
- Life thresholds, level bonuses, unlocks, level-10 completion and exact global leaderboard ordering.

### Persistence, history and concurrency

- Complete frozen run snapshots including damaged bricks, paddle, balls, drops, effects and timers.
- Monotonic revisions, optimistic two-tab reconciliation, opaque operation identifiers and persisted idempotency receipts.
- Latest-ten personal terminal history, inspectable snapshots, finish deduplication and durable account state.

### Mechanics lab and seeded evidence

- Seven signed-in, non-scoring drills that exercise the real engine without changing ranked state.
- Exact workbook users, levels, bricks, constants and leaderboard fixtures plus deterministic checkpoint outcomes.
- Visible semantic telemetry and recent events for collisions, collections, life loss and terminal state.

### Interface quality

- Responsive desktop and 375-pixel layouts with a readable canvas, HUD, controls, history and leaderboard.
- Keyboard focus, accessible canvas summaries, touch-sized controls, non-color cues and reduced-motion behavior.
- Coherent arcade styling and visible feedback across sign-in, play, labs, reload and sign-out.

## Verifier matrix

The matrix contains every live v2.2.1 verifier criterion. Oracle, GPT and Haiku values come from their preserved RewardKit criterion outputs. The Haiku regrade used the same criteria and a local Docker-compatible public verifier network because Harbor's Docker regrade command cannot enforce allowlist networking.

| Dimension | Criterion | Weight | Oracle | GPT | Haiku | Model evidence |
| --- | --- | ---: | --- | --- | --- | --- |
| Constraints | same_origin_application_shell | 1.0 | PASS | PASS | FAIL | GPT: Substantive Brickfall page rendered at localhost:3000 with its required same-origin resources. Haiku: the document rendered, but `/game.js` returned HTML and produced `Unexpected token '<'`. |
| Constraints | self_contained_runtime_and_reload | 1.0 | PASS | PASS | FAIL | GPT: The substantive same-origin page rendered again after a full reload. Haiku: reload restored the sign-in page, but the required `/game.js` runtime remained broken. |
| Functional | seeded_sign_in_and_token_basics | 2.0 | PASS | FAIL | FAIL | GPT: Visible sign-in only performed a GET navigation. Haiku: sign-in raised `ReferenceError: handleSignIn is not defined`; no request, identity or token was observed. |
| Functional | initial_global_leaderboard_core | 2.0 | PASS | FAIL | FAIL | GPT: Leaderboard contained no visible records before authentication. Haiku: the leaderboard was not visible before sign-in. |
| Functional | level_manifest_and_constants | 2.0 | PASS | FAIL | FAIL | GPT: Authenticated workspace and manifest were inaccessible. Haiku: failed game initialization left the manifest unavailable. |
| Functional | mira_checkpoint_freeze_and_restore | 2.0 | PASS | FAIL | FAIL | GPT: Mira could not be authenticated. Haiku: Mira sign-in and her checkpoint were inaccessible. |
| Functional | terminal_finish_history_and_retry | 2.0 | PASS | FAIL | FAIL | GPT: Mira could not be authenticated. Haiku: Mira's checkpoint and terminal controls were unavailable. |
| Functional | dev_checkpoint_threshold_and_progression | 2.0 | PASS | FAIL | FAIL | GPT: Dev workspace was inaccessible. Haiku: Dev sign-in and his checkpoint were inaccessible. |
| Functional | polly_personal_history_and_snapshots | 1.5 | PASS | FAIL | FAIL | GPT: Polly workspace was inaccessible. Haiku: Polly sign-in and personal history were inaccessible. |
| Functional | all_seeded_walls_and_fresh_runs | 2.0 | PASS | FAIL | FAIL | GPT: Level chooser was inaccessible. Haiku: the chooser and ranked starts were unavailable. |
| Functional | ranked_controls_pause_save_restore | 2.0 | PASS | FAIL | FAIL | GPT: Ranked controls were inaccessible. Haiku: no ranked run could be started. |
| Functional | assist_and_manual_takeover | 1.0 | PASS | FAIL | FAIL | GPT: Ranked run was inaccessible. Haiku: Assist controls were unavailable. |
| Functional | brick_types_fixed_step_and_combo | 2.0 | PASS | FAIL | FAIL | GPT: Mechanics lab controls were inaccessible. Haiku: the mechanics lab was unavailable. |
| Functional | power_relay_exclusivity_and_timer | 2.0 | PASS | FAIL | FAIL | GPT: Mechanics lab controls were inaccessible. Haiku: the Power relay drill was unavailable. |
| Functional | multiball_sticky_and_last_ball | 2.0 | PASS | FAIL | FAIL | GPT: Mechanics lab controls were inaccessible. Haiku: the required drills were unavailable. |
| Functional | extra_life_and_final_wall | 2.0 | PASS | FAIL | FAIL | GPT: Mechanics lab controls were inaccessible. Haiku: the required drills were unavailable. |
| Functional | two_tab_revisions_receipts_and_duplicate_guard | 3.0 | PASS | FAIL | FAIL | GPT: Authenticated two-tab workflow was inaccessible. Haiku: authenticated sessions could not be established. |
| Functional | complete_session_security_and_isolation | 2.0 | PASS | FAIL | FAIL | GPT: Authenticated workspace was inaccessible. Haiku: authentication failure prevented security and isolation checks. |
| Render | page_load_and_refresh | 1.0 | PASS | PASS | PASS | GPT and Haiku both rendered the substantive sign-in screen before and after a full refresh. |
| Render | basic_control_interaction | 1.0 | PASS | PASS | PASS | GPT and Haiku both accepted field input and sign-in activation while keeping the page visibly responsive. |
| Polish | sign_in_and_focus_quality | 1.0 | PASS | FAIL | FAIL | GPT lacked complete labels/feedback. Haiku had labelled, practical fields and visible focus, but sign-in threw a reference error and showed no invalid-login feedback. |
| Polish | responsive_shell_and_touch_targets | 3.0 | PASS | PASS | FAIL | GPT's public and game surfaces remained reachable at 375×760. Haiku's public surface fit, but post-sign-in canvas, controls and leaderboard were unreachable. |
| Polish | visual_shell_hierarchy | 3.0 | PASS | PASS | PASS | GPT and Haiku both presented a coherent, high-contrast arcade shell with clear hierarchy at desktop and mobile sizes. |
| Polish | semantic_game_state_and_events | 1.0 | PASS | FAIL | FAIL | GPT exposed incomplete semantics and state feedback. Haiku exposed only public sign-in semantics; protected state, telemetry, history and live updates were unreachable. |
| Polish | keyboard_pointer_touch_gameplay | 1.0 | PASS | FAIL | FAIL | GPT's visible gameplay inputs did not produce coherent movement. Haiku's gameplay was unreachable after sign-in failed. |
| Polish | canvas_and_state_readability | 1.0 | PASS | FAIL | FAIL | GPT's visible scene lacked required state distinctions. Haiku exposed no reachable rendered game scene. |
| Polish | complete_product_coherence_and_reduced_motion | 1.0 | PASS | FAIL | FAIL | GPT never formed a complete protected flow. Haiku stopped at sign-in with the missing-script and undefined-handler console errors. |

## Interpretation

The golden Oracle passed all 27 verifier criteria: 2 Render, 2 Constraints, 16 Functional and 7 Polish. This confirms that the current instruction contract, seed fixtures, reference implementation and verifier are mutually executable.

The untouched GPT-5.4-mini artifact scored 0.2182. It passed both hard-gate dimensions and produced a coherent responsive shell, but its signed-out bootstrap returned before binding the login submit handler. The browser therefore navigated with GET instead of issuing the required sign-in request, making every protected Functional workflow inaccessible. This is a genuine model implementation defect rather than a golden-path failure.

The corrected Haiku rollout made genuine model calls (8,076,748 input tokens and 118,863 output tokens) and completed without a trial exception. Its first verifier handoff returned an ungraded no-op, so the exact captured artifact was regraded against the unchanged v2.2.1 criteria. The valid regrade (`graded=1`, `no_op=0`) passed Render but failed Constraints because Haiku omitted the referenced `/game.js`; the server returned HTML for that request, causing `Unexpected token '<'` and leaving `handleSignIn` undefined. The resulting zero is a genuine model score. Earlier setup and zero-context attempts remain diagnostic evidence only.

## Packaging and QC

- Platform task version 2.2.1 contains exactly 31 tracked files beneath one brickfall-breaker-arcade/ wrapper.
- The platform ZIP contains only environment, instruction, solution, task and verifier files; reports and run evidence remain outside it.
- The task ZIP exactly matches the committed source, both shell scripts use LF, and JSON/TOML plus Node syntax checks pass.
- Fresh Docker builds succeed for both the environment and verifier images; the golden app boots, creates SQLite and returns a healthy HTTP response.
- The no-op path returns exact reward 0.0000, while the canonical Oracle returns 1.0000 with 27/27 criteria passing.
- Verifier networking is restricted to openrouter.ai and no literal OpenRouter key is present in the task or evidence archives.
- Post-run QC records 29/29 executable checks, 19 active upload-rule passes, four optional passes and no failed upload rule.
- The strict robustness scorecard currently records 23 Pass, 1 Partial and 6 Open measurement rows.

## Remaining non-blocking observations

- A second graded adversarial artifact at or below 0.2 has not yet been measured; Haiku qualifies at 0.0, while GPT-5.4-mini scored 0.2182.
- Four distinct rewards and reward standard deviation across eight valid runs remain unmeasured.
- The same frozen rollout has not been rescored three times under identical judge settings.
- Dedicated keyword-stuffing, injected-content and refusal-only artifacts have not been scored.
- These are optional robustness measurements, not task-source, packaging, verifier or golden-solution defects.

## Evidence locations

- Platform upload: `brickfall-breaker-arcade.zip`
- Oracle evidence: `oracle-run.zip`
- Model evidence: `gpt-run.zip`
- Haiku evidence: `haiku-run.zip` — SHA-256 `1D39C21188234921E507EF1D48C701F8B40B14093C2F5BA5AE8534E0070270BA`
- QC evidence: `qc-report.xlsx` and `qc-findings.json`
