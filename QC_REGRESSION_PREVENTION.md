# Preventing repeated rubric failures

This is the current preflight rule set after Colderwater's eight reported failures on 27 September 2026. It supplements the full [53 quality / 48 deterministic check procedure](harbor-webdev-rubric-qc/SKILL.md). A previous passing workbook or a working golden is not proof that a revised verifier treats other valid apps fairly.

## Further platform feedback: independence and timing

The later 37-criterion release still failed independence and timeout source review. Its earlier independence Pass was too broad: calling steps a single workflow did not make import, server filename validation, title normalization, title case policy, startup, example immutability and language isolation one outcome. Review every binary criterion with a partial implementation: if one useful feature works and an independently requested feature fails, identify exactly which credit survives. Do not stop at the examples named by the reviewer.

Separate the browser scenario from the scoring unit. One observed scenario may supply several independent facts and verdicts. Reuse actual setup and observations, never another criterion's verdict; rebuild only the state a failed action invalidated. Requiring a fresh baseline, control and recovery for every newly split row multiplies work and defeats this repair.

The 9,000-second allowance is 150 minutes. The platform's source finding is not evidence of a measured timeout. Record required waits, product actions, tool overhead, response size and full judge duration separately. A fast scripted browser run does not measure an LLM judge. RewardKit 0.1.7 discards a timed-out batch's results; `individual` mode has no durable checkpoint and applies the timeout to each fresh criterion call. Preserve incomplete-run invalidation. Do not turn missing observations into application failures or earned credit, and do not claim timing is resolved solely because the timeout sums fit.

## Before changing a verifier

The last-attempt review of unchanged `663e4d6d` corrected a reporting mistake: known asked-but-unobserved behavior had been left under a coverage Note. A complete 53-row disposition table is not an all-pass report. If a concrete wrong implementation can pass because no observation covers an explicit requirement, record a coverage Fail; do not hide it among finite-probe limitations. Colderwater examples were CSS-specific global isolation, dirty-editor retention after stale Rename/Delete, and the named HTML/CSS import types. Testing a later fresh JavaScript Run is not a CSS-global observation, request replay is not editor preservation, and JavaScript-only imports do not cover the closed set of three supported languages. Keep genuinely invisible implementation guarantees separate as an observability-policy question.

Track repeated QC findings by check ID, exact witness and archive hash. The same check ID can recur for different defects, while a repair can introduce a new one. Do not infer platform nondeterminism from changed archives. That claim needs comparable identical task bytes and reviewer/checker configuration with conflicting results; local review reports are not platform exports. Preserve the original failed evidence, label uncertain submission-version associations and distinguish source-review acceptance from a measured Oracle run.

The subsequent 88-outcome release exposed another split-scoring defect: “only each short outcome defines its pass boundary” detached the scenario's positive controls from its negative verdicts. Independent scoring must still require evidence that the exact protected operation works. Test a dead Auto-run switch and a CSS Run that removes the whole preview: neither may earn absence-only safety credit. Share successful observations, never require another criterion's complete verdict. A failed debounce-reset rule must not erase a genuinely observed automatic execution used to test the off switch.

For each negative row, record the successful operation/target, the forbidden action, and the observed boundary. Empty, disabled, missing or permanently rejected functionality is not a positive control. For conditional verdicts, write ordered terminal decisions and check the injected app context too. In S06, ordinary standalone delivery without public-role evidence is a local failure; the narrowly defined, concretely supported unresolved public-role observation is incomplete evidence. These branches must not overlap. A name, HTTP 200 or app claim alone cannot invoke ambiguity.

For every graded outcome, write down the public requirement, the browser observation, the criterion that owns its credit, and a reasonable alternative implementation that should pass. Read the public notes first. Do not turn the golden's implementation choice into a requirement.

Keep the following distinctions explicit:

| Question | Required evidence |
| --- | --- |
| Must the host stay responsive during execution, or only recover after termination? | Grade only the promise actually made. A five-second stop/recovery promise does not imply concurrent host responsiveness. |
| Must an editor be keyboard operable, or also explain its escape key? | Standard/native Escape then Tab can satisfy operability without a help label. Only the specifically requested command-shortcut documentation is mandatory. |
| Can two outcomes fail independently? | Give independently useful outcomes separate credit, preserving their combined weight. Keep one behavior's positive control, rejection and recovery together. |
| Is an observation about server state or a visible editor draft? | Request replay can prove server refusal. Draft preservation needs a real dirty editor and its real UI operation. |
| How long must an absent event be watched? | Measure its successful delay first; observe beyond that delay plus a margin. Never use a shorter fixed negative window. |
| Is the failure in the app or our test setup? | Retry setup once; unavailable evaluator evidence becomes an incomplete evaluation, not an invented app verdict or a free pass. |
| Does a security check need custom source interpretation? | Keep the public goal about private data categories. Use representative browser denial/fallback observations privately; do not copy the probe list into the brief or silently permit source inspection. |
| May an app commit a preview only after success? | Pending candidate DOM is optional. Accept retained last-good output, and accept temporarily blocked further input while the original deadline still applies. |
| Which successful state must recovery preserve? | Make one successful interaction change the document before inducing a later failure. Restoring the initial Run alone can hide lost committed work. |
| Does normalization work on successful writes? | Test a fresh padded title and a valid padded rename, not just padded collisions. Check the saved values after reload. |
| Does Stop work after successful completion? | Prove handlers work first, Stop that completed preview, then observe their inactivity and a new Run's recovery. Static or removed controls are valid. |
| Are built-in examples distinct from user records? | Edit any supplied example in its own language, save a separate copy, and reload both. Do not prescribe an example language the brief did not request. |
| Does report validation match the real producer? | Exercise the installed RewardKit CLI and its serializer, including empty optional fields. Handcrafted report fixtures can reproduce our own mistaken assumptions. |

