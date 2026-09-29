# Ridgeline harness and scoring crosscheck — 27 September 2026

The fresh crosscheck confirmed that Ridgeline's previous `7502bd9c36e568b0d50e682e4030d0c6f9079b5467ae19992303b8d04f8dcca6` archive has the same inherited **false-success restart defect** found in Colderwater. It is now repaired in Ridgeline's `tests/test.sh`. No canonical Python tool, runtime requirement, image definition or scoring policy was changed by this repair.

Final repaired `tests/test.sh` SHA256: **`d983554cf01740acf24ba35f376181983a10c6a926315860123f382644eef6b1`**. It is byte-identical to the already proven Colderwater repair, including the replacement-PID startup-race correction. The old archive remains preserved. The final new archive contains **51 files, 701,173 bytes**, SHA256 **`9944734b651333bfd5cdb9df99b05835bab74d3bf0b8a71dd4ff894c1314445c`**; its independent binding is recorded below.

## What was wrong and what changed

The old restart helper sent SIGTERM, waited five seconds and launched a replacement even if the old process group remained alive. HTTP readiness could then come from the old listener while the replacement failed. The canonical MCP wrapper interpreted the helper's zero exit as a successful process restart.

This was reproduced **again for Ridgeline**, with its exact extracted helper and its own pinned verifier image. The [new baseline evidence](restart_probe_results.json) records:

| Fixture | Before/after listener | Actual result |
| --- | --- | --- |
| Normal termination | PID 7 → 68 | Old process exited; restart succeeded. |
| Old server retains its listener after SIGTERM | PID 79 → **79** | Replacement PID 140 logged `EADDRINUSE`, but MCP returned `isError: false` and claimed the server was relaunched. |

That could falsely award Ridgeline's 3-weight persistence criterion to a server whose original in-memory state never went away. With other scores and floor status fixed, that criterion contributes about 0.0514 of total reward. This is a harness error; it is not evidence that the golden app lacks SQLite persistence. The previous normal-restart test could not expose resistant termination.

Only the generated restart-helper section changed:

- `tests/test.sh:130`: distinguish live process-group members from zombies; wait for TERM, escalate to KILL if needed, and confirm termination.
- `tests/test.sh:133`: use non-zombie PID liveness for the replacement. Testing its PGID immediately after background launch could race with `setsid` creating the group.
- `tests/test.sh:144`: read at most one readiness byte rather than consuming an arbitrary whole response.
- `tests/test.sh:177`: refuse to launch when another listener is already answering after the old application group stopped.
- `tests/test.sh:192`: a real 30-second readiness deadline, with replacement liveness checked before accepting readiness. Startup failure returns an MCP error.

The initial launch, `/app` copy fallback, app-directory CWD, UID/GID 65534, sanitized environment, port 3000, `DB_PATH`, one continuing database, single-use MCP marker and 55-second tool timeout remain intact. The finite waits fit within the tool budget under ordinary scheduling; this does not promise latency under arbitrary host starvation.

## Fresh verification

[Five repaired-helper cases](restart_fixed_probe_results.json) pass against the exact repaired hash: normal termination, a SIGTERM-resistant parent, a resistant child left in the old group, a replacement that exits immediately, and a conflicting independent listener. The last two return errors. All five also reject a second restart-tool call. Successful cases changed the actual serving PID; normal restart took about 0.7 seconds and resistant cases about 5.6 seconds.

[Four orchestration cases and one complete browser restart](harness_regression_results.json) all pass in separate disposable containers:

| Check | What ran |
| --- | --- |
| Relative CWD | Real unprivileged app verifies `/app` working directory, durable state and absence of the injected harness secret before/after the canonical MCP restart. |
| Golden orchestration | Actual Ridgeline app writes an order, restarts and checks durable receipt, retry reference and stock; only RewardKit's score output is stubbed. |
| Failed gate | Scored suite is skipped and output reward is zero. |
| Missing app | Harness writes the documented ungraded no-op zero record. |
| Full browser persistence criterion | Newly authored storefront-specific witness performs the UI purchase/cancel/second-purchase setup, a real single-use MCP restart, fresh browser lookups and request replays. |

The [standalone browser result](browser_restart_results.json) and [complete execution log](harness_golden_browser_restart.log) contain the new proof. Chromium **152.0.7977.8** placed one Kiln order and cancelled it, placed a separate one-unit Kiln order, and recorded both full receipts, addresses, statuses, all 13 stock values, eight print identities and the historical receipt. The initial independently observed stock was **S = 7** because this witness used its own fresh database; the public criterion explicitly derives its postconditions from observed S rather than assuming the normal full-suite S = 3.

The actual process changed **PID 30 → 196**; the old process was absent and the new process live. A newly launched browser retrieved both exact receipts. Replaying each original checkout retained its own reference and cancelled/placed status without another stock deduction; replaying the cancellation restored no extra stock. All variant stocks and identities remained identical. Historical RP-100001 remained dispatched with two Long Field A3 units at GBP35.00 and a GBP73.20 total. The result stores the successful UI request shapes and exact returned data rather than inferring persistence from a reload alone.

There are eight grouped browser checks across prepare/verify. Those are supporting observations for the final persistence criterion, not eight additional rubric criteria. The harness's synthetic reward of 1 is **not a paid Oracle score**. This witness exercises the final persistence flow independently; it does not claim a complete sequential paid functional run.

