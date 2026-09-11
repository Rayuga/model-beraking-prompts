# PatchPad 2.0.13 — reward honesty and custom-surface gate

Use the single `patchpad-editor-v2.zip` in this folder for a fresh platform
review. Its one `patchpad-editor-v2/` wrapper contains the same 30 task files.
All validation scripts, reports and temporary evidence stay outside the ZIP.

SHA-256: `fef56d425d72493371d0b1b7f3b13b17cb208564e541e4b806e753c832e04fc6`.

## Platform finding and decision

The supplied screenshot reports Static 45/45 and Rubric 52/53 on the previous
upload. `dimension_and_criterion_weights_are_honest` identifies two problems:
the task-defining custom-editor requirement was priced inside a 0.125-weight
criterion out of 20.75 Functional weight, while four Polish checks received
40% of total reward. Do not fix this by changing historical scores or just
making the basic input smoke artificially expensive.

This release makes prohibited native/third-party document surfaces a hard,
zero-reward prerequisite in the Constraints prompt. Observing a textarea,
input, contenteditable or ready-made document editor means both Constraints
criteria receive no; the existing test.sh gate then zeros the entire reward.
Custom DOM/canvas/SVG and ordinary external controls remain allowed. Small
hidden inputs used only for IME/clipboard plumbing are not automatically
rejected, nor are libraries used only for unrelated controls. Evidence must
identify what actually implements the document editor. No complex editing
workflow, persistence test or subjective styling requirement was added to
this read-only architectural gate.

The existing 0.125 Functional criterion still tests its exact real-typing
marker. Its duplicate surface inspection moved to the hard prerequisite;
the architectural requirement was not dropped or priced at 0.125 anymore.
All 35 criterion IDs and individual weights remain. There are still
2 Render / 2 Constraints / 27 Functional / 4 Polish criteria, and Functional
criterion weights still total 20.75.

After both gates pass, the aggregate is now 90% Functional / 10% Polish.
Both judge dimension weights, reward.toml, test.sh and task.toml's explanation
agree. Gate epsilon metadata carries no final reward mass. The existing
Polish persistence prerequisite remains unchanged.

| Synthetic example | New reward |
| --- | --- |
| Failed custom-surface/Constraints gate, otherwise perfect | 0 |
| Functional 0.5, Polish 1, gates pass | 0.55 |
| Functional 0.9, Polish 0, gates pass | 0.81 |
| Functional 1, Polish 1, gates pass | 1 |
| Functional 0, Polish 1, gates pass | 0.10 upper bound |

The last row is algebra, not a claim that a nonworking shell passes Polish:
the existing persisted-save/fresh-client prerequisite prevents that credit
when no real persisted edit works. This split is a deliberate authoring
choice, not a platform-mandated universal 90/10 ratio.

## Preserved

The three 2.0.12 instruction clarifications, exact seed, golden JavaScript,
all other criteria and prompt bodies, runtime dependencies, two public network
settings, separate verifier, OpenRouter-only credentials, Codex/Luna/high,
startup readiness, manifest parsing, restart helper and timeout ladder remain
unchanged. The 2.0.11 pinned toolchain repair remains. Release markers are
2.0.13. Brickfall's rubric issues have not been modified in this task.

## Evidence and limits

`package-audit.json` records 140 local assertions: every file accounted for,
unchanged behavior outside the declared gate/weight changes, consistent
aggregate weights, retained real-input check, no literal key, LF/UTF-8,
archive CRC and source/member hash equality. It is not official platform QC.

Fresh local evidence lives in `regression-result.json`, the individual
browser/harness JSON files, `reward-regression.json` and `surface-fixtures.json`.
The current-source regression completed with exit code 0. Passed checks:

- Syntax, empty-submission handling and manifest parser acceptance/rejection.
- Six baseline and six targeted browser cases, eight previous Oracle-failure
  paths, fourteen additional editing/save/server-rejection cases, six browser
  variants, three later Oracle-repair cases and four instruction-alignment cases.
- Two process restarts preserving the exact saved document and revision history;
  destructive-reseed and missing-manifest-route negative controls were rejected.
- Full runner with trusted dimension-score stubs, two managed restarts and
  final cleanup; observed aggregate 0.55 matched the expected value.
- Thirty reward combinations, sixteen invalid-score rejections, and the live
  golden surface plus eight synthetic DOM surface fixtures.

The actual test.sh reward-writing block is tested on 30 synthetic combinations
and 16 invalid values. The full runner is separately tested with a trusted
stub expecting 0.55 rather than the former 0.7; this is not an Oracle score.

The surface diagnostic reads the golden's DOM without mutation and tests
eight independent synthetic DOM fixtures (four prohibited, four allowed).
It demonstrates browser-observable distinctions, not that a paid LLM judge
will always classify every minified third-party implementation correctly.
No official judge execution or exhaustive third-party-editor battery was run.

Exact agent and verifier image builds were attempted and failed because the
local configured proxy hostname could not resolve during package downloads.
The current-source regression uses the existing `patchpad-preflight-tests:2.0.9`
tool image, with fresh isolated app state and current source mounted read-only.
See `build-results.json` and build logs; no host network settings were changed.

No paid Oracle/model or official static/rubric run was launched. Historical
ZIPs, reports, model artifacts and rewards are untouched. Because scoring and
gate semantics changed, old scores are NOT scores for 2.0.13; a new platform
QC and Oracle run are required. No guarantee of 53/53 or Oracle 1.0 is made.
