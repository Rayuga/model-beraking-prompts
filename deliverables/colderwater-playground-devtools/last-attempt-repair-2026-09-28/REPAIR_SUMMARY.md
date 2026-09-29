# Colderwater reduced-scope candidate — 2026-09-28

This supersedes the coverage-fix candidate. It is a locally checked review ZIP, not a hosted QC pass or a measured Oracle score. No portal attempt was used.

[Review ZIP](review-candidate/colderwater-playground-devtools.zip) · [53-row table](QC_53_ROW_TABLE.md) · [QC workbook](QC_REVIEW.xlsx) · [requirement map](REQUIREMENT_MAP.md)

ZIP SHA256: `7d176c9af6e57873c32cd1ea4b966fe89e6da181a525339c9676ebeb9871cd94`.

## What changed

The earlier task accumulated too many independently scored requirements and complicated browser protocols. This repair reduces the requested product scope as well as its tests. It does not silently stop grading features that the brief still demands.

| Dimension | Before | Now |
|---|---:|---:|
| Render gate | 1 | 1 |
| Constraints gate | 1 | 1 |
| Functional outcomes | 93 | 57 |
| Shared Functional protocols | 37 | 23 |
| Polish outcomes | 4 | 7 |
| Visual outcomes | 6 | 6 |

Functional weight totals32.70; Polish remains4.0 and Visual6.0. Dimension shares stay60/20/20. The larger Polish count splits labels, reachability, focus and navigation without increasing their combined weight.

Core execution/isolation, CSS copying, cancellation, last-good recovery, errors, console, Auto-run, title validation, server save/load, concurrent Save recovery and restart durability remain. Removed workflows include separate Rename/Duplicate/Delete, import/export, navigation discard warnings, pending-interaction deadline nonextension, and several editor conveniences. The hidden CSS-global and internal-file classification requirements were also removed from both public request and rubric. See `changes.json` for all36 removed outcome IDs.

All23 golden files are unchanged; the golden can retain optional features. `tests/test.sh` is restored byte-for-byte to the template. Both Dockerfiles, scoring policy, shared tools, verifier environment and judge headers/budgets match the template. No timeout increase or functional-floor change was made.

## Seven last reported failures

| Previous finding | Current treatment | Remaining limit |
|---|---|---|
| Timeouts fit the work | Reduced93->57 outcomes and37->23 protocols. Planning estimates drop about715->366 UI actions. Shared observations avoid repeated setup. | Full configured-judge timing is unmeasured. The scripted95.4-second run does not establish LLM completion within9000seconds. |
| Entrypoint safe / always scores | Removed task-specific `validate_suite` and special incomplete-prefix handling; restored canonical harness. | The mandatory template still has a whole-suite/process-error zero fallback. No claim that all provider failures preserve scores. |
| Missing requirement coverage | Added an actual looping Promise callback to the timeout/rollback protocol. Removed no-longer-graded requirements from public notes. | Retained behavior mapped in REQUIREMENT_MAP.md; local tests are not hosted reviewer interpretation. |
| Independent criteria | Split Polish names/reachability/focus/navigation; retained separate Functional message/line/rollback and stale-server/draft outcomes. | Shared positive controls remain necessary evidence, not inherited verdicts. |
| Browser decidability | Removed hidden execution-realm and private-file classification probes. Replaced8vs9second observation with positive nested-timer completion control and a forbidden late marker. | Real scheduling/tool reliability can still vary; no hidden-state/source classification is required. |
| Self-consistent descriptions | Removed conflicting incomplete/exposure/architecture branches. Each retained outcome has one observable boundary. | Some protocols supply shared setup, but each row owns its result. |
| Graded reward | Canonical shaping retained. A synthetic lost0.2-weight Functional row yields0.9963, rather than zero. | Arithmetic fixture, not evidence of actual model score spread or provider recovery. |

## Fresh local evidence

- `audit.json`:79 local source/runtime/scorer assertions pass. This is not the portal's48 private checker executables.
- `golden/run-golden-20260928-124124/RESULTS.json`:57/57 retained Functional assertions pass, zero missing facts, including one actual canonical restart MCP call. App launches unprivileged from `/tmp`; old `/app`-CWD assumption is not used.
- `focused/results.json`:Promise-loop termination/rollback, nested callback deadline and console-history checks pass.
- `focused/ui-results.json`:both gates and seven usability checks pass, including clean-context server retrieval, actual keyboard traversal/focus and mobile execution.
- `focused/desktop-dark.png`, `desktop-light.png`, `mobile.png`:rendered evidence reviewed. No exact Likert score is claimed.
- `scorer-cases/`:seven synthetic inputs passed through the actual canonical score.py; no model verdicts are fabricated.
- `review-candidate/candidate_manifest.json`:50 files, one archive root, CRC, Unix shell modes and extracted-file hashes verified.
- All53 quality rows and48 deterministic checker names have dispositions. Quality results:35 local Pass,18 Note. Notes are deliberate limitations; this is not an all-green certification.

The initial focused test looked for timeout text in the status bar instead of the console; its failure is preserved in `focused/results-first-attempt.json`. A separate UI test needed to carry the already-observed library URL into its independent-context helper. Both were local driver corrections; no app behavior was changed to accommodate them.

## Model score and upload decision

No new target-model score or actual Oracle grade was measured. With passing gates and full Polish/Visual, the standard reward is `0.4 + 0.6 * functional`. Functional0.25 gives0.55; Functional0.50 gives0.70; Functional0.75 gives0.85. A final score below0.70 therefore needs Functional below0.50 when those two dimensions are perfect. The retained runtime and conflict requirements remain difficult, but scope reduction changes normalization and may raise some models' scores. Do not promise a target range from these tests.

This is the latest locally checked candidate. It addresses the known source causes more directly than the previous patch sequence. The last portal attempt remains untouched. The remaining decision is whether to submit with explicitly unmeasured judge timing/interpretation, or first obtain a valid configured-judge run. Local provider authentication was previously rejected; no new paid call or unrelated credential search was attempted.

## Regression rules for the next edit

1. Do not change template harness, budgets, scorer or floor to accommodate a large task. Reduce public product scope and matching rubric together.
2. Keep observable positive controls and independent outcome credit. Do not add hidden runtime-state classification or custom incomplete-result zeroing.
3. Run `python scripts/check_colderwater_regressions.py projects/colderwater-playground-devtools` before packaging. Historical structural guards remain available for historical archives; the current dispatcher uses `check_colderwater_current.py`.
4. Recheck requirement coverage, all53 QC dispositions and the exact archive hashes after semantic edits. A passing local script is not proof of hosted QC or Oracle1.0.
