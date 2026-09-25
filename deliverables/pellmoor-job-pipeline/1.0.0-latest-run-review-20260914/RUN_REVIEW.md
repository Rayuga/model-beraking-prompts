# Pellmoor latest uploaded runs: 14 September 2026

The new GPT-5.4-mini run scored **0.6327**, inside the requested 0.1–0.7 interval. The uploaded Oracle result is **the same historical 0.9572 run**, not a new failure of the repaired verifier. All 26 Oracle trial files are byte-identical to the previous audit. Gemini's 38 files and Haiku's 61 files are also unchanged.

Use the existing [r7 evidence-reliability ZIP](../1.0.0-evidence-reliability-20260914/pellmoor-job-pipeline.zip) for the next Oracle and GPT runs. This review makes no task changes and does not create another competing ZIP.

## Revision identity

| Evidence | Identity |
| --- | --- |
| Uploaded Oracle | `pellmoor-job-pipeline__Qc2r8HT` |
| Newly uploaded GPT | `pellmoor-job-pipeline__SqLBwbS` |
| Uploaded task checksum, all trials | `0375265f2be8307e5a1b783036d0ab09a5558075fe987cdf80956ddd891d522d` |
| Uploaded Functional prompt | `pellmoor-job-pipeline-functional-v1.0.0-r6` |
| Uploaded Functional prompt SHA256 | `7aadb46d8c0073da832b1e2a2874fa6e4b3db0bdb243cb72a9e5bf1f3c407282` |
| Recommended Functional prompt | `pellmoor-job-pipeline-functional-v1.0.0-r7` |
| Recommended Functional prompt SHA256 | `8915aec8a06c86f00c86f24c10e93b3875c217273d6429753ea4452b5b20a3f3` |
| Recommended ZIP SHA256 | `bf4c04a7637abe4a5812297d8f9ff6ca51ce79a330fd579fb244ee9aff9c2232` |

The platform task checksum and ZIP SHA256 are different identifiers; their inequality alone is not evidence of a revision mismatch. Here the mismatch is established directly by the recorded prompt and judge hashes. The r6 hashes match the older browser-check package. The active source and all 34 files in the recommended ZIP match the previously validated r7 manifest exactly.

## Recorded platform results

| Run | Overall | Functional | Polish | Visual | Render / Constraints |
| --- | ---: | ---: | ---: | ---: | --- |
| Oracle, unchanged upload | 0.9572 | 0.9286 | 1.0 | 1.0 | 1 / 1 |
| GPT-5.4-mini, new run | 0.6327 | 0.6378 | 0.5 | 0.75 | 1 / 1 |
| Gemini, unchanged upload | 0.8354 | 0.8673 | 0.7 | 0.875 | 1 / 1 |
| Haiku, unchanged upload | 0.1522 | 0.0204 | 0.2 | 0.5 | 1 / 1 |
| No-op control | 0 | — | — | — | Not graded |

GPT's solver used `gpt-5.4-mini` with effort `high`. The judge is `gpt-5.6-luna`; the shared task configuration retains effort `max`. The final reward is `round(0.6 × 0.6378 + 0.2 × 0.5 + 0.2 × 0.75, 4) = 0.6327`. The intermediate rewardkit log's aggregate 0.8776 is not the final task reward. No trial reports an exception.

## Oracle deductions and the existing repair

Only the Functional dimension lost credit, across three criteria totaling 7 of 98 Functional weight units:

| Criterion | Uploaded reason | Already implemented in r7 |
| --- | --- | --- |
| Lost-response recovery, weight 2 | The server committed, but navigation destroyed the first page's retry checkpoint. | Bounded real-response capture; preserve the first page and perform the competing withdrawal in a separate authenticated context. |
| Historical receipts after capacity release, weight 3 | Reusing Ruth's old request as Cal returned mismatch/stale rather than the expected authorization response. | Separate historical actor-isolation from a fresh, current-revision, otherwise-valid Cal authorization probe. Do not mistake stale metadata for an authorization test. |
| Receipt persistence after restart, weight 2 | Original individual winner/full-capacity receipts were not retained. | Six immutable labeled receipt files, separate individual/batch applicant identities, and a completeness check before the single restart. |

The unchanged golden app passed all 11 local workflow groups for r7, including these sequences. Its uploaded Visual and Polish scores are already 1.0. There is no new evidence justifying a golden UI or backend modification. The local checks support the repair; only a fresh platform Oracle run can establish a new 1.0 score.

## GPT: demonstrated problems

The recorded Functional result is 24 passes and 16 failures, earning 62.5 of 98 weight units. The complete 60-criterion GPT record, plus the other three graded models, is in [criterion-results.csv](criterion-results.csv).

