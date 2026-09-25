# Dropline visual repair and model review

Date: September 14, 2026. Task/version: `dropline-four-connect` / `1.0.0`.

ZIP: `dropline-four-connect.zip` beside this file.

SHA-256: `4d6394167dfb39b97265f29d9ddf076357c1a05b42ccb65e5e0b3d851e845294`

Exactly one wrapper with 36 task files. CRC and all archive/source byte comparisons passed. Historical deliveries and exported runs were not modified. `source-before-visual/` is the preserved baseline.

## What changed

Only three golden presentation files changed: public/index.html, public/analysis.js and public/analysis.css. Backend rules, seed, instructions, all verifier descriptions, IDs/types/weights, prompts, runner and Docker/task configuration are unchanged.

- Analysis now uses the same dark palette, board colors and component treatments as the competitive game/replay.
- Wider history column avoids narrow single-line labels breaking awkwardly.
- Archive/replay is a full-width section, with the selected replay beside the archive rather than below ten matches on desktop; mobile stacks the two.
- Analysis board/actions and variation notebook are grouped side by side on desktop and stacked on mobile. Comparison boards retain their paired/stacked layout.
- Saved-study names and titles wrap, including a tested 60-character name; selects have consistent styling. Normal scrolling inside text inputs is retained.

This is NOT a tougher-requirements release. See RUN-REVIEW.md for the recommended substantial feature expansion and the existing coverage gap found in GPT's artifact. A new feature scope should be agreed before changing the brief/verifier/golden together.

## Supplied platform results

Oracle 0.9583 (Functional 1, Polish 1, Visual 0.7917); GPT-mini 0.7935; Gemini 0.8407; Haiku 0.2361; no-op 0. All five current verifier file pairs match the hashes logged by these runs. These scores precede this presentation update and do not validate its new appearance.

RUN-REVIEW.md covers every reported deduction. run-review.json retains every scored criterion including passes. gpt-fairness.json records local reproduction disputing three reported deductions, confirming focus/type-validation defects and identifying missing same-name-creation coverage. This is diagnostic evidence, not an official regrade. No scores were overwritten.

## Fresh unpaid tests

- 121 shared standard checks passed, with 42 criteria: Render 2, Constraints 2, Functional 27, Polish 5, Visual 6.
- 27 regression groups passed against final source in local-run-attempt3.log / regressions.json: authentication/seed, wins/draw, undo/redo, archive, persistence, browser focus, duplicate protection, conflict/retry/ownership, all analysis operations and the existing lifecycle helper performing two real restarts around Redo.
- Authored JavaScript, inline browser JavaScript and shell syntax passed.
- Current test.sh was exercised with a local unpaid RewardKit stand-in; its 0.58 reward is synthetic fixture output, NOT Oracle. Five-dimension CTRF and prompt provenance were checked.
- Three layout checks passed at 1280x800 and 375x760: populated replay/analysis, 60-character names, no horizontal page overflow, shared palette, complete 42-cell boards and reduced-motion media. Screenshots are beside this report and were visually inspected.
- Local GPT reproduction used an unmodified copy of the exported app, real sign-in forms and physical pointer input. Pending tests held the actual server response without changing it. Test data remained in disposable containers; exported artifacts were untouched.

## Limits

No paid model/Oracle or platform rubric QC was run. Exact Dockerfiles are unchanged; fresh builds were not retried this turn. Tests used cached dropline-verifier-local:v6.0.3 plus a Chromium executable-path symlink. This is not evidence that a fresh image build succeeds. The first local attempt stopped because the cached image lacked the declared Chromium symlink; after adding that test-environment shim the final regression run passed.

The layout screenshot harness initially had an incorrect 61-character fixture for its intended 60-character test; corrected before final evidence. No application requirement was relaxed. All layout claims refer to the tested views and names, not every possible user state. Visual 1.0 and a future GPT-mini score below 0.70 cannot be guaranteed by these tests.

Golden preview is available at http://localhost:3040 while container dropline-visual-20260914 remains running. Use jordan@dropline.test or avery@dropline.test, password password123. The preview includes disposable regression data, not pristine seed state.
