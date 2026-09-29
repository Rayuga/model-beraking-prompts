# Colderwater QC history and repeat-finding evidence

The retained evidence supports repeated findings across changed task versions. It does **not** establish different platform results for identical ZIP bytes, QC version and settings. Eight feedback episodes are described below; this is not a verified count of submissions. Original platform run IDs, QC-version/settings records and complete screenshot exports are absent from this review. Local QC workbooks are attributed local reviews, not platform exports.

## Retained archive sequence

Every ZIP below was rehashed read-only and matched its saved manifest. All retained primary archives contain50 files and preserve Functional weight49.5. Exact changed/added/removed file lists are in the JSON companion.

| Local revision | ZIP SHA prefix | Functional rows | What changed |
|---|---|---:|---|
| hardening-2026-09-26 | 3d81cf152460 | 24 | First preserved hardened candidate; 24 Functional criteria. Local QC is not a platform result. |
| instruction-hygiene-fix-2026-09-26 | d250db516a70 | 24 | Only six criterion IDs and matching names changed, removing nine public-text whole-token collisions; 49 other task files unchanged. |
| rubric-fix-2026-09-26 | 76ab7fb11195 | 32 | Ten reported findings: owner voice, actual grader-language leak, missing coverage, bundled outcomes and weak gates; Functional 24 to 32. Golden installer lifecycle repaired. |
| network-policy-fix-2026-09-26 | 998f0ba6831f | 32 | Allowed app/CDN assets while retaining authored-snippet network prohibition; seven files changed. Trigger was a Ridgeline finding also applicable here, not an independently documented Colderwater QC round. |
| full-qc-2026-09-27 | b34abc10a29b | 33 | Three reported screenshot flags/two causes: unasked supersession notice and missing HTTP privacy; additional local CSS-handler/debounce/presentation issues. Functional 32 to 33. |
| cross-check-2026-09-27 | d254c73e6ebe | 33 | Local cross-check only: false-success restart helper and harmless privacy-redirect false failure repaired. No new platform attempt asserted. |
| interaction-keyboard-fix-2026-09-27 | dc2ed5acde5a | 33 | Two reported gaps: completed-preview later interaction contract and pointer-free example/library route. Golden keyboard help added; runtime unchanged. |
| metadata-cleanup-2026-09-27 | 09f4f6cb3647 | 33 | Only four descriptive task.toml fields changed; 49 other files unchanged. Known final cleanup issue explicitly still pending. |
| eight-issue-fix-2026-09-27 | a017932304e1 | 35 | Eight reported categories: unasked loop responsiveness/escape documentation, coupled outcomes, browser privacy decision feasibility, negative windows/real stale editor, workload and metadata; Functional 33 to 35. Bounded cleanup/report handling also repaired. |
| final-cross-check-2026-09-27 | 63a05a5e4ebf | 35 | Local cross-check only: omitted-empty-reasoning compatibility, optional pending DOM/input, positive padded title controls, latest-interaction rollback, completed Stop and saved-example copy. No platform attempt asserted. |
| two-findings-fix-2026-09-27 | 5d0f1d74ae48 | 37 | Two reported findings: public exact privacy probe leak/undercoverage and restart/deletion independence. Nine private candidates, independent restart New/Save flow, three deletion rows; Functional 35 to 37. |
| structural-review-2026-09-27 | 7d693e9cde45 | 88 | Reported timeout-fit and independence failures: shared 37 protocols/seven phases, 88 scored outcomes, fewer nominal Runs; all 23 golden files unchanged. |
| positive-controls-fix-2026-09-27 | 663e4d6df66f | 88 | Reported positive-control omissions and privacy classification overlap: sixteen descriptors retain controls, ordered terminal privacy decisions and conditional fallback setup; counts/weights unchanged. |

## Check counts and recurrence

The parent rechecked the supplied screenshots: **30 flagged check occurrences across8 episodes, involving19 distinct IDs (18 quality checks and1 static check)**. The episode counts are1+10+3+2+8+2+2+2. These are check occurrences, not30 distinct concrete bugs. Several checks describe the same underlying witness.

