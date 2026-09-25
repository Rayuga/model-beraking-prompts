# Common Ground Ballot — September 17 r27 rerun

**The fresh GPT run meets the requested target: 0.5788, with Render and Constraints both 1.0.** The supplied Oracle remains 1.0000 on the same r27 package. Keep r27 unchanged; no further hardening is recommended from this batch.

| Submission | Final | Functional | Polish | Visual | Render | Constraints |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Oracle iBeMVH2, previously supplied run | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1 | 1 |
| GPT-5.4-mini 3pecCc8, fresh | **0.5788** | **0.3357** | 0.9286 | 0.9583 | **1** | **1** |
| Claude Haiku 4.5 pWxzQKF, fresh | 0.0000 | 0.1111 | 0.8571 | 0.8333 | 0 | 1 |
| Gemini 3.7 Flash 97FPuUp, fresh | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0 | 0 |
| NOP cQy8rSn, previously supplied run | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0 | 0 |

## What changed in the measurement

These are new GPT, Haiku, and Gemini samples on unchanged r27. The Oracle and NOP have the same run IDs, trial IDs, and start/finish timestamps as the earlier export. Oracle did not run a second time in this evidence set.

GPT's Render judge observed a fresh ballot, successful Create and Open requests, Leila's accepted vote, Close and Publish, and persisted participation and a 1-vote/100% published result after reload. All six workspaces were reached across the appropriate accounts. Its score is therefore a nonzero weighted result, not a failed-gate zero.

The reported formula agrees exactly after rounding:

`0.6 × 0.3357 + 0.2 × 0.9286 + 0.2 × 0.9583 = 0.57880`.

## Functional findings and their limits

GPT received 34 yes and 32 no verdicts across 66 Functional criteria, earning 34.75 of 103.5 weighted points. The visible draft edit returned 404; the saved network evidence contains `POST /api/ballots/<id>/draft => 404`. The judge also observed that pending-action Retry emitted no request and did not resolve the entry, and the required conflict-review workflows were unavailable. These findings support real application limitations beyond the successful basic lifecycle.

Other deductions explicitly cite missing or incomplete evidence: the original Owen vote exchange, some malformed-input cases, the complete staff receipt replay ledger, roster race sequences, and several recovery exercises. Some depend on the failed edit flow. They must not be described as 32 independently reproduced backend defects. The judge completed normally, so these are not timeout or process-crash fallback scores. This review checked supplied verdicts and saved evidence; it did not independently replay every failure.

The margin below 0.6 is **0.0212**. At unchanged Polish and Visual, roughly 3.66 additional Functional weighted points would exhaust that margin; one additional 4-weight pass would put the score near 0.602. This single sample establishes the requested result, not a guarantee that every future sample will remain below 0.6. Further changes would invalidate the direct link to the measured Oracle result and require new validation.

Haiku's visible valid Create requests returned 400 and produced no new ballot, preventing the Render journey. Its Functional judge also recorded 500 responses on edit/Open/vote workflows. Gemini's visible login submitted an `operation_id` field rejected by its server with HTTP 400 (`Unexpected field: operation_id`), so the shared authentication gate failed. **This Gemini run was graded normally; it is not the previous provider billing-cap failure.**

## Provenance, completeness, and duration

- All five trials have task checksum `9c16b198807d890250b03d4c1c56efb8870ca6bd0c4de9b4d6e59c5cdf5b8210`.
- Every exported prompt, judge, runner, and reward hash matches r27. The five exported Oracle application files match the r27 golden solution.
- All four graded submissions produced all 86 verdicts across five dimensions. Every dimension completed in one attempt with return code 0; no trial reports an exception. NOP is the expected ungraded zero.
- Oracle received full credit on all 86 criteria. Its previously supplied grading took 65m44s; Functional took 39m30s.
- Fresh GPT grading took 52m16s; Functional took 36m38s. GPT's build took 16m17s and the entire trial took 69m02s. All dimensions stayed within their configured timeouts.
- The immutable ZIP SHA256 and all 29 packaged file hashes were rechecked. The archive is unchanged.
- No separate platform Static Checks or Rubric/Source QC result was supplied with these exports. Evaluation success does not establish platform rubric acceptance.

## Evidence and deliverable

- [Machine-readable analysis, including all non-full verdict reasons](analysis.json)
- [Arithmetic, completeness, provenance, reuse, and archive checks](verification.json), reproducible with [verify.py](verify.py)
- [GPT Render verdict](../../../run-outputs/common-ground-ballot/run-5980ca27-03f9-4f79-976a-dc1349d3c8c8/common-ground-ballot__3pecCc8/verifier/judges/render/attempt-0001/final.json)
- [GPT Functional verdicts](../../../run-outputs/common-ground-ballot/run-5980ca27-03f9-4f79-976a-dc1349d3c8c8/common-ground-ballot__3pecCc8/verifier/judges/functional/attempt-0001/final.json)
- [GPT saved network evidence](../../../run-outputs/common-ground-ballot/run-5980ca27-03f9-4f79-976a-dc1349d3c8c8/common-ground-ballot__3pecCc8/verifier/evidence/phaseD-ruth-network.txt)
- [Current r27 ZIP](../../../deliverables/common-ground-ballot/2026-09-17-review-safety-r27/common-ground-ballot.zip)

ZIP SHA256: `76b8cceb5eb22b2a48df6d53d58f647814516722b4beed6e8f7d7fef625cc578`.

Analysis and status documentation only: no task, golden solution, verifier, submitted application, or release archive was modified.