[Twenty fresh scorer fixtures](scoring-results.json) also pass against Ridgeline's actual unchanged canonical `score.py`. They cover both zero gates, skipped scoring, a functional score exactly at and just above the floor, fractional rewards, missing values and invalid types/ranges/nonfinite values. These are synthetic dimension inputs, not model measurements.

## Configuration and tool review

I reread the current staged-task contract and the applicable current workbook procedures for safe scoring, runtime agreement, tool wiring, browser evidence, state continuity and pinned shared tools. All five Ridgeline prompt/judge pairs and the shared app context were inspected. [The comparison artifact](harness_contract_comparison.json) was freshly derived from the extracted 7502 baseline and current template; it also records the final current judge configuration/counts after the separate semantic review.

| Area | Verified fact |
| --- | --- |
| Canonical files | Both Python helpers, `scoring.toml`, both Dockerfiles and verifier `.dockerignore` are byte-identical to the template. Python ASTs also match. |
| Task schema/identity | Template key inventory matches. Name matches `turing/ridgeline-print-storefront`. Frozen agent, environment and verifier sections are equal, including the judge/model environment and public networks. |
| Runtime | `node /app/server.js` starts from its directory, honors the documented writable `DB_PATH`, uses one unprivileged Node process and the same database through restart. Required local assets are part of the delivered app. |
| Weights | Both gates have zero reward mass; dimension weights remain 0.6/0.2/0.2 and Functional must be strictly above 0.05. Internal positive criterion weights use weighted means; gates use all-pass. Visual raw1–5 anchors normalize to zero–one. |
| Counts | The reviewed baseline had 24 Functional criteria/35 weight. The separate current semantic edit has 25/35; all judge tool/timeouts remain unchanged. Four Polish, six Visual and two gate criteria remain. This report does not attribute that rubric change to the harness repair. |
| Budgets | Gate sum1200 < suite1500; scored sum10800 < suite11100; suite budgets12600 < verifier13200. Full paid judge duration remains unmeasured. |
| MCP tools | All five use the pinned Playwright MCP and isolated headless Chromium. Functional alone declares canonical `restart_mcp.py` with literal `$APP_RESTART_HELPER`. The existing installed `browser_run_code_unsafe` context recipe is consistent with prior actual-tool evidence; it does not demand an unavailable old tool name. |
| Prompt/state contract | All five prompts contain the live URL and runtime substitution tokens, injection warning and source-inspection ban. No sign-in is invented. Gates establish server-backed independent retrieval before scoring; scored judges do not require another judge's generated reference or an unrequested order list. |
| Later state | The constraints purchase remains in the continuing database. Functional stock allocations and state-relative exceptions are documented. Polish/Visual use available stock without committing purchases, and may inspect the known historical reference without needing shared browser storage. |
| Isolation | `/tests` and logs remain inaccessible to the application UID; environment is sanitized. The successful fixture verifies that a harness-only secret does not reach the app. |

The existing image used for these fresh executions is `ridgeline-verifier:20260926-followup`, ID `sha256:4b2a0334afcf25087843b3b26b9d2dcbcc5fcb2c05909741d996edb78984d5c6`. Each harness container copied the current task's tests and app before running; it did not silently use the old baked helper. The rebuilt final images were then independently read and bound as follows.

## Final archive and image binding

[Independent final binding](independent_harness_binding.json) passes. This fresh read checks ZIP CRC, safe unique single-root members, executable shell modes and every file hash against the manifest, current source and extracted candidate. Exactly six files differ from the preserved 7502 baseline: `task.toml`, Functional judge/prompt, Polish judge/prompt and `tests/test.sh`. No app file, canonical helper, Dockerfile or seed changed.

The check also inspected the final image IDs and used separate disposable containers to read the actual installed files, independently of the coordinator's reported boolean results:

- `ridgeline-agent:20260927-crosscheck`: `sha256:33e177788683fc36f94cb3ffef4d44dedaeeb92631c72a10cfdab78ee469ae6b`. All 12 public input files match the final archive; `/app` contains only `.git` and `.gitkeep`, with no solution/verifier files.
- `ridgeline-verifier:20260927-crosscheck`: `sha256:6fbd4d7468c34ea8f0035aca4243c9c1c6f7363dd3f9ea16f92eb3ecc097f29a`. All 15 copied verifier files match the final archive, including the repaired helper's hash. Dockerfile and `.dockerignore` are build inputs and correctly absent from the copied verifier tree.

The fixed-helper results, orchestration results and fresh browser source hashes agree with this final candidate. The final candidate remains 25 Functional criteria with total weight35; the semantic change belongs to the separate rubric review.

## Evidence provenance and limits

The generic lifecycle probe algorithms were reused from the corrected Colderwater review, but **all Ridgeline results here were newly executed** against Ridgeline paths/image. The four ordinary harness fixtures were adapted from Ridgeline's earlier fixture files and rerun. The full storefront UI restart script is new and was not substituted with Colderwater's snippet-library proof. The twenty canonical scoring cases were adapted and rerun. Old reports and archives were not overwritten.

No other concrete harness/configuration/scoring blocker was identified. This bounded report does not replace the coordinator's complete 53/48 semantic/package inventory or the other reviewer's full golden coverage. Public CDN use is permitted. Framework/exhaustive-security inference, paid Oracle outcome, target-model score, remote judge reproducibility and actual full-suite paid latency remain outside this local evidence. All probes used independent container filesystems and `--rm`; none used another agent's app/database. No paid call, commit, push or publication was performed.