| Check ID | Occurrences | Episodes |
|---|---:|---|
| criteria_are_independent_and_noncontradictory | 4 | E2, E5, E6, E7 |
| dimensions_cover_every_graded_requirement | 3 | E2, E3, E4 |
| instruction_is_achievable_and_unambiguous_in_the_environment | 3 | E3, E4, E5 |
| criterion_description_is_self_consistent | 2 | E5, E8 |
| instruction_leaks_no_grader_machinery | 2 | E2, E6 |
| no_criterion_grades_the_unrequired | 2 | E3, E5 |
| timeouts_fit_the_work | 2 | E5, E7 |
| check-instruction-hygiene.py | 1 | E1 |
| criteria_are_outcome_based_and_browser_decidable | 1 | E5 |
| dimension_and_criterion_weights_are_honest | 1 | E2 |
| dimension_prompts_are_accurate_and_consistent | 1 | E2 |
| floor_is_low_for_shells_mocks_and_stuffing | 1 | E2 |
| gates_apply_before_shaping_and_carry_no_reward_mass | 1 | E2 |
| global_browser_gate_is_present_and_correct_in_every_dimension | 1 | E2 |
| instruction_is_a_natural_product_request | 1 | E2 |
| instruction_preserves_natural_human_voice | 1 | E2 |
| instruction_states_deliverables_and_runtime_contract | 1 | E5 |
| negative_checks_have_positive_controls | 1 | E8 |
| task_is_distinct_and_authored | 1 | E5 |

## Documented platform-feedback episodes

### E1 — 1 flagged checks

Archive linkage: Explicit old/new hashes in local crosswalk and explicit platform-static-failure attribution; no raw platform submission record.

Check IDs: check-instruction-hygiene.py.

- Six ordinary IDs collided on nine public-text lines. One static check flag, not nine independently failed checks.

Repair: Rename only private IDs/names; add actual whole-token scan. This does not repair separate semantic grader-language leaks.

Sources: [CRITERION_ID_CROSSWALK.md](../instruction-hygiene-fix-2026-09-26/CRITERION_ID_CROSSWALK.md), [QC_FINAL.md](../instruction-hygiene-fix-2026-09-26/QC_FINAL.md).

### E2 — 10 flagged checks

Archive linkage: The transcript says previously uploaded task after the ID-only repair, but does not itself give that uploaded ZIP hash. d250 is the chronological local predecessor, not independently authenticated submission identity.

Check IDs: instruction_is_a_natural_product_request, instruction_preserves_natural_human_voice, instruction_leaks_no_grader_machinery, dimensions_cover_every_graded_requirement, criteria_are_independent_and_noncontradictory, global_browser_gate_is_present_and_correct_in_every_dimension, floor_is_low_for_shells_mocks_and_stuffing, gates_apply_before_shaping_and_carry_no_reward_mass, dimension_and_criterion_weights_are_honest, dimension_prompts_are_accurate_and_consistent.

- Natural product request: spec/test-rulebook voice and missing owner/use case.
- Human voice: overly formal uniform prose; overlaps the prior writing issue but owns another check flag.
- Grader machinery: literal verifier files remained in security notes; ID renaming never addressed this text.
- Coverage: Function/WebAssembly/Worker/dynamic-import refusals; stale rename; dirty New/import transitions; Auto-run-OFF import; case-sensitive title pairs.
- Independence: export/import; origin isolation/unsupported execution; in-app/native dirty warnings; four error-reporting paths.
- Global prerequisites: health-only Constraints and workspace-only Render admitted a dead runner or no real server library.
- Floor: editor/indent/pane/theme3/49.5 could cross the0.05 floor, giving an analytic0.3364 with0.75 presentation. This was not a measured model score.
- Gates and weight honesty: the same weak-gate/cheap-shell witness was reported under multiple check IDs; it is not three separate application bugs.
- Dimension prompt consistency: Constraints copied Render and tested reachability rather than its actual backing requirement.

Repair: Ten failures/43 passes transcribed; owner voice, verifier-files leak, missing families/dirty cases, independent credit and authored-Run/server-library gates repaired.

Sources: [PLATFORM_FAILURES.md](../rubric-fix-2026-09-26/PLATFORM_FAILURES.md), [FIX_SUMMARY.md](../rubric-fix-2026-09-26/FIX_SUMMARY.md).

### E3 — 3 flagged checks

Archive linkage: QC report states latest three screenshot flags; Functional delta identifies the local baseline as 998f. The raw screenshot-to-ZIP association is not preserved.

Check IDs: instruction_is_achievable_and_unambiguous_in_the_environment, dimensions_cover_every_graded_requirement, no_criterion_grades_the_unrequired.

- The stop-versus-supersede explanation was ambiguous; a correct app could cancel A when B starts without emitting a separate supersession notification.
- The criterion nevertheless required that unrequested supersession notice. This is the same concrete cause under a second check ID.
- The private-file confidentiality promise had no HTTP observation; a whole-working-directory static server could pass the previous UI checks.

Repair: Make supersession notice optional; add bounded HTTP privacy observation. Also locally discover CSS/debounce/presentation issues.

