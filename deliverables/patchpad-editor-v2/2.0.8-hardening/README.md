# PatchPad 2.0.8 — final local hardening

This is fresh unpaid local evidence, not a platform QC verdict or Oracle score.
Use the ZIP in this directory, not a previous release. SHA256SUMS.txt and
package-audit.json identify the exact archive and every included source file.

## Changes from 2.0.7

Two genuine golden defects were reproduced before repair:

- Clicking immediately after a combined accented character then Backspace
  left a detached accent (A + combining acute + B instead of AB). Mouse hit
  testing now measures rendered complete grapheme boundaries rather than
  interpreting glyph widths as UTF-16 code-unit positions.
- Copying Timeline, emptying the system clipboard, and pasting inserted stale
  cached Timeline text. A successful empty clipboard read now stays empty;
  fallback applies only when the clipboard API is unavailable or fails.

These defects do not prove the cause of the historical Oracle failures because
the full judge action trace was not exported. The 2.0.7 focus, clipboard timing,
separate mouse gesture and replacement-field guidance remains unchanged.
Earlier saved-state, asynchronous save, full preview, restore/Undo, clicked
command focus and server document-id rejection repairs are retained.

No instruction, criterion, assertion, weight, reward formula, seed, dependency,
timeout or network policy was changed in 2.0.8. All 35 criteria remain:
2 Render, 2 Constraints, 27 Functional, 4 Polish. Both networks are public;
the separate verifier uses Codex, openai/gpt-5.6-luna, high reasoning.
There is still one restart helper, and the explicit readiness probe is retained.

## Fresh tests passed on this source

- Both final Docker images built successfully with cached dependencies.
- Shell and golden JavaScript syntax; RewardKit discovery of all 35 criteria.
- Empty submission yields zero without model invocation.
- Manifest parser: five valid cases accepted, six invalid cases rejected;
  unrelated backup preserved.
- Twenty-two local browser groups: six QC/focus checks, six baseline smoke
  checks, two restart/documentation checks, eight earlier Oracle failure paths.
- Fourteen additional browser groups: mouse/keyboard/offscreen selection,
  clipboard and atomic Undo, exact save/fresh client, long-document persistence,
  preview/restore/Undo, save-in-flight edits and server rejection/nonmutation.
- Six new browser variants: keyboard Find/Escape Unicode deletion; clicked
  combined accent; empty clipboard; clicked emoji, joined emoji and flag with
  deletion, Undo and exact Shift-selection clipboard checks.
- Actual runner orchestration with a trusted local score stub: two restarts,
  final cleanup and reward aggregation. The injected score is NOT an Oracle.
- Disposable destructive-reseed and missing-route-documentation copies were
  both rejected by the local regressions.

Groups overlap; their count is not a 35/35 platform Oracle verdict. Local
containers had external networking disabled to prevent paid calls; the shipped
agent and verifier network settings remain public.

## Haiku and other model evidence

Haiku run-32a383d4 on 2.0.6 failed the explicitly documented manifest contract:
it omitted the required SQLite path: declaration. It was rejected before
browser grading (graded=0), not a legitimate zero across the feature criteria.
No task-side parser defect was found. Do not weaken the parser or repair that
captured model artifact and present it as an untouched model score.

GPT run-a6f18db0 scored 0.5846 and Gemini run-d8826205 scored 0.7554. Both were
completed grades on identical 2.0.6 task checksums. These are historical results,
not measurements of 2.0.8. GPT met the stated target band on that older version.
Some verdicts warrant focused review (Gemini no-change toast, GPT stale-tab
setup and combined history-route documentation); no scores were relabelled.

## Remaining steps and limitations

Upload this archive for fresh platform QC and Oracle. Only a completed Oracle
can establish the reference score; local passes cannot guarantee 1.0.
The latest instruction/model policy overrides older rubric network guidance,
but the platform may still flag public networking. No actual platform checker
or paid judge was run locally.

For same-version submission evidence, GPT must be evaluated against the final
verifier version (regrade the untouched artifact if the platform supports it;
otherwise a fresh run). Haiku needs another valid run if completed browser
grading is required; its missing manifest is a model-output defect. Gemini
has no separately established acceptance band beyond any applicable admin rule.

The clean ZIP contains exactly 30 task files under one patchpad-editor-v2/
wrapper. Reports, credentials, databases, node_modules and caches are excluded.
Historical reports/ZIPs, model artifacts, GridForge and shared files are unchanged.
