# PatchPad — bounded interaction procedures

Upload: [patchpad-editor-v2.zip](patchpad-editor-v2.zip).

SHA-256: `4612c76f2dcdb15f933b498987a1a9164e2cbf93798bd79a180146060cafd3a3`

Task name remains `patchpad-editor-v2`, version `1.0.0`. The ZIP has exactly one
`patchpad-editor-v2/` wrapper and 32 task files. Functional prompt revision is
now `r4`; the other prompt markers are unchanged. Both network settings remain
public. The judge configuration remains Codex / `gpt-5.6-luna` / max effort.

## Applied changes

Only `tests/functional/judge.toml` and `tests/functional/prompt.md` differ from
the previously uploaded working-content-gate package:

- `selection_autoscroll_exact_offscreen_range` now samples ALPHA-0010 through
  ALPHA-0013. Each mouse/keyboard leg independently establishes that the target
  starts entirely outside the viewport. Actual selection-driven scrolling is
  still required. Mouse selection may include additional contiguous trailing
  text; only the keyboard selection requires the exact four-line endpoint.
  Incorrect anchors, whole-document shortcuts and wheel/programmatic scrolling
  during selection still fail. Setup may use normal scrolling.
- `multi_caret_backspace_delete_sibling` now uses two adjacent visible lines,
  Customer impact and the next sentence. It still checks both deletion keys at
  every active caret, exact results, one Undo per deletion, unchanged non-target
  content and unchanged saved content after reload. All carets must be inspected
  at the requested boundaries before the keypress; a primary-caret status label
  alone is insufficient.
- Shared Functional guidance distinguishes mouse endpoint tolerance from the
  exact keyboard endpoint, and requires per-caret setup evidence.

This is the requested sample-size reduction, not a removal of the features.
Offscreen selection remains graded through both mouse and keyboard. Multiple
carets still affect Backspace and Delete; the separate three-caret typing,
Undo and Redo criterion remains unchanged.

## Preservation and independent review

Two Astra/high reviews informed these changes. The final read-only comparison
found no concrete new instruction/verifier mismatch in the applied edits.

All 39 criterion IDs, names, order, types and weights remain intact:
2 Render, 2 Constraints, 27 Functional, 3 Polish and 5 Visual. Total Functional
criterion weight remains 20.75. The other 25 Functional descriptions are
byte-identical. All instructions, seed data, golden source, other dimensions,
working-content gates, runner, reward formula, Dockerfiles and task.toml are
byte-identical to the previous release. This preserves the earlier fixes; it
does not guarantee the platform will repeat its prior rubric verdicts.

## Fresh validation

- **118 repository structural/standard checks passed.**
- **50 browser PASS observations across eight isolated regression suites.**
  These include seed/custom input, unsaved discard, no-op saves, exact cursor
  navigation and visible line numbers, word navigation, indentation, Unicode,
  clipboard and Undo/Redo, Find/Replace and Escape/focus behavior, three-caret
  typing, long-document saves, fresh clients, revision preview/restore/Undo,
  chained stale saves, server rejection/nonmutation and manifest routes.
- The lifecycle tests performed two actual restarts per restart suite and
  compared complete saved document/revision/history data. The server-delivery
  suite also verified the shared working-content gate and a dead-shell negative
  control without losing prior read-delivery fairness coverage.
- **13 targeted diagnostic groups passed** in `bounded-results.json`: each
  revised criterion passed three independent fresh-page repeats; both original
  larger samples also passed three repeats; one deliberate mis-targeting test
  reproduced the historical Delete output. That last group is diagnostic
  evidence, not a passing application feature. Every group includes a final
  reload/full-draft comparison and an independent stored content, revision and
  complete history comparison.
- Shell syntax for solve.sh, test.sh and app-lifecycle.sh; JavaScript syntax for
  client, server and database; unchanged executable source hashes after setup.
- Actual runner readiness, empty-submission zero behavior and all current
  prompt/judge/runner/reward hashes verified. A trusted local stub injected
  scores to test the final runner formula; its resulting 0.58 is synthetic,
  not an Oracle score.
- **27 synthetic reward/CTRF combinations passed; 40 malformed/missing score
  cases were rejected.**
- ZIP CRC, exactly one wrapper, exact source-file set and every archived source
  hash verified. No credentials, database, node_modules, caches, diagnostics,
  authoring notes or reports are included. Historical archives were untouched.
- `git diff --check` passed for PatchPad source.

The earlier nine-group review script was also rerun successfully after editing;
it is supplemental evidence in `results.json`, not included again in the 13
targeted-group count.

## Limits and next platform run

No paid Oracle, model run or platform semantic QC was launched. These local
helpers exercise every Functional behavior family, but do not reproduce every
judging/evidence detail of all 27 criteria. See the coverage map for exact
remaining gaps. No claim of Functional 1.0 or a full Oracle pass is made.

Tests used the current read-only task source in fresh offline disposable
containers with cached `patchpad-preflight-tests:2.0.9` tools. This isolates
local diagnostics; the packaged agent and verifier networking remain public.
Both Dockerfiles are unchanged, but no fresh exact-Dockerfile builds were run
for this release. Cached-image tests do not establish those builds.

Judge focus/targeting, tool latency, clipboard handling and interpretation are
still risks. The smaller samples and explicit checkpoints reduce ambiguity;
the platform must judge this exact ZIP to establish new QC and Oracle scores.
Existing user preview containers, unrelated tasks, old reports and ZIPs were
not altered. No commit or push was performed.

Evidence:

- [Package/source hashes and scope](package-audit.json)
- [Exact verifier changes](verifier-changes.diff)
- [All 27 Functional criteria coverage map](FUNCTIONAL_COVERAGE.md)
- [Broader browser results](regression-results.json)
- [Targeted repeated results](bounded-results.json)
- [Structural checks](standard-checks.json)
- [Runner/reward checks](runtime-check.json)
- [Current prompt provenance](prompt-provenance.json)

Reproduction helpers are `run-regressions.py`, `bounded-interactions.cjs`,
`check-runtime.py`, and `package.py`. They belong to delivery evidence, not
the uploaded task.