Sources: [QC_FINAL.md](../full-qc-2026-09-27/QC_FINAL.md), [FUNCTIONAL_DELTA.md](../full-qc-2026-09-27/FUNCTIONAL_DELTA.md).

### E4 — 2 flagged checks

Archive linkage: Local semantic report explicitly associates the two latest screenshot findings with d254. No raw platform result metadata.

Check IDs: instruction_is_achievable_and_unambiguous_in_the_environment, dimensions_cover_every_graded_requirement.

- The completed preview lifecycle was unspecified after the first five-second budget, yet later click behavior was expected. Public wording now distinguishes initial Run, completed interaction, pending callbacks and invalidated execution.
- A few Tab stops plus shortcut tests did not show that examples and saved snippets could be selected without a pointer.

Repair: Clarify public later-interaction lifecycle and exercise delayed click/key/input; perform actual keyboard route; add golden escape help.

Sources: [SEMANTIC_FIX_REVIEW.md](../interaction-keyboard-fix-2026-09-27/SEMANTIC_FIX_REVIEW.md), [KEYBOARD_RECHECK.md](../interaction-keyboard-fix-2026-09-27/KEYBOARD_RECHECK.md).

### E5 — 8 flagged checks

Archive linkage: Repair report calls these reported failures and supersedes metadata-only09f; historical handoff identifies09f as current. Direct submitted-ZIP identity is not independently present.

Check IDs: instruction_states_deliverables_and_runtime_contract, instruction_is_achievable_and_unambiguous_in_the_environment, timeouts_fit_the_work, no_criterion_grades_the_unrequired, criteria_are_independent_and_noncontradictory, criteria_are_outcome_based_and_browser_decidable, criterion_description_is_self_consistent, task_is_distinct_and_authored.

- Deliverables/runtime: theme/host controls were required to respond during a literal infinite loop, although post-termination usability was the product promise.
- Deliverables/runtime and achievability: editor escape documentation was demanded; an app with working native Escape-then-Tab but no help label could falsely fail.
- Workload: judge-written private-file classification, network instrumentation construction, repeated recovery save/reload chains and a late restart added work. The repair supplied a tested network recipe, removed redundant mutations and moved restart early; hosted timing remained unmeasured.
- Unrequired grading: the same during-loop responsiveness and mandatory escape-help requirements were removed; fixed named-route privacy expectations were made explicit in that repair, later exposing the exact-probe leakage defect.
- Independence: dispatch shared one score with delayed click/key/input; original-run shared-budget behavior shared a score with pending-interaction nonextension and redundant persistence legs.
- Browser decidability: the privacy classifier required source/package/database-body interpretation while the judge otherwise forbade implementation inspection.
- Browser decidability: network denial required a real successful unrestricted tool control; ad-hoc instrumentation or DNS/CORS failure could not prove blocking. The repair supplied the actual MCP setup/count/cleanup recipe and incomplete-evidence handling.
- Self-consistency: measuring a valid app delay but observing OFF/cancel for a fixed two seconds could miss a run at2.1s; use max(3s, measured delay+1s).
- Self-consistency: replay of an old request proves stale server refusal but cannot prove a live dirty editor retained its draft. Use two actual pages and UI conflict/recovery; stale-rename checks own server invariants separately.
- Distinct/authored: short product metadata, hard difficulty and Local library badge replaced scaffolding/style contamination.

Repair: Remove loop-host responsiveness and mandatory escape documentation; split dispatch/late interaction and clock budgets; replace byte-classifier privacy with reserved paths; correct negative windows and real dirty-editor proof; simplify work and repair cleanup/report handling.

Sources: [QC_FINAL.md](../eight-issue-fix-2026-09-27/QC_FINAL.md), [FUNCTIONAL_REPAIRS.md](../eight-issue-fix-2026-09-27/functional/FUNCTIONAL_REPAIRS.md), [previous_handoff.md](../eight-issue-fix-2026-09-27/previous_handoff.md).

### E6 — 2 flagged checks

Archive linkage: Privacy design review explicitly names rejected63a05; final QC says two platform findings repaired and supersedes63a05.

Check IDs: instruction_leaks_no_grader_machinery, criteria_are_independent_and_noncontradictory.

- Leakage/undercoverage: public exact /app.db,/server.js,/package.json reservations and explicit exclusion of other paths let deny-only-three pass while companion/package/repository files leaked.
- Restart depended on separately graded Duplicate/Delete, so missing Duplicate could also lose restart credit.
- Normal deletion, stale-delete preservation and no deleted-identity upsert were bundled; missing stale protection could erase earned normal-delete credit.