The platform rejected the earlier public three-URL reservation. It exposed the exact test boundary and allowed a server that blocked only those names to pass while exposing other working files. That recommendation and its earlier passing review are superseded. Colderwater now states a category-level privacy goal, probes representative database sidecars/project/repository paths privately, accepts genuine intended public assets, and retains the source/body-inspection ban. Test a synthetic whole-project exposure that denies only the former three paths, alongside valid denial/fallback/public-asset alternatives. These finite observations are not an exhaustive security proof.

For criterion independence, remove unrelated feature prerequisites from setup. Restart durability needs independent ordinary saves and exact post-restart reads; it must not require Duplicate or Delete to create its fixtures. Normal confirmation/deletion, stale-delete rejection and refusal to update a deleted identity now have separate credit and independent records. Server-only protection checks do not grade confirmation UI. A missing convenience setting such as Auto-run must not automatically fail unrelated gates. Keep meaningful positive controls for the operation actually being tested; do not split every related action mechanically.

Network isolation still has a successful external-resource control fulfilled locally, two separate authored attempts, observed refusal, delivery counts and recovery. The supplied MCP recipe must execute on the actual installed tool.

## Before packaging

1. Run the known-bad counterexamples as well as the golden. For this repair, the keyboard route is also exercised with the shortcut hint removed. Test tool recipes, score-report equivalents and malformed evaluator reports independently.
2. Read every changed criterion together with its dimension prompt and injected `app_context.md`. A correct paragraph can still conflict with shared wording.
3. Keep a work/time ledger. Remove redundant setup, bound retries and put an independent process-restart check before the tail of a long suite. Timeout arithmetic is not a measured hosted duration.
4. Repeat appropriate local source, browser and harness checks. Preserve failed test-driver attempts and distinguish them from application failures. Reuse old evidence only for unchanged code and state that scope.
5. Freeze the source. Build the actual images and compare shipped bytes; package one root, verify CRC and extracted hashes, and review the exact final archive. Any subsequent task-file edit invalidates the affected bindings.
6. Complete all 53/48 dispositions with evidence. Use Note or Not exercised for unknowns, including full paid judge timing and subjective presentation. Reporting every row is review completeness, not platform acceptance.
7. Measure Oracle and target-model runs on the exact candidate when authorized. Do not promise Oracle 1.0, an upper model-score bound or zero future QC findings from local checks alone.

## Automated safeguards

The [Colderwater guard](scripts/check_colderwater_regressions.py) now delegates to [47 shared-scenario source checks](scripts/check_colderwater_structural.py). It checks the 93-outcome structure, unique evidence ownership and each of the 37 original feature budgets, alongside known contract protections, meaningful controls and the exclusive privacy decision rules. The [shared packager](deliverables/package_staged_candidates.py) runs it before packaging and on extracted files, alongside public criterion-ID, grading-vocabulary and network-policy guards. The rejected 37-row archive and the rejected 88-row release no longer pass the current packaging guard. Earlier guard counts and mutation reports remain historical; do not present them as current-run results. These are narrow source guards, not semantic certification. A passing guard cannot validate its own underlying assumptions.

The structural review also runs deliberately incomplete apps: working import with broken server extension validation, correct trimming with wrong title case policy, correct dispatch with inherited CSS handlers, and restart with Duplicate/Delete unavailable. Require the intended defect to remain visible while the independent functioning outcomes retain their evidence. Do not call an expected-defect fixture a fully passing app or an Oracle measurement.

The final cross-check reproduced a real RewardKit 0.1.7 compatibility defect: schema-valid empty reasoning is omitted when the score is serialized. Default that missing field to an empty string; continue rejecting explicit nonstring values, evaluator errors and incomplete markers. The previous fixture expecting omitted reasoning to fail was wrong and is superseded by actual CLI evidence. A passing mock harness alone is not proof of compatibility with its producer.

The verifier additionally rejects malformed/incomplete structured judge results, writes `evaluation-incomplete.json`, and preserves an ungraded zero. The platform may still display zero; the diagnostic means retry the evaluation after resolving its cause. It does not mean the app passed or that the platform will retry automatically.

Keep task metadata short and product-focused. Put QC histories, counts, weights, model targets and proof links in authoring reports, not in the user's product description. Current user preferences override older documentation examples that suggested lengthy metadata.


## Coverage repair: inspect the state the requirement actually names

A later fresh JavaScript Run cannot establish what a preceding CSS Run retained. Match the authored execution realm with a positive control, then inspect the current CSS state before replacing it. A failed realm lookup is not evidence of absence. Preserve legitimate alternate architectures and disclose a genuine browser-observation limit rather than reading implementation internals. Keep missing product behavior separate from unavailable evaluator evidence.

For a named finite supported set, exercise every stated member at least once: JS-only imports cannot establish HTML/CSS import support. Separate importer acceptance from server acceptance while preserving their combined reward mass. For stale Save, Rename and Delete, replay establishes server state only; each promised draft-preservation path needs an actual dirty editor and real UI attempt or explained deliberate prevention. Do not force disabled actions.

The coverage repair has 93 Functional outcomes across the same 37 protocols and the same 49.50 total. Runtime proof must include partial counterexamples: retained CSS state, conflict-only draft loss, and JS-only importing. A passing source guard is insufficient. Bind final reports to the actual extracted archive and describe full Oracle/runtime results as unmeasured until they are measured.
