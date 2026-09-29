# Colderwater independent QC after the network-policy correction

The complete local review records **46 Pass, 7 Note and 0 Fail across all 53 quality checks**. All **48 deterministic entries** are addressed: **33 PASS, 11 NOTE and 4 N-A**. These are local assertions/manual equivalents, not results from unavailable private platform checkers. No source blocker remains identified in this revision; paid Oracle and candidate-model scores remain unmeasured.

The reviewed [archive](colderwater-playground-devtools.zip) has **50 files, 839,033 bytes**, SHA256:

`998f0ba6831f801686251412a2a7cffb6e38fd5807dae68e08042a7f78bc8686`

The [client-safe workbook](QC_FINAL.xlsx), [complete findings](qc_final_findings.json), [independent evidence binding](independent_review_evidence.json) and [workbook validation](workbook_validation.json) apply to that exact archive. Independent checks opened the ZIP, verified CRC/safe unique paths/executable shell modes, and compared every file with current source, extraction and manifest.

## The prior network conclusion was wrong

The earlier `76ab7fb1…` review accepted a task-wide offline restriction because it appeared in the task's own public notes. That was circular: the current staged profile explicitly permits public browser fonts, scripts and CDN assets, and no user-authorized exception was identified. The current review withdraws that earlier conclusion. The preserved [standards audit](../../ridgeline-print-storefront/rubric-followup-2026-09-26/NETWORK_STANDARD_REVIEW.md) records the exact authority and previous wording.

The correction changes exactly seven files: the brief, integration/policy/security notes, task description/provenance, app context and F01 description. The app may load external browser assets. Its server and saved library still belong to the supplied local backend. F01 retains automatic useful startup, examples and newly authored DOM/console execution; it no longer deducts for permitted asset requests.

The code typed into the playground has a separate, unchanged security boundary. Authored snippets still cannot request external resources or network services. That product behavior is tested through a known-good local route control followed by separate fetch/image probes. It is not an app-wide CDN or same-origin prerequisite.

All **32 functional IDs/types/weights**, the total **49.5**, the other **31 functional descriptions**, both gates, four polish criteria, six visual criteria and all five judge prompts are unchanged. The entire golden app and installer, seed, Dockerfiles, harness and shared scoring/restart tools are byte-identical to the prior candidate. The [exact delta](network_policy_changes.diff) and [current requirement map](REQUIREMENT_COVERAGE.md) make that scope explicit.

## Evidence checked for this candidate

| Evidence | Result and scope |
| --- | --- |
| [Source audit](qc_source_evidence.json) / [extracted audit](qc_extracted_source_evidence.json) | **82/82** assertions pass on each; both full hash maps equal the final manifest. |
| [Source delta](network_policy_preflight.json) / [extracted delta](network_policy_extracted_preflight.json) | **22/22** each; exactly seven files changed and only F01's description changed among criteria. |
| [Contract checks](contract-checks.json) | **23/23**; 32 Functional total49.5, 44 criteria overall, current public hygiene and configuration agreement. |
| [Template guard](template-network-policy.json), [source guard](network_policy_source.json), [extracted guard](network_policy_extracted.json) | Public networks and explicit browser-asset allowance pass. The preserved [old candidate](old_network_policy_failure.json) correctly fails the guard. |
| [Network regression cases](../../ridgeline-print-storefront/rubric-followup-2026-09-26/network-regression-results.json) | Seven cases pass: current standards/candidates accepted, old restrictions rejected, snippet security treated separately. This is a narrow guard, not semantic-QC replacement. |
| [Rebuilt image evidence](final_image_evidence.json) | Both images built; seven current public inputs and15 current verifier files match the archive; agent app empty except Git scaffolding, no private solution/verifier leak, Chromium152.0.7977.8. |
| [Independent archive review](independent_review_evidence.json) | All50 archive/source/extracted files agree, exact seven-file difference proved, authoritative53/48 inventories reloaded and every verdict reconsidered against the change. |

The prior [golden evidence](../rubric-fix-2026-09-26/GOLDEN_FIX_AND_BROWSER_PROOF.md) contains **59 browser groups plus six installer lifecycle groups**, including the existing snippet boundary and exact runtime probes. The prior127 backend assertions, restart proof, inert-runner and client-storage-library negatives remain relevant because their app/harness/gate code did not change. They were **not rerun for this network-only correction**, and none is represented as a paid Oracle result. New image and source/delta evidence is distinguished from that reused behavior evidence.

## Score implications and limits

The canonical 60% Functional /20% Polish /20% Visual weights and strict Functional >0.05 floor are unchanged. Only F01's existing0.5 weight can gain credit solely from lifting the unjustified restriction. With equal passed gates, unchanged other outcomes/presentation and both versions clearing the floor, maximum extra published reward is **0.0061**. Because the floor is discontinuous, an abstract2.25→2.75 raw Functional change can instead unlock **0.4333**, assuming full presentation credit. These are bounded arithmetic cases, not measured or predicted model results.

The seven Notes remain appropriate for paid Oracle/provider execution, generated identities and artifact repeatability, browser-observability limits, bounded mock witnesses, unmeasured model ranking and remote judging. Browser observations cannot prove the exact database/framework internals or exhaust every security path. Natural voice and flow grouping still involve reviewer judgment.

Official platform QC and paid Oracle/model evaluations against this exact archive remain outstanding. The new local evidence supports another submission; it does not guarantee a platform pass or Oracle1.0. The older reports remain preserved as historical evidence, with their blanket offline-assets acceptance explicitly superseded here.
