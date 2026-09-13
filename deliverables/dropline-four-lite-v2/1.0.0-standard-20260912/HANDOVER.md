# DropLine v2 preparation — 12 September 2026

## Package

- Source: `projects/dropline-four-lite-v2`.
- Task name: `turing/dropline-four-lite-v2`; task version: `1.0.0`.
- Upload ZIP: `dropline-four-lite-v2.zip` in this directory.
- SHA-256: `70bec9871a565da1ef2880042066aa8923dd9f9154a0fffb6c56cc96a8de26cf`.
- Exactly one `dropline-four-lite-v2/` wrapper, 32 files, CRC checked and every archived file matched against its source SHA-256.
- No databases, dependencies, caches, credentials, validation scripts, reports or authoring notes are packaged. The required platform key placeholder appears only in task.toml.
- The original `projects/dropline-four-lite` was preserved byte-for-byte against the pre-change baseline. Its historical deliveries and runs were not changed. No PatchPad, GridForge, Brickfall or shared-template files were edited for this work.

## Changes

The new task adopts the current repository standard: public agent and separate-verifier networking, native platform `OPENAI_API_KEY` placeholder, Codex / `gpt-5.6-luna` / max effort, and the reference timeout and resource settings. No individual judge/model override remains in the dimension files. Both Dockerfiles and test.sh contain no provider-key setup or remapping.

There are 30 criteria: Render 2, Constraints 2, Functional 16, Polish 4 and Visual 6. The final formula is exactly `0.6*functional + 0.2*polish + 0.2*visual`, hard-zeroed when Render or Constraints is zero. Visual uses six anchored Likert criteria; functional rule checks remain binary. All 13 original Functional criterion weights are retained. Added coverage addresses accessible winning-cell names, actual process restart persistence, and runtime-route documentation. The draw check now explicitly covers terminal undo/redo as required by the existing brief.

Instruction files move into `environment/assets/instructions` and are still mounted at `/instructions`. Development installs and public browser resources are allowed, while authentication and durable game state remain on the local Node/SQLite server. The brief now documents the manifest and DB_PATH override used by the runtime launcher.

Presentation dimensions perform read-only inspection and replay, avoiding new games, moves or other changes to the shared seeded state. Functional checks seed first and uses relative totals/revisions afterward. Every prompt has the shared authenticated working-app gate, public-resource policy and version marker. Cross-tab logout accepts proactive sign-out as well as sign-out on the next protected request. Duplicate-click checks establish a genuinely pending request rather than penalizing two completed sequential actions.

The new lifecycle helper restarts only the managed application, preserves its database and updates PID metadata for cleanup. It is used by one restart criterion. The golden application's gameplay implementation is unchanged; its package identity/version and manifest were updated, and one non-executable inline comment was removed.

## Validation actually completed

- 109 local standard checks passed on the final source; see `standard-check.json`.
- Bash syntax passed for test.sh, app-lifecycle.sh and solve.sh. Node syntax passed for server.js and the local regression harness. Every packaged TOML parsed; embedded runner Python blocks parsed.
- 10 reward-postprocessing cases passed: all-one, either gate zero, partial-positive gates, missing Visual, boolean, NaN, infinity, out-of-range and string inputs. CTRF includes five dimensions. See `package-verification.json`.
- 17 unpaid API/real-Chromium regression groups passed on the final source. See `regressions.json` and `runner-logs/rewardkit.log` for exact groups. They include both seeded accounts, eight color/direction win sequences, a 42-move draw, full-column rejection, score/archive reversal and restoration, repeated undo/redo and branching, duplicate receipts, stale conflict replay, real keyboard controls and winning-cell accessibility, two browser sessions, delayed-response duplicate activation, account-wide logout, mobile/reduced-motion replay, and two real process restarts preserving game/redo/archive/session data.
- The actual test.sh launched the golden app as uid 65534, performed readiness checks and invoked a local substitute for RewardKit. The substitute runs the regression suite and supplies deliberately synthetic dimension values. The resulting **0.58 is a formula fixture, not an Oracle or model score**.
- Desktop and mobile screenshots were captured; the mobile screenshot was visually inspected. Read-only presentation/replay left Jordan's seeded state unchanged.
- Final archive contents and source hashes verified; original source unchanged.

## Limitations and next step

Both exact Docker builds were attempted but did not complete: the agent build could not resolve the configured local corporate proxy for Debian packages, and the verifier build timed out accessing PyPI. Local runtime testing used cached `dropline-verifier-local:v6.0.3`, with the current task/runner mounted and a browser symlink added to match the new template path. This establishes useful application/runner evidence, **not** a successful build of either new Dockerfile or paid-judge compatibility. Fresh image builds must succeed on the platform before evaluation.

One repeat initially encountered the diagnostic Node client's pooled socket closing during a server restart. The app had restarted; the harness was changed to use fresh HTTP connections, and the final complete run passed. No result was inferred from that failed read.

The upload-check DOCX and relevant source-QC/rubric entries were reviewed, but the platform's full static/rubric suite was not executed here. The older rubric wording about banning off-origin browser assets conflicts with the newer explicit public-runtime policy; this package follows the newer policy. Source checks alone do not establish timeout sufficiency, subjective Visual scores, injection resistance or model-score ranges. Exhaustive malformed-input/identity-forgery matrices and every browser/OS were not tested.

No paid Oracle or model was launched. Historical results belong to the original four-dimension task and must not be presented as validation of this five-dimension v2. Upload this ZIP for fresh platform static/QC, then Oracle and model runs. Oracle 1.0 and model scores are not guaranteed.

## Coverage guide

| Requirement group | Main grading coverage |
| --- | --- |
| Sign-in, hidden protected data, reload, health | Shared gate, Render, Constraints, authenticated_account_workflow |
| Workbook state and account isolation | seeded_state_import_and_isolation |
| Gravity, full columns, all win directions, draw, terminal lock | Five gameplay criteria |
| Durable history, branching, score reversal and new-game reset | move_history_undo_redo_branching, exact_draw_and_terminal_lock, new_game_reset_and_persistence |
| Archive counts, ordering, terminal removal/restoration and replay state | completed_match_archive_and_replay, seeded_state_import_and_isolation |
| Keyboard game operation and named winning cells | keyboard_focus_and_activation, accessible_grid_and_winning_names |
| Revision conflicts, success/rejection receipts and pending duplicate input | multi_tab_revision_and_duplicate_guard |
| Revocation of independent account sessions | cross_tab_sign_out_revocation |
| Real process restart and manifest routes | restart_persistence_and_seed_idempotence, runtime_manifest_routes |
| Replay interaction, responsive usability, motion and focus | Four Polish criteria |
| Typography, color, spacing, hierarchy, craft and responsive appearance | Six Visual criteria |
