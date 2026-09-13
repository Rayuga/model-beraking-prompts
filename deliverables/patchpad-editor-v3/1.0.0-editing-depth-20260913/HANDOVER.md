# PatchPad v3 — editing-depth candidate, 13 September 2026

Source: `projects/patchpad-editor-v3`. Original `projects/patchpad-editor-v2`
is unchanged, checked against `v2-baseline.json`. Previous runs and delivery
ZIPs were not edited. This is a new task, not a regrade of a previous run.

Upload archive: `patchpad-editor-v3.zip`, exactly one matching wrapper, 32 files.
SHA-256: `a3511a525675554aaa1ee89b5e77fb69ad4f7a94a1fc68b7d137bc39053439a6`.
`package-verification.json` records every source/archive hash and CRC verification.
Credentials, databases, node_modules, caches, authoring scripts and reports are
excluded. The required platform credential placeholder is present only in task.toml.

## What changed

The user requested a genuinely harder PatchPad after two GPT runs exceeded the
target band. This version adds editing depth rather than changing the reward
formula, reweighting previously failed checks or demanding undocumented behavior.

1. Multi-line Tab/Shift+Tab indents/outdents every selected line, preserves
   existing content/indentation and the block selection, excludes the next line
   when selection ends at its start, and supports atomic whole-block Undo/Redo.
   The brief allows a consistent indentation unit; the judge accepts tabs or
   spaces rather than the golden implementation's two spaces specifically.
2. Replace All has whole-document atomic Undo/Redo. A new edit after Undo must
   invalidate Redo. Saved data remains unchanged until Save.

Both requirements are stated in `environment/assets/instructions/editing.md`
and have distinct Functional criteria, weight 1.0 each. The original 27
Functional criterion weights are unchanged. There are now 41 total criteria:
Render 2, Constraints 2, Functional 29, Polish 3, Visual 5. Functional weight
totals 22.75. The formula remains 60% Functional, 20% Polish, 20% Visual, with
the existing Render/Constraints gates.

The golden editor now implements block indentation with preserved selection
and snapshot-based atomic history. Its existing Replace All implementation
already met the new history requirement and was verified through real keys.
Original single-line indentation behavior is retained.

Fairness correction: no-op Save still must preserve exact content, revision,
history count and saved status, but no longer demands a disabled button or an
extra no-changes notification absent from the brief. This correction may raise
some legitimate model scores; it is not hidden or reversed to meet a target.

All existing API-discovery, Find conventions, focus, clipboard, bounded
offscreen-selection and multi-caret guidance remains. Presentation still uses
the PatchPad desktop-only exception. Public resources are allowed; the custom
editor and local Node/SQLite requirements remain. Prompts explicitly accept
both same-origin document responses and server-rendered HTML without imposing
a separate read API. Version markers and package names identify v3; task.toml
version remains `1.0.0` per the current standard. Native platform key mapping,
Codex / gpt-5.6-luna / max, timeouts and resource limits are unchanged.

## Validation completed

- 120 local standard checks passed (`standard-check.json`).
- All packaged TOML parsed; shell syntax passed for test.sh, app-lifecycle.sh
  and solve.sh; Node syntax passed for the changed golden JavaScript.
- Four real-browser groups passed (`new-requirements-results.json`): forward
  block indentation with retained endpoint and atomic history; reverse block
  selection including a blank line; Replace All Undo/Redo and branch invalidation;
  no-op Save invariants and original single-line indentation.
- Thirteen existing interaction regression groups passed (`bounded-results.json`):
  original/current multi-caret deletion and Undo, original/current mouse and
  keyboard offscreen selection, three repetitions of each, and a negative
  control demonstrating that intentionally misplaced carets reproduce wrong text.
  The prior diagnostic script was read-only and did not alter the task source.
- Golden tests ran in an isolated container from cached
  `patchpad-preflight-tests:2.0.9`, using the new source and seed, real Chromium
  keyboard/mouse/clipboard actions and live Node/SQLite responses. No paid judge
  was called. Full before/after document comparisons checked unrelated text.
- Clean ZIP contents match current source SHA-256 values; v2 baseline unchanged.

## Remaining validation

Both exact image builds were attempted. The agent build failed resolving this
machine's configured corporate proxy for Debian packages. The verifier build
encountered repeated PyPI connection timeouts. Logs are in this folder. Cached
image tests do not establish that the new Dockerfiles build successfully.

The platform's full static/rubric suite and an Oracle run have NOT been completed
for v3. The complete 29-criterion functional journey, new-version restart/save
conflict matrix and subjective Visual grading were not rerun through a judge.
The focused browser regressions are not an Oracle score. Historical v2 Oracle
1.0 and GPT 0.7253/0.7632 do not validate this new version or predict its score.

Next: fresh platform QC and image builds, then Oracle and comparison models on
this exact ZIP. Retain all outcomes. There is no guarantee GPT will fall at or
below 0.70 or Oracle will achieve 1.0.