Repair: Return public privacy text to categories and privately sample nine paths with public-role alternatives; independent New/Save restart; split deletion1+1+1.

Sources: [QC_FINAL.md](../two-findings-fix-2026-09-27/QC_FINAL.md), [privacy-design-review.md](../two-findings-fix-2026-09-27/semantics/privacy-design-review.md), [qc_final_findings.json](../two-findings-fix-2026-09-27/qc_final_findings.json).

### E7 — 2 flagged checks

Archive linkage: README explicitly says platform rejected5d0 for the two named checks. No run ID/QC version/settings.

Check IDs: timeouts_fit_the_work, criteria_are_independent_and_noncontradictory.

- Timeout-fit risk remained: long multi-leg rubric and unmeasured full judge work; source review, not a demonstrated timed-out Oracle.
- Import/exact transfer could work while server filename validation failed.
- Title trimming, collision behavior and case-sensitive title coexistence could work or fail independently.
- Automatic startup and separate unchanged built-in examples could work independently.
- Language dispatch could work while CSS retained old handlers; independent feature credit was still bundled.

Repair: Separate37 bundles into88 outcomes with shared protocols; split import/server validation, trim/collision/case, startup/example separation and dispatch/CSS handlers. Reduce repeated setup; full LLM timing remains unmeasured.

Sources: [README.md](../structural-review-2026-09-27/README.md), [QC_FINAL.md](../structural-review-2026-09-27/QC_FINAL.md).

### E8 — 2 flagged checks

Archive linkage: README explicitly says two platform findings against7d693e9. Raw platform execution metadata absent.

Check IDs: negative_checks_have_positive_controls, criterion_description_is_self_consistent.

- Auto-run OFF silence could pass when automatic execution was entirely dead; require real enabled automatic execution and later deliberate execution of the same pending source.
- CSS marker silence could pass after the preview/button was deleted, hidden or disabled; require original live handler, retained document and available button, then an actual click.
- S06 successful standalone delivery without resolved public role satisfied both the ambiguous/incomplete branch and the unconditional exposure branch. Ordered terminal decisions now exclude competing verdicts.

Repair: Require actual positive control facts without sibling verdict inheritance; sixteen descriptors audited; ordered terminal S06 classification and independent fallback controls.

Sources: [README.md](../positive-controls-fix-2026-09-27/README.md), [QC_FINAL.md](../positive-controls-fix-2026-09-27/QC_FINAL.md), [change_summary.json](../positive-controls-fix-2026-09-27/change_summary.json).

## Why a check name appeared again

**Instruction hygiene/leakage — Same broad family, different concrete witnesses.** E1 literal ID collisions were removed. E2 actual text verifier files remained because an ID-only change never addressed it. E6 newly public exact privacy probes exposed the evaluation boundary. Later leakage does not show the renamed IDs regressed.

Evidence: [CRITERION_ID_CROSSWALK.md](../instruction-hygiene-fix-2026-09-26/CRITERION_ID_CROSSWALK.md), [PLATFORM_FAILURES.md](../rubric-fix-2026-09-26/PLATFORM_FAILURES.md), [privacy-design-review.md](../two-findings-fix-2026-09-27/semantics/privacy-design-review.md).

**Independence — Repeated check ID with different witnesses, plus incomplete breadth of earlier repairs.** E2 split export/import, isolation/unsupported, native/in-app warnings and four error paths. E5 split newly combined dispatch/late interaction and run/interaction clocks. E6 found restart prerequisites and deletion bundling. E7 found import/filename validation, trim/case/collision, startup/example and dispatch/inert copying. Earlier narrow splits did not prove all remaining bundles independent; the reports do not establish the exact repaired export/import conjunction returned.

Evidence: [PLATFORM_FAILURES.md](../rubric-fix-2026-09-26/PLATFORM_FAILURES.md), [FUNCTIONAL_REPAIRS.md](../eight-issue-fix-2026-09-27/functional/FUNCTIONAL_REPAIRS.md), [QC_FINAL.md](../two-findings-fix-2026-09-27/QC_FINAL.md), [README.md](../structural-review-2026-09-27/README.md).

**Coverage — Same broad check, different missing observations.** Unsupported families/stale rename/dirty transitions were early omissions; HTTP exposure was another; keyboard route was another. A coverage map confirming existing checks were justified did not establish all promises had observations.

Evidence: [REQUIREMENT_COVERAGE.md](../rubric-fix-2026-09-26/REQUIREMENT_COVERAGE.md), [QC_FINAL.md](../full-qc-2026-09-27/QC_FINAL.md), [SEMANTIC_FIX_REVIEW.md](../interaction-keyboard-fix-2026-09-27/SEMANTIC_FIX_REVIEW.md).

