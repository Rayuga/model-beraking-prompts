# Colderwater independent final QC — 26 September 2026

The final repair has **46 Pass, 7 Note and 0 Fail across all 53 quality judgments** in our local review. All **48 deterministic inventory entries** are addressed: 33 PASS, 11 NOTE and 4 N-A. These are executed local checks and manual equivalents, not results from the platform's unavailable private checker implementations. There is no remaining source blocker identified by this review. A paid Oracle score and actual target-model scores remain unmeasured.

The reviewed [archive](colderwater-playground-devtools.zip) contains 50 files and 838,700 bytes. Its SHA-256 is:

`76ab7fb11195aa564b1ac5647439cc34be4b8c00fd28918f95b06ed286fd6d4d`

Independent inspection verified CRC, one root directory, no duplicate or traversal entries, executable shell modes, and exact equality of every archived file with both the final source and [manifest](candidate_manifest.json). The earlier `e2529e31…` candidate is superseded. The [client-safe workbook](QC_FINAL.xlsx), [53/48 findings](qc_final_findings.json) and [independent evidence binding](independent_review_evidence.json) apply to the final hash above.

## What the previous review missed

The [ten platform findings](PLATFORM_FAILURES.md) exposed real review gaps. The earlier review treated visible editor surfaces and a health response as adequate working prerequisites, mapped existing criteria back to requirements without checking the reverse direction, and accepted several independently useful behaviors in combined scores. It also missed the public phrase `verifier files` and overstated confidence in the naturalness of the request. Correcting criterion-ID collisions alone had not corrected any of those issues. Original reports are preserved; this report supersedes their corresponding conclusions.

The new Render gate executes newly authored source and observes its preview and console marker. Constraints saves a new snippet through the UI, observes an actual write, and retrieves the same identity, title, filename and source through the app in a clean browser context and after reload. A save response or same-context local storage cannot establish this. Scored prompts inherit these prerequisites, then reload live library content without repeating saves. All five prompts prohibit inspecting implementation source while allowing user-authored snippets and downloads as legitimate product data.

The brief and notes now explain the owner's use case in ordinary language. A packaging guard reproduces and rejects the former grading-vocabulary leak. Functional coverage now includes the previously missing refusal families, stale rename, dirty transitions, import with Auto-run disabled, case-sensitive title pairs and validation boundaries. Export/import, origin isolation/unsupported execution, native/in-app warnings and the four error paths have separately scored outcomes. The [requirement-first coverage map](REQUIREMENT_COVERAGE.md) and [criterion crosswalk](criterion-crosswalk.json) show what changed and where each promise is observed.

Independent review also found two further gaps: snippet networking had no actual test, and a short delayed runaway could not distinguish a shared execution budget from a fresh callback budget. A new small network criterion uses locally fulfilled resources with an unprotected positive control, followed by separate fetch and image attempts. The shared-budget probe now delays its runaway callback by 4,000 ms and measures timeout from the original Run. Golden evidence supports both probes; neither relies on the real internet or source inspection.

## Evidence actually executed

| Evidence | Result and scope |
| --- | --- |
| [Source audit](qc_source_evidence.json) and [extracted archive audit](qc_extracted_source_evidence.json) | 81 assertions pass on each; all file hashes bind to the final candidate. |
| [Revision preflight](revision_preflight.json) and [extracted preflight](extracted_revision_preflight.json) | 37 assertions pass on each, including changed coverage, source bans and scoring arithmetic. |
| [Contract checks](contract-checks.json) | 23 checks pass; 32 Functional criteria total 49.5. There are 44 criteria across the five dimensions. |
| [Final image evidence](final_image_evidence.json) | Both images built. Agent inputs match, `/app` is empty apart from Git scaffolding, no private solution/verifier leaks, and all 15 copied verifier files match final source. |
| [Golden browser proof](GOLDEN_FIX_AND_BROWSER_PROOF.md) | 59 grouped checks pass using actual Chromium 152.0.7977.8: 17 primary, 5 independent runtime, 6 validation, 2 title/budget, 4 network/origin, 13 runtime regression and 12 library regression. These are local observations, not 59 paid judge verdicts. |
| [Installer proof](oracle-reinstall-results.json) | 6 isolated lifecycle checks pass, including active-use refusal, stopped reinstall reset and ordinary restart preservation. |
| [Negative gate fixtures](MOCK_GATE_VALIDATION.md) | 11 assertions across two actual-browser counterexamples. An inert Run fails Render; a working runner with localStorage-only records fails independent server retrieval, despite an apparent successful save. |
| [Actual MCP routing proof](network_probe_mcp_runtime.json) | Installed `browser_run_code_unsafe` supports the required control, routing, iframe probe and cleanup. A permissive fixture delivers the forbidden resources and is detected. No real external network is needed. |
| [Canonical synthetic scorer](mock_score_policy_results.json) | Four cases pass: old shell arithmetic is 0.3364; either failed gate forces zero even with perfect scored inputs; Functional exactly 0.05 remains zero. These are synthetic policy inputs, not model runs. |

The entire `solution/app` directory is byte-identical to the prior validated candidate. The existing 127 backend assertions, actual restart-MCP proof and unchanged-harness fixtures therefore remain applicable as preserved evidence; they were not newly rerun or relabelled as paid results. This repair changes the installer, which now refuses to reset an in-use database and clears only its canonical database and sidecars during a stopped reinstall. Normal application startup and restart preserve state.

The negative fixtures used separate containers and databases. Both fixture containers were stopped and removed. Test-only timing/probe corrections are disclosed in [MOCK_GATE_VALIDATION.md](MOCK_GATE_VALIDATION.md); they did not alter task or golden behavior.

## Weight and reward effects

The canonical 60% Functional / 20% Polish / 20% Visual policy, strict Functional > 0.05 floor, zero reward mass for gates and Functional total 49.5 are unchanged. The six Visual criteria and four simple Polish criteria are unchanged. Visual raw scores remain 1–5, matching the installed RewardKit normalization.

The former cheap editor witness earns 3/49.5 Functional. At Polish = Visual = 0.75, it can obtain **0.3364** under the old weak prerequisites. This is an arithmetic counterexample, not a measured model score. The revised prerequisites reject the demonstrated inert runner and client-only library. This does not establish that every deceptive implementation is rejected, or that every partial but genuinely working app should score zero.

Splitting combined outcomes changes partial credit. Under the preflight's explicit assumptions of equal passed gates, equal presentation scores and unchanged unrelated outcomes, modeled redistribution can raise published reward by at most **0.1213** when both versions clear the floor. Across the unchanged discontinuous floor, an abstract Boolean combination can jump from zero to **0.5455**. These are conservative arithmetic bounds, not assertions that the combinations describe a feasible app or forecasts of model performance. Stronger gates and newly tested legs can also lower scores. Full model ranking and the desired difficulty band require actual evaluation.

## Remaining limits

The seven Notes cover paid Oracle/provider execution, fixed artifact versus generated-record repeatability, browser observability, bounded mock witnesses, model ranking and remote-judge determinism. Clean-context retrieval proves the tested server-backed behavior; it does not identify the database engine or framework. The network and isolation tests cover stated representative paths and do not claim an exhaustive security proof.

Official platform QC and paid Oracle/model runs against this exact archive remain outstanding. The local evidence supports another submission; it does not guarantee a platform pass or an Oracle score of 1.0.

The [workbook validation](workbook_validation.json) independently checks the exact 53 and 48 inventories, verdict counts and removal of internal workbook sheets. Its file hashes bind the findings and workbook to this candidate.
