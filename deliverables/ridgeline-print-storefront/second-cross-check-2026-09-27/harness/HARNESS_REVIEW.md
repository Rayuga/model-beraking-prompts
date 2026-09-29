# Ridgeline independent harness, gate and scoring cross-check

This second review found and repaired a different lifecycle defect from the earlier restart repair: **the final EXIT cleanup could wait indefinitely on a SIGTERM-resistant original application process after a valid score had already been written**. The generated restart helper was already bounded; final cleanup was not. No paid judge or platform run was involved in finding or verifying this defect.

Reviewed baseline: archive `9944734b651333bfd5cdb9df99b05835bab74d3bf0b8a71dd4ff894c1314445c`, 51 files. Final candidate: **`e9571f7ec27341ace6c955a81de5cc8fd2199df804ee54b7c90a009b18333f9b`**. Repaired current `tests/test.sh` SHA-256: **`7644e994deefad7ce60ca93d20e4c7c5313df31ef70238689a044ef893c4ebbb`**. `review_binding.json` independently validates the old archive and current source delta; `../release_validation.json` records independent final archive/source/extraction and actual image reads. The coordinator owns the complete QC report.

## New confirmed defect and repair

`cleanup_probe_results.json` reproduces the defect with the actual shipped `d983554c…` harness, a local HTTP server and synthetic RewardKit dimension outputs. Both fixtures produce a legitimate arithmetic result of 0.64. The normal server exits. The resistant server receives SIGTERM, remains the HTTP listener at PID69, and the harness stops progressing at `wait 69`. It exits only after the probe sends SIGKILL to that group. The diagnostic trace and app message are recorded. This confirms unbounded completion; it does not measure whether the hosted platform would retain or replace an already-written score on timeout.

This matters when the original child still exists at the end of verification—for example, a partially working application whose final persistence criterion did not reach the restart call. Earlier tests exercised normal termination or the restart helper's replacement process, so they did not establish that this outer cleanup path was safe.

The root explicitly authorized a minimal `tests/test.sh` repair. Only its outer cleanup section changed (`test-sh-cleanup.diff`):

- `tests/test.sh:33` adds a process-group liveness predicate that excludes zombies.
- `tests/test.sh:37` captures the original exit status and ensures score files before shutdown.
- Cleanup sends TERM, polls for five seconds, escalates to KILL if needed and polls for up to two more seconds. It reports an exceptional remaining live group rather than entering an unbounded wait.
- The child `wait` is used only after its PID is no longer live. The function returns the original exit status.

The generated restart helper, initial startup/CWD, environment, database choice, scoring stages and budgets are unchanged. No canonical Python helper, template file, application source or shared policy was edited by this reviewer. The finite teardown fits within the existing outer slack under ordinary scheduling; no userspace loop can promise real-time termination under arbitrary kernel/host failure.

## Fresh verification after the repair

`cleanup_fixed_probe_results.json` contains seven passing cases:

| Case | Result |
| --- | --- |
| Normal app | Exits promptly; 0.64 preserved. |
| Resistant original parent | Forced shutdown completes about 5.28 seconds after scoring; no live group/listener remains; 0.64 preserved. |
| Resistant child survives normal parent | The remaining child in the old group is terminated in about 5.29 seconds; no live group remains. |
| App already exited | Cleanup completes immediately without waiting on a live process. |
| Failed gate with resistant app | Scored suite is skipped; detailed zero score survives; cleanup completes in about 5.34 seconds. |
| Missing entrypoint | Ungraded no-op zero remains intact. |
| Original nonzero shell status | The exact extracted cleanup functions preserve exit23 after terminating the resistant group. |

`orchestration_regression_results.json` contains four fresh full-harness executions using the existing fixtures with the new source copied into separate disposable verifier containers: relative CWD and sanitized app environment, golden order/retry durability through a real MCP restart, failed-gate short circuit, and missing-app zero. All four pass. These use a real unprivileged Node process and canonical restart tool; only the RewardKit score production is stubbed. They are not Oracle evaluations.

The tests used `ridgeline-verifier:20260927-crosscheck` as a runtime base, explicitly copied current `/tests` before execution, and used separate container filesystems with `--network none` and automatic removal. They did not use another reviewer's database. Syntax checking is part of the orchestration boot script.

## Adversarial gate and state review

The current all-five prompt/judge wiring and injected app context were read directly. The following are manual source conclusions, not new platform verdicts:

