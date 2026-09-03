# Brickfall Breaker Arcade — Evaluation Report

Deterministic full-stack brick breaker — golden Oracle, GPT-5.4-mini, Haiku, no-op and QC evidence.

## Product overview

Brickfall Breaker Arcade is a signed-in, server-backed canvas game that combines deterministic fixed-step physics with ten seeded walls, exact scoring and power-up rules, resumable runs, personal terminal history, a shared leaderboard, optimistic concurrency and idempotent SQLite persistence. A protected mechanics lab exercises the same engine through seven exact, non-scoring checkpoints.

## Overall scores

| Run | Final | Constraints | Functional | Render | Polish |
| --- | ---: | ---: | ---: | ---: | ---: |
| Oracle v2.2.1 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| GPT-5.4-mini untouched | 0.2182 | 1.0000 | 0.0000 | 1.0000 | 0.5455 |
| Claude Haiku 4.5 completed run* | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| No-op | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |

*The Haiku model completed and produced an application artifact, but Harbor returned `graded=0` and `no_op=1`. Its zero is retained as completed-run evidence, not a criterion-level capability verdict.*

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

The matrix contains every live v2.2.1 verifier criterion. Oracle and GPT values come from their preserved RewardKit criterion outputs. Haiku has no criterion-level output because its completed run exited through the verifier no-op path.

| Dimension | Criterion | Weight | Oracle | GPT | Haiku | Model evidence |
| --- | --- | ---: | --- | --- | --- | --- |
| Constraints | same_origin_application_shell | 1.0 | PASS | PASS | N/G | GPT: Substantive Brickfall page rendered at localhost:3000. Network evidence shows 200 responses for the same-origin document, stylesheet, and script. Haiku: completed as an ungraded no-op; no criterion-level verdict is available. |
| Constraints | self_contained_runtime_and_reload | 1.0 | PASS | PASS | N/G | GPT: After a full reload, the substantive Brickfall page rendered again. Network evidence showed only same-origin document, stylesheet, and script requests; no required public-origin resources were used. Haiku: completed as an ungraded no-op; no criterion-level verdict is available. |
| Functional | seeded_sign_in_and_token_basics | 2.0 | PASS | FAIL | N/G | GPT: Visible sign-in only performed a GET navigation; no authentication request, identity, or Bearer token appeared. Haiku: completed as an ungraded no-op; no criterion-level verdict is available. |
| Functional | initial_global_leaderboard_core | 2.0 | PASS | FAIL | N/G | GPT: Leaderboard contained no visible records before authentication. Haiku: completed as an ungraded no-op; no criterion-level verdict is available. |
| Functional | level_manifest_and_constants | 2.0 | PASS | FAIL | N/G | GPT: Authenticated workspace and manifest were inaccessible. Haiku: completed as an ungraded no-op; no criterion-level verdict is available. |
| Functional | mira_checkpoint_freeze_and_restore | 2.0 | PASS | FAIL | N/G | GPT: Mira could not be authenticated. Haiku: completed as an ungraded no-op; no criterion-level verdict is available. |
| Functional | terminal_finish_history_and_retry | 2.0 | PASS | FAIL | N/G | GPT: Mira could not be authenticated. Haiku: completed as an ungraded no-op; no criterion-level verdict is available. |
| Functional | dev_checkpoint_threshold_and_progression | 2.0 | PASS | FAIL | N/G | GPT: Dev workspace was inaccessible. Haiku: completed as an ungraded no-op; no criterion-level verdict is available. |
| Functional | polly_personal_history_and_snapshots | 1.5 | PASS | FAIL | N/G | GPT: Polly workspace was inaccessible. Haiku: completed as an ungraded no-op; no criterion-level verdict is available. |
| Functional | all_seeded_walls_and_fresh_runs | 2.0 | PASS | FAIL | N/G | GPT: Level chooser was inaccessible. Haiku: completed as an ungraded no-op; no criterion-level verdict is available. |
| Functional | ranked_controls_pause_save_restore | 2.0 | PASS | FAIL | N/G | GPT: Ranked controls were inaccessible. Haiku: completed as an ungraded no-op; no criterion-level verdict is available. |
| Functional | assist_and_manual_takeover | 1.0 | PASS | FAIL | N/G | GPT: Ranked run was inaccessible. Haiku: completed as an ungraded no-op; no criterion-level verdict is available. |
| Functional | brick_types_fixed_step_and_combo | 2.0 | PASS | FAIL | N/G | GPT: Mechanics lab controls were inaccessible. Haiku: completed as an ungraded no-op; no criterion-level verdict is available. |
| Functional | power_relay_exclusivity_and_timer | 2.0 | PASS | FAIL | N/G | GPT: Mechanics lab controls were inaccessible. Haiku: completed as an ungraded no-op; no criterion-level verdict is available. |
| Functional | multiball_sticky_and_last_ball | 2.0 | PASS | FAIL | N/G | GPT: Mechanics lab controls were inaccessible. Haiku: completed as an ungraded no-op; no criterion-level verdict is available. |
| Functional | extra_life_and_final_wall | 2.0 | PASS | FAIL | N/G | GPT: Mechanics lab controls were inaccessible. Haiku: completed as an ungraded no-op; no criterion-level verdict is available. |
| Functional | two_tab_revisions_receipts_and_duplicate_guard | 3.0 | PASS | FAIL | N/G | GPT: Authenticated two-tab workflow was inaccessible. Haiku: completed as an ungraded no-op; no criterion-level verdict is available. |
| Functional | complete_session_security_and_isolation | 2.0 | PASS | FAIL | N/G | GPT: Authenticated workspace was inaccessible. Haiku: completed as an ungraded no-op; no criterion-level verdict is available. |
| Render | page_load_and_refresh | 1.0 | PASS | PASS | N/G | GPT: Brickfall sign-in screen rendered with heading, email/password fields, and Sign in control; it remained fully rendered after refresh. Haiku: completed as an ungraded no-op; no criterion-level verdict is available. |
| Render | basic_control_interaction | 1.0 | PASS | PASS | N/G | GPT: Entered text in both fields, tabbed to the sign-in control, activated it once, and the page remained visibly rendered and responsive. Haiku: completed as an ungraded no-op; no criterion-level verdict is available. |
| Polish | sign_in_and_focus_quality | 1.0 | PASS | FAIL | N/G | GPT: The Polly submission returned to the public sign-in screen with no success or invalid-login feedback. The password field has no programmatic label, and focus styling is largely default. Haiku: completed as an ungraded no-op; no criterion-level verdict is available. |
| Polish | responsive_shell_and_touch_targets | 3.0 | PASS | PASS | N/G | GPT: At 375×760, the public surface stacks cleanly with no horizontal overflow; the canvas, panels, tables, and 43px action controls remain reachable and labels are not clipped. Haiku: completed as an ungraded no-op; no criterion-level verdict is available. |
| Polish | visual_shell_hierarchy | 3.0 | PASS | PASS | N/G | GPT: Desktop and mobile show a coherent dark arcade shell with colorful brick visuals, strong contrast, consistent panels, spacing, and clear priority from title/auth to canvas, HUD, lab, leaderboard, and events. Haiku: completed as an ungraded no-op; no criterion-level verdict is available. |
| Polish | semantic_game_state_and_events | 1.0 | PASS | FAIL | N/G | GPT: The canvas is focusable and named, and HUD values, revision, state text, mechanics table, and events exist. However, there is no live region, keyboard guidance, Assist/sync state, mechanics telemetry, personal history, or protected identity, and sign-in/launch/pause do not produce a coherent protected state. Haiku: completed as an ungraded no-op; no criterion-level verdict is available. |
| Polish | keyboard_pointer_touch_gameplay | 1.0 | PASS | FAIL | N/G | GPT: Pointer and keyboard actions are logged, but the visible paddle/ball do not meaningfully move or launch, protected controls are unavailable, and focusing the canvas caused page scrolling. Haiku: completed as an ungraded no-op; no criterion-level verdict is available. |
| Polish | canvas_and_state_readability | 1.0 | PASS | FAIL | N/G | GPT: The simple brick field, ball, and paddle are clear at both sizes, but durability and item types are not distinguished beyond color, required overlays/items are absent, and the visible scene conflicts with the semantic “Sign in to play” state. Haiku: completed as an ungraded no-op; no criterion-level verdict is available. |
| Polish | complete_product_coherence_and_reduced_motion | 1.0 | PASS | FAIL | N/G | GPT: The page loads without a fatal browser failure, but the Polly sign-in flow never reaches the game, so level/saved-run choice, identity/sign-out, sync/effects, history, restart, and protected feedback cannot form a complete product flow. Reload resets the public state; reduced-motion emulation showed no shortened animation/transition treatment, and a… Haiku: completed as an ungraded no-op; no criterion-level verdict is available. |

