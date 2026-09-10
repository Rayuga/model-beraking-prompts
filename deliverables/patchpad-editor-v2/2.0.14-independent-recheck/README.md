# PatchPad 2.0.14 independent recheck — September 10

Result: the fresh unpaid current-source regression completed with exit 0.
No additional reproducible golden-solution defect was found. No task source,
verifier, weight, requirement, release marker, or delivered ZIP was changed.
This is evidence for retrying platform QC/Oracle, not confirmation of Oracle 1.0.

## Fresh checks completed

- All 41 read-only archive/configuration checks passed: all 30 task files match
  both the delivered ZIP and the prior source hash inventory. Both networks
  remain public, the verifier is separate, and all 35 criteria remain.
- Shell/JavaScript syntax, RewardKit discovery, empty-submission handling and
  the real manifest parser passed.
- Eight historical Oracle failure-path browser regressions passed, including
  Unicode, clipboard cut/paste, Find, multi-caret and revision restore/Undo.
- Fourteen broader editing, persistence and server-rejection regression groups
  passed, including exact mouse word/line/range selection, grouped typing,
  Redo invalidation, long-document round trips and selection autoscroll.
- Two real server process replacements preserved exact saved document and
  history; missing-route and destructive-reseed negative controls were caught.
- Browser variants, three later Oracle regression cases and four brief-alignment
  checks passed. The real runner was tested with a trusted score stub, not a
  paid judge; the stub aggregate is not an Oracle score.
- Thirty reward combinations, sixteen invalid-value rejections and custom
  surface fixture checks passed.
- Six latest diagnostics passed: dirty state before reload, both Find focus
  routes for Unicode, both Escape directions, Redo availability/nonmutation,
  and Replace Current followed by exactly 99 replacements.

See `regression-1.log`, the per-suite JSON results, `regression-result.json`,
and `archive-recheck.json`. Validation scripts were copied into this new folder
so historical reports and releases were not overwritten.

## Limits and recommendation

Tests use current mounted source with the existing
`patchpad-preflight-tests:2.0.9` local tool image, offline and unpaid. They do not
prove an exact 2.0.14 Docker image build. The previous fresh-build attempts were
blocked by local proxy DNS; builds/bootstrap were not retried here.
No official platform QC or full Codex browser-judge run was performed.

The previous Oracle's incomplete focus/clipboard/coordinate observations remain
a platform execution risk, even though their requested behavior passes locally.
Read-only DOM/clipboard measurements in these deterministic tests do not prove
the LLM judge will choose and complete identical gestures. Polish grading also
retains a judgment component. Do not promise an exact score of 1.0.

Recommendation: submit the unchanged 2.0.14 archive for fresh platform QC and
Oracle. No further source edit is justified by this recheck.

Existing ZIP: `../2.0.14-oracle-repair/patchpad-editor-v2.zip`

SHA-256: `1703dec77e9f275e38664c07a72db54613a7017f65333d35fbb90fbf55ac2570`

No additional ZIP was created.
