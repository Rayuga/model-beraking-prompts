# Pellmoor atomic batch offers — implementation and validation

The requested extension is implemented in the task brief, golden backend,
golden interface and verifier coverage. The task is packaged as a candidate
for fresh evaluation. No new Oracle or GPT score is claimed.

## Delivered behavior

Ruth can select applicants, inspect their current assessments and review current
and projected reserved/filled/available capacity. Planning is read-only. One
confirmation offers the complete ordered selection or changes nothing. The
server validates every applicant and aggregate capacity inside the existing
SQLite write transaction, advances the vacancy revision once and records one
linked, attributed stage event per applicant.

Batch writes share revision arbitration with individual writes. A stale review
is refused without automatic resubmission. Selection survives the rejection;
the person explicitly reviews again before a new confirmation. An uncertain
transport outcome keeps the original selection, revision and operation ID for
an explicit retry. Durable success/rejection receipts remain historical after
later actions, capacity release, logout and restart. The UI refreshes current
server state after acknowledgement instead of displaying an old receipt as the
current pipeline.

Selection, review, blocked, pending, uncertain and completion states follow the
existing light/dark layout. The review shows the full capacity projection.
Applicant names, identifiers and receipt text wrap on narrow screens. Keyboard
focus stays in the batch dialog and returns to its entry control on dismissal.
Batch details are visible in candidate activity. The sign-in screen now has an
explicit main landmark.

## Rubric and task consistency

See `TASK_OUTLINE.md` and `RUBRIC_MAP.md`. The executable rubrics remain the
five `tests/<dimension>/judge.toml` files. There are 60 criteria: Render 2,
Constraints 2, Functional 40, Polish 10 and Visual 6. Eight new Functional
criteria cover the distinct batch outcomes; all original IDs and weights remain.
Functional criterion weight totals 98.0, including 19.5 for the new workflows.
The existing shared restart and final receipt check include batch receipts.

All five prompts have updated revision identifiers. Render and Constraints keep
their original smoke/entry scope. Polish and Visual now inspect read-only batch
selection and review on existing records, with no offer commits or database
resets. Visual retains the six existing anchors and grades appearance from
screenshots, not source or conformity to golden pixels. A truthful blocked
review is valid presentation setup when current applicants are ineligible.

Version 1.0.0, operational key structure, verifier environment, max judge effort,
five verifier directories, timeouts, serial execution and the gated 60/20/20
formula are preserved. Requirements are agent-visible; no hidden route shape,
fixed race winner, generated candidate ID or manipulated score is required.

## Completed local validation

| Check | Result | Evidence |
|---|---|---|
| Configuration standard | 139 checks passed | `standard-qc.json` |
| Existing core behavior | 19 regression groups passed | `regressions.json` |
| Existing assessment/capacity/retry behavior | Nine groups passed | `hardening-regressions.json` |
| New batch workflow | Ten groups passed, including real UI setup, both races, lost response and managed restart | `batch-regressions.json` |
| Golden negative-control baselines | All seven passed | `mutation-controls.json` |
| Deliberately broken variants | All seven detected | `mutation-controls.json` |
| Existing layout | 1280, 390 and 320px, both themes; SVG text and control bounds checked | `visual-regressions.json` |
| Batch ready review | All three widths and both themes | `batch-review-*.png`, `batch-regressions.json` |
| Batch selection / blocked review | All three widths and both themes; keyboard traversal and cancellation passed | `batch-presentation.json`, screenshots |
| Authentication gate | Anonymous reads before/after wrong-password UI attempt, correct login and refresh passed | `gate-regression.json` |
| No-op | Zero reward, graded=0, no_op=1 | `noop-logs/` |
| Actual reward postprocessor | Eleven valid/invalid cases passed | `package-verification.json` |
| Real runner with a local rewardkit stub | Synthetic 0.58 and five CTRF dimensions | `runner-logs/` |
| Frozen ZIP | 32 task files, one wrapper, exact source-byte match | `package-verification.json` |

The seven negative controls deliberately introduce a partial batch write,
missing aggregate capacity check, ignored stale revision, wrong ordered audit
position, ignored saved receipt, silent UI revision refresh, or new retry
identity. Each corresponding probe passes against the golden solution and
fails against the broken copy. The mutants exist only in disposable containers;
they are not in the task ZIP. These results validate the local behavioral probes,
not the consistency of an LLM judge on future runs.

The first extra keyboard presentation check exposed Shift+Tab leaving the
native dialog. That result is preserved in
`batch-presentation-before-focus-fix.json`. Explicit focus containment was added,
then the presentation checks passed. Earlier workflow, transport and race
checks passed; the final focus-only change was validated with the targeted
keyboard suite rather than repeating unrelated backend tests.

All local browser/runtime checks use the cached `pellmoor-tests:2.0.3` image:
`sha256:cd99ba75c15926810073b209e6a54d3159bfa17b82af4e28647becaec7033b13`.
The golden app was compiled inside that runtime. Tests used normal product
requests and genuine accounts; successful workflow setup was also exercised
through the UI. The test-only rewardkit stub is outside the ZIP. Synthetic
reward 0.58 is an aggregation smoke test, not an Oracle score. Local suites use
separate disposable databases; the actual Functional judge journey uses its
single shared restart as specified by the rubric.

## Build and evaluation limits

Both exact Dockerfile builds were attempted against this revision's environment
and verifier contexts. The environment build failed resolving the configured
package proxy; the verifier build repeatedly timed out reaching PyPI and then
failed dependency resolution. A direct PyPI connectivity probe also timed out
during TLS. These are failed builds, not successful exact-image validation.
See both `*-build.log` and `*-build-status.json` files. Dependency versions and
Dockerfiles were not altered to hide those failures.

The final candidate needs successful exact builds and full platform Oracle/GPT
runs. Oracle overall 1.0 and GPT below 0.7 are targets, not measured results.
The historical 0.9833 Oracle and 0.7661 GPT scores belong to the earlier task
checksum and must not be attached to this new ZIP. Keep Gemini unrestricted as
requested. Record every new evaluation attempt; do not adjust weights or discard
passes to manufacture the target band. Actual Functional judge time within the
unchanged 9000-second budget also needs fresh run evidence.
