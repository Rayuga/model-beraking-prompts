# Pellmoor Oracle crosscheck, 15 September 2026

The frozen r8 golden application passed the fresh local Render/Constraints checks and the visual bounds checks. Manual review of representative screenshots found no additional material appearance defect. These observations support the existing fixes; they do not establish a new hosted Oracle score.

| Dimension | Latest uploaded Oracle, r7 | Fresh local check of frozen r8 |
| --- | --- | --- |
| Render | 1.0; both criteria passed | Passed public entry, controls, authenticated workspace and reload checks. |
| Constraints | 1.0; both criteria passed | Passed local entry and reload checks, including the shared authentication prerequisite. |
| Visual | 0.9583; spacing lost credit for clipped dialog controls | No horizontal overflow, clipped batch actions or page errors in 88 captures; sampled appearance review found no new material defect. No numerical score assigned. |

The uploaded Oracle trial is `pellmoor-job-pipeline__sfvtUWB`, task checksum `23c88a5ab83d1877cad1fd16d23bc9f0d7c5773fc801e16663a599eaa3fe21b2`. Its overall reward remains 0.8386, Functional 0.7449 and Polish 1.0. It evaluated r7, so it cannot certify the r8 repairs.

## Scope of the verifiers

Render and Constraints already contain only two basic criteria each. They do not require completing batch workflows. The shared authentication prerequisite checks the required real login and protected data behavior, and passed in the fresh browser test. No unnecessary condition was found to remove.

Visual retains the six published appearance axes and the required desktop/phone surfaces in both themes. It accepts ordinary vertical scrolling and does not demand pixel matching, additional branding or decorative assets. The audit treats reachable content inside a scrolling dialog as valid, while checking that action controls remain visible. No criteria, weights, scores, prompts or task files were changed during this crosscheck.

The r8 golden layout already replaces the clipped batch footer with a bounded dialog, a scrolling body and a fully visible footer. The prior Functional evidence repairs also remain in r8: preserved primary browser sessions, capture of operation responses before later UI waits, and durable checkpoint receipts. The earlier r8 validation passed 13 workflow groups; those results are retained in the [r8 validation report](../1.0.0-r8-reliability-20260914/README.md) and were not represented as newly rerun Functional checks today.

## Fresh evidence

- [Render and Constraints review](render-constraints/REVIEW.md): all 10 actual Playwright MCP 0.0.79 checkpoints passed, exercising all four criteria. Anonymous protected reads failed before and after the exact wrong-password attempt; the original valid session reopened the candidate after reload. Hiring product records were unchanged.
- [Visual review](visual/REVIEW.md): 88 captures across 1280x800 and 390x844, both themes, seed records and longer lists/history. Coverage includes sign-in, vacancy overview/funnel, candidate details, empty states, batch selection and blocked review. Automated bounds/error checks cover every view; manual appearance inspection samples the captures.
- [Visual measurements](visual/results.json): no horizontal page overflow, clipped batch action controls or uncaught page errors. The first attempt's four premature dark sign-in captures were preserved under `visual/attempt-1`; the corrected complete rerun waits for sign-in and visual transitions.
- [Standard QC](standard-qc.json): all 139 checks passed. [Archive QC](upload-qc.json): all 400 checks passed, with 36 task files and 60 criteria.
- [Integrity and result summary](crosscheck-summary.json): the ZIP, all 36 extracted task files and the corresponding active project files match the frozen manifest. All 202 uploaded run files remain unchanged. [Verification script](verify-crosscheck.py) reproduces these checks.

## Remaining validation

Both fresh browser suites used the cached `pellmoor-tests:2.0.3` image with the exact frozen r8 golden files copied and compiled inside it. Fresh builds of the exact delivery images were attempted separately and failed on local dependency downloads:

- The [environment build](environment/environment-build-status.json) could not resolve the configured package-download proxy. Its exact browser-launch check could not run because the image did not build.
- The [verifier build](verifier-build-status.json) timed out repeatedly fetching PyYAML from PyPI.

These download failures do not contradict the successful cached-image browser checks, but the exact final images remain unverified. A new hosted Oracle run is still required to confirm that every judge collects its evidence and that the full score reaches 1.0. The existing local results cannot guarantee that outcome.

The task package is unchanged: [r8 task ZIP](../1.0.0-r8-reliability-20260914/pellmoor-job-pipeline.zip), SHA256 `e2cb22b029d958b29bc817003149236a0b0baa51803982fbee1d69ee171c81af`. This folder contains supplementary validation evidence only; it is not a replacement task submission.