| Challenge | Conclusion and limit |
| --- | --- |
| Blank, placeholder or static seed-copy storefront | Render requires populated content plus real navigation. Constraints additionally requires an actual new purchase and independent lookup; a static catalogue alone cannot pass the complete gate. |
| Browser-only orders/localStorage mock | Constraints uses a newly chosen recipient, the UI-generated reference and an independently created context with no transferred client storage. It observes the server response, reloads and compares that new receipt. An original-context success toast or historical receipt is insufficient. The previous mock evidence is historical evidence for this same unchanged gate, not freshly executed here. |
| Gate overreach | Its normal one-unit Kiln purchase does not prescribe prices, deep validation, retry/cancellation behavior, a particular request schema, UI design or framework inference. It allows app CDN assets and alternate local loopback addresses. The public notes do require a local Node backend; this is separate from forbidding CDN assets. |
| Backend identity | Independent retrieval is evidence of live shared order behavior, not proof of SQLite, Express, or exhaustive persistence. A functioning in-memory backend is a partial application, not the same counterexample as a dead static mock; the real restart criterion is what distinguishes its lost durable state. |
| Gate mutation/order | The gate leaves exactly one Kiln order, normally reducing stock from7 to6. Render is read-only, so the two gate dimensions do not require a particular execution order. The scored suite starts only after the whole gate suite succeeds. |
| Independent judge sessions | Scored prompts inherit successful gates but do not ask for the gate's generated reference or storage. A known historical receipt supplies read-only presentation evidence. Separate Playwright contexts are feasible with the installed actual tool and documented lifecycle recipe; no hidden browser reset is required. |
| Continuing database and later presentation | Functional allocates purchase variants and derives later shared stock from observed committed writes after ordinary earlier failures. Polish/Visual use currently available stock and do not place/cancel orders. Their work therefore cannot consume a later functional reservation. Visual uses the known historical receipt rather than another judge's private identity. |
| Batch failures | Each scored prompt says continue and score criteria independently. Gates are deliberately all-pass. Ordinary feature failures do not automatically fail unrelated criteria; only the explicit global prerequisite zeros a dimension. |
| Browser evidence/injection | All dimensions forbid implementation-source reasoning and embedded grading instructions. Network observations support runtime data, not framework inference. The reviewer may inspect source as an author, but that permission is not given to the judge. |

Two semantic concerns were forwarded to the separate requirements reviewer rather than silently treated as passes:

1. The former Polish search-plus-two-Tab-stops sample was too weak a witness for broad keyboard usability. The current revised labels/focus criterion covers each named enabled control, and the separate navigation criterion covers view entry/return. Their final complete assessment and fresh browser proof belong to the semantics/runtime reviewers.
2. Restart setup explicitly recorded Kiln, while its later clause compared “every variant you recorded” without clearly requiring all visible variants. The prior local browser witness happened to record all13, which did not cure the under-specified shipped setup. The final corrected criterion now expressly captures all13 public SKU-size identities/quantities, including zero, immediately before restart and compares every value afterward. I reread this final wording; it closes the specific gap without introducing a hidden database inspection requirement.

## Scoring and standards review

The root and skill workbooks were enumerated using the skill's loader: both have the same **53 quality checks and48 deterministic checker descriptions**. The internal interpretation was read and kept only in `workbook_reference_internal.json`; it must not be copied into a client workbook. The public-network staged delivery profile overrides stale internal no-network, same-origin, temperature/version-marker and retired-layout language. The coordinator owns the complete53/48 verdict inventory; this report does not invent another set of global pass counts.

`review_binding.py` performs39 fresh structural/hash/evidence assertions. Both canonical Python helpers, `tests/scoring.toml`, Dockerfiles and verifier ignore file are byte-identical to the current template. Helper Python ASTs also match. Frozen agent/environment/verifier sections match the template, the task identity is correct, and all dimension tool configurations/aggregations are unchanged from the reviewed archive.

- Gate judge total1200 < gate suite1500; scored judge total10800 < scored suite11100; total suite budgets12600 < verifier13200. Final cleanup now has a bounded nominal seven-second wait. Full paid-suite latency is still unmeasured.
- Both gates carry zero reward mass. Actual gate failure skips scoring; the Functional floor is strictly greater than0.05. Passing at exactly0.05 earns zero.
- Functional remains25 criteria with total weight35; its floor corresponds to earned mass1.75. From the actual criterion weights, the smallest attainable mass above it is1.8. With both gates passing and perfect presentation, that vector produces reward0.4309. This is an analytical conditional vector, not a measured model score or a static-mock pass.
- Presentation has maximum share0.4 only after the gates and floor. All internal/dimension weights are positive; thresholding and rounding preserve coordinate-wise monotonicity. This does not prove a total quality ordering between incomparable real applications or guarantee a desired target-model score.
- Visual remains six raw1–5 Likert criteria with zero at raw1, consistent with the pinned normalizer. Ordinary desktop presentation and mobile composition are separated from Polish mobile operability; neither rubric requires aesthetic perfection.

## Reused evidence, binding and remaining limits

Prior results were accepted only after comparing their tested files with this source:

- The five previous restart-helper lifecycle cases remain applicable because the generated helper text is byte-identical. They are not five fresh executions in this review.
- The twenty previous scoring fixtures remain applicable because both canonical scorer and policy are byte-identical. They are not new model measurements.
- The earlier full storefront browser restart is reused only for unchanged application files and helper behavior. It recorded actual process replacement, placed/cancelled controls, retry terminality, all13 stocks and fresh browser reads. The four orchestration cases above are newly executed, but no fresh full browser restart is claimed here.

The binding artifact records exact evidence hashes, source changes and fresh/reused scope. The new cleanup finding is confirmed and locally repaired; hosted timeout handling itself was not exercised. Full official checker behavior, complete paid judge latency, Oracle score and target-model score remain unmeasured.

The same old outer-cleanup pattern is still present in Colderwater at the time of this review. This is a shared lesson, not a claim that this Ridgeline-only edit repaired Colderwater; no Colderwater file was changed here.