## Interpretation

The golden Oracle passed all 27 verifier criteria: 2 Render, 2 Constraints, 16 Functional and 7 Polish. This confirms that the current instruction contract, seed fixtures, reference implementation and verifier are mutually executable.

The untouched GPT-5.4-mini artifact scored 0.2182. It passed both hard-gate dimensions and produced a coherent responsive shell, but its signed-out bootstrap returned before binding the login submit handler. The browser therefore navigated with GET instead of issuing the required sign-in request, making every protected Functional workflow inaccessible. This is a genuine model implementation defect rather than a golden-path failure.

The Haiku run made genuine model calls and produced an application artifact, but the verifier returned an ungraded no-op zero. Earlier diagnostic attempts exposed setup and zero-context issues; the retained completed run is documented accurately without treating absent criterion results as failures.

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

- Two graded adversarial artifacts at or below 0.2 have not yet been measured; GPT-5.4-mini scored 0.2182 and the Haiku zero was ungraded.
- Four distinct rewards and reward standard deviation across eight valid runs remain unmeasured.
- The same frozen rollout has not been rescored three times under identical judge settings.
- Dedicated keyword-stuffing, injected-content and refusal-only artifacts have not been scored.
- These are optional robustness measurements, not task-source, packaging, verifier or golden-solution defects.

## Evidence locations

- Platform upload: `brickfall-breaker-arcade.zip`
- Oracle evidence: `brickfall-breaker-arcade-oracle-run.zip`
- Model evidence: `brickfall-breaker-arcade-gpt5.4-run.zip`
- Haiku evidence: `brickfall-breaker-arcade-haiku-run.zip`
- QC evidence: `Brickfall_Post_Run_QC.xlsx` and `brickfall-qc-findings.json`
