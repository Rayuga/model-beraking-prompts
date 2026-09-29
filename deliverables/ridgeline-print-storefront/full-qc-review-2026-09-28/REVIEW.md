# Ridgeline complete QC review — 2026-09-28

**Not upload-ready under the latest lead policy.** This is a review of current source, not a hosted QC verdict. No task source, running preview or release archive was changed.

All 53 quality items and 48 deterministic-check requirements from `WebDev Rubrics QC.xlsx` have individual dispositions in [QC_REVIEW.xlsx](QC_REVIEW.xlsx) and [qc_findings.json](qc_findings.json). The deterministic entries are local/manual equivalents; the private platform checker executables were not run. The independent source audit passed **94/94 local assertions**.

## Remaining findings

1. **Frozen-template compliance:** `test.sh`, `scoring.toml`, both shared Python tools, both Dockerfiles and `.dockerignore` exactly match the template. All five judge headers, timeouts and verifier environment match too. However, ten other files with no `CHANGE_ME` marker still differ: integration instructions, all five prompts, and render/constraints/polish/visual judge files. Metadata also adds two tags outside a placeholder. See the exact list in [template_and_archive_comparison.json](template_and_archive_comparison.json).

   These differences include previous QC repairs. Blind restoration could reintroduce weak server gates, conflicting visual anchors or other earlier problems. The current template and the lead's permitted-edit scope need reconciliation before calling this compliant. This review did not silently undo those fixes.

2. **Mobile checkout coverage:** the brief promises phone use, but the required Polish mobile observation covers only catalogue and basket. Visual may inspect any two mobile surfaces and explicitly delegates mobile operability to Polish. A temporary browser CSS counterexample hides the delivery form only on mobile while preserving those catalogue/basket observations and desktop checkout. This is a gap in the written probes, not a failing golden feature: the unmodified golden mobile form was visible. [Probe results](mobile-probe/boundary-observations.json), [golden screenshot](mobile-probe/golden-mobile-checkout.png), [counterexample screenshot](mobile-probe/counterexample-mobile-checkout.png). This experiment did not run a full judge or claim a measured full score for the counterexample.

3. **Stale ZIP:** `ridgeline-print-storefront-final.zip` differs from current source in eight files, including the harness, integration notes and rubric. Do not upload it as the reviewed current candidate. Regenerate and verify the archive after resolving the findings.

4. **Unmeasured judge behavior:** timeout nesting fits the canonical limits, but a complete judge session has not been timed. Neither Oracle 1.0 nor the desired Luna score range is measured. Keep the frozen budgets; do not infer workload fit from fast scripted browser tests.

## Previous five Ridgeline findings

| Previous finding | Current source evidence |
|---|---|
| Undisclosed postage band/weight display, flagged under two QC headings | Functional prompt explicitly says grams/band names are explanatory, not required labels. Relevant observations require the amount and collection status. |
| Bundled search/filters/sorts and duplicate mobile penalties | Search, size, paper, title sorting and price sorting have separate outcomes. Polish owns mobile usability; Visual owns composition. The newly found checkout coverage gap remains separate. |
| Public external assets incorrectly failed the gate | Integration and constraints explicitly allow external fonts, scripts, images and CDN assets; external backend dependence remains prohibited. |
| Two independent browser contexts unavailable to the judge | Functional prompt supplies an installed `browser_run_code_unsafe` context recipe preserving the original browser; matching local browser evidence exercised it. |

These are **source fixes**, not proof that hosted QC has accepted the new version.

## Evidence and practical limits

- Current inventory: 42 Functional outcomes (total weight 35), seven Polish outcomes (weight 4), six Visual outcomes, and two gates. Original Functional feature budgets remain conserved.
- Canonical reward policy: both gates must pass, Functional must exceed 0.05, then `0.6F + 0.2P + 0.2V`.
- All 19 solution/installer files match the previously tested golden hashes. Recent matching evidence includes 13 commerce groups, nine browser groups and actual canonical launch/process restart. Harness judge scores were synthetic, not Oracle results.
- The current review's disposable no-network browser probe passed eight assertions. It used temporary CSS in its own browser and left the task and preview untouched.
- Quality dispositions: 32 Pass, 18 Note, two Not exercised, one Fail. Static-requirement dispositions: 29 Pass, 14 Note, four N-A, one Fail. These are local review dispositions, not platform scores.
- Every task file is SHA256-bound in `qc_findings.json`; source hashes were unchanged at the end of review. Old custom-harness guard results are not claimed as tests of the restored template harness.
- With full Polish and Visual, total reward is `0.4 + 0.6F`. A model must score Functional at most 0.5 to remain at or below 0.7. No model score is predicted as certain.

Next: reconcile the frozen-template conflicts, address mobile checkout coverage within the permitted scope, then build a fresh verified ZIP. A hosted evaluation is still needed to establish actual QC/Oracle/model results.