**Timeout fit — Repeated unresolved measurement risk.** E5 reduced work but explicitly left hosted completion unmeasured. E7 again reported timeout fit; the later README says this was a source-review risk, not an observed timed-out Oracle. Current663e QC still marks timeout fit Not exercised/P1. The90.16s local automation run excludes LLM orchestration and cannot close it.

Evidence: [QC_FINAL.md](../eight-issue-fix-2026-09-27/QC_FINAL.md), [README.md](../structural-review-2026-09-27/README.md), [QC_FINAL.md](../positive-controls-fix-2026-09-27/QC_FINAL.md).

**Positive controls detached by88-outcome split — Documented regression introduced by a repair.** Before the split, broader Auto-run and language criteria included the working positive path. The7d short OFF-silence and CSS-inert descriptions could award credit to dead Auto-run or erased content. The positive-controls README explicitly identifies separating credit as the cause; current controls and actual mutants repair it.

Evidence: [README.md](../positive-controls-fix-2026-09-27/README.md), [change_summary.json](../positive-controls-fix-2026-09-27/change_summary.json), [FOCUSED_PROOF_SUMMARY.json](../positive-controls-fix-2026-09-27/golden/FOCUSED_PROOF_SUMMARY.json).

**Exact reserved privacy path contract — Documented regression/undercoverage introduced by a prior fix.** 09f public text described private categories and allowed similarly named public scripts. The eight-issue repair replaced that with exact reserved /app.db,/server.js,/package.json and excluded other filenames. The63a rejection then showed deny-only-three could pass while leaking companion/project/repository files;5d restored category-level public requirements.

Evidence: [security.md](../metadata-cleanup-2026-09-27/archive-check-09f4f6cb3647/colderwater-playground-devtools/environment/instructions/security.md), [security.md](../final-cross-check-2026-09-27/archive-check-63a05a5e4ebf/colderwater-playground-devtools/environment/instructions/security.md), [privacy-design-review.md](../two-findings-fix-2026-09-27/semantics/privacy-design-review.md).

**Privacy ambiguity versus exposure — Contradiction in the public-role repair persisted into the shared protocol rewrite.** The5d privacy design accepted unresolved credible public-role ambiguity but separately called any successful standalone delivery without established role/fallback an exposure.7d carried this competing classification forward.663e makes accepted outcomes, narrow terminal incomplete, and observed exposure mutually exclusive. This is distinct from the earlier missing-path coverage defect.

Evidence: [privacy-design-review.md](../two-findings-fix-2026-09-27/semantics/privacy-design-review.md), [frozen_final_inputs.json](../structural-review-2026-09-27/golden/frozen_final_inputs.json), [README.md](../positive-controls-fix-2026-09-27/README.md).

## Events that are not additional platform rounds

- **App CDN/network policy correction:** Explicitly triggered by feedback on the other task, then applied here; not counted as an independent Colderwater platform QC episode.
- **b34 to d254 cross-check:** Local restart/redirect findings, expressly no platform attempt.
- **a017 to63a cross-check:** Local compatibility and fairness findings, expressly no platform attempt.
- **0035,9160,9b8567 to663e intermediate positive-control candidates:** Local frozen-source edits during one repair, not repeated platform runs. Preserved manifests prove differing prompt/descriptor inputs.
- **Local browser false/incomplete then corrected/composite results:** Known external driver issues (CRLF/selector/feedback/status collision) with preserved diagnostics. They do not compare platform QC under identical settings.

## What can be said about nondeterminism

No Colderwater directory exists under run-outputs, and the independent content search found no Colderwater platform-run artifact there. The ten-failure screenshot transcript lacks an uploaded ZIP hash, run ID, QC version and settings. Later reports provide explicit or contextual version links, but still no comparable pair of original platform results.

Therefore, “the checker changed its mind on the same submission” is unsupported by these files. Reviewer variability remains possible; it is not measured here. Changed ZIPs, different concrete counterexamples under broad check IDs, known local review omissions and documented regressions already explain the observed history without requiring a nondeterminism claim.

The current663e report still carries timeout fit as Not exercised/P1. Source/browser checks support bounded claims, while full hosted Oracle quality and150-minute LLM orchestration remain unmeasured. This history alone cannot guarantee that a last attempt will pass.

Read history_evidence.json for full archive hashes, exact file deltas, source hashes, evidence confidence and the distinction between reported feedback and proven platform-run metadata.