- **Empty-vacancy creation is broken.** The judge could not add Ilse to ROLE-017. A local real-browser diagnostic reproduced it: the visible form submitted no candidate request, and the vacancy remained empty at revision 1. In the served bundle, the common submit handler returns when there is no selected candidate before reaching the add-candidate branch (`public/assets/app.js:5576–5594`). This blocks later individual capacity, identity and receipt setups. Those blocked outcomes are not proof that each underlying backend feature independently fails.
- **The funnel disappears after opening a candidate.** Local observation found one SVG after selecting ROLE-014, then zero SVGs/canvases and empty chart content after selecting a candidate. The source includes a D3 renderer; the issue is that candidate selection rerenders the workspace without redrawing the chart (`public/assets/app.js:5492–5496`). The judge's “div/CSS visualization without SVG” wording is therefore incomplete: the SVG exists in one state and is erased in another. Preserve this distinction rather than claiming D3 was never implemented.
- **Individual offers bypass complete-assessment requirements.** The judge observed an incomplete-panel offer and a reopened candidate reaching offer without all fresh scores. The individual stage handler checks capacity but omits the panel/current-score readiness check (`backend/server.js:856–922`). This is separate from the batch endpoint, which does check eligibility.
- **Ruth cannot join a panel.** The judge observed an ineligible-member rejection. The backend constructs eligible members from `role === 'panel'`, excluding the hiring manager despite the documented contract (`backend/server.js:21,949`).
- **Pending-state/duplicate prevention fails.** The judge reported duplicate notes and activity under repeated delayed activation. Treat that as the uploaded observation; the new local diagnostic did not repeat this mutation.
- **Blocked batch confirmation stays enabled.** The preview criterion failed because a blocked selection still offered confirmation, even though batch rejection requests were scored correctly.
- **Polish loses five checks.** Selected-vacancy indication relies on color, the drawer lacks a close control, keyboard focus is lost on rerenders, and the small batch checkbox/label was judged impractical for touch. Visual deductions concern clipping and dense layout, not a failed rendering gate.

## GPT: passes and evidence limits

Recorded passes include authentication/session revocation, initial seed fidelity, role checks, legal/illegal stage transitions, terminal locking, score boundaries, append-only notes, stale-revision handling, concurrent-write arbitration, successful note replay, malformed-write refusal, panel removal/readdition, hired/offer capacity conversion, several batch atomicity/rejection/race checks, and durable state after restart.

Do not treat every recorded pass as independently audited. In particular:

- Functional coherence claims a close/reopen interaction, while Polish says there is no close control. The served UI also lacks an explicit close action. This is a judge-evidence inconsistency requiring an actual demonstrated close/reopen checkpoint on a fresh run.
- The weight-8 rejected-receipt criterion failed because the original rejection was not retained. Missing evidence and an observed product failure are different findings. Static inspection also suggests a real risk: invalid-stage refusal is returned without storing a receipt, so an exact replay after another vacancy mutation may instead receive a stale response. This is a source-based hypothesis, not a newly executed platform test.
- Person-scope isolation was unavailable because ROLE-017 setup failed. Source inspection shows receipt lookup scoped by actor, operation, method and path (`backend/server.js:560`), which suggests reuse on another route may evade the required person-wide mismatch. Again, this is an unexecuted follow-up hypothesis, not a replacement score.
- The previous GPT run's demonstrated overbooking must not be attributed to this new submission: this backend has an explicit individual capacity guard. Its required capacity race still lacks uploaded evidence because creation failed.
- Several lost-response/historical/restart deductions combine unavailable product setup with missing captures. The r7 repair addresses harness reliability but cannot repair the submitted application's broken form.

## Further hardening decision

Keep the current public requirements, golden solution, criterion weights and reward formula. The useful tightening is already in r7: exact original response capture, current-revision capacity refusal with an explicit capacity reason, independent authorization controls, and retained evidence across navigation and restart. Apply these checks identically to Oracle and every model.

Do not add new requirements merely because GPT is near a threshold. First obtain a clean Oracle and GPT evaluation on the exact r7 ZIP. On those runs, require observable evidence for chart persistence, drawer close/reopen, panel readiness, cross-route operation mismatch, and rejection replay after a revision change. These are existing requirements. If repeated judge gaps remain, clarify the relevant evidence procedure, preserve successful observations as well as failures, and rerun both models on that revision.

The current 0.6327 is an in-range **r6** result; it is not a certified result for r7. Better evidence collection can increase or decrease GPT's next score. Fresh model generation and judgment also vary, so neither Oracle 1.0 nor a future GPT score below 0.7 can be guaranteed.

## Validation and handover

- Verified all 34 task files against the frozen r7 ZIP and its manifest; ZIP CRC passed.
- Reran the standard checker against the extracted package: **139 checks passed**.
- New local browser diagnostic reproduced the empty-vacancy form bug and transient SVG loss without editing the uploaded application or database. It used a fresh isolated database and cached compatible server dependencies; it is not an exact platform-image reproduction or a rescore.
- The first local diagnostic attempt lacked the top-level Playwright module. The harness import was corrected to the image's installed MCP dependency; the subsequent diagnostic passed. No product files were changed.
- Previous r7 golden validation remains applicable because source and package hashes are unchanged. It was not rerun or presented as new platform evidence.
- Existing limitations remain: exact image builds were blocked by dependency-network failures, and the generic upload checker has the documented inherited `Independent judgments render` exact-wording failure. The 139 standard checks do not imply either of those checks passed.
- This review preserves the current 185 uploaded files and all historical task ZIPs. `run-file-hashes.json` records the present upload; it differs from the previous manifest because the user replaced the GPT run.

Evidence: [machine-readable review](run-review.json), [browser diagnostic](gpt-browser-probe.json), [standard checks](standard-qc.json), [existing r7 implementation and validation](../1.0.0-evidence-reliability-20260914/README.md).

Next upload: **`1.0.0-evidence-reliability-20260914/pellmoor-job-pipeline.zip`**. Run Oracle first, then GPT-5.4-mini at solver effort `high` on that same ZIP. Confirm Functional provenance says **r7** and retain the verifier's receipt evidence. The unchanged Gemini and Haiku runs remain historical comparisons; no additional model run is needed to diagnose this Oracle issue.
