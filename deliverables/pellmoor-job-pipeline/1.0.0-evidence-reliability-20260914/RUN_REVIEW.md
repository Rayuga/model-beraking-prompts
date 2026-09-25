# Pellmoor Oracle and GPT review — 14 September 2026

The uploaded runs evaluated the browser-check revision, platform checksum `0375265f2be8307e5a1b783036d0ab09a5558075fe987cdf80956ddd891d522d`. Their recorded verifier hashes match the frozen browser-check package. Available deployed Oracle source files also match the golden solution. No trial exception was recorded, and the final rewards recalculate correctly.

| Submission | Reward | Functional | Polish | Visual |
|---|---:|---:|---:|---:|
| Oracle | 0.9572 | 0.9286 | 1.0000 | 1.0000 |
| GPT-5.4-mini | 0.7083 | 0.6888 | 0.6000 | 0.8750 |
| Gemini 3.7 Flash | 0.8354 | 0.8673 | 0.7000 | 0.8750 |
| Claude Haiku 4.5 | 0.1522 | 0.0204 | 0.2000 | 0.5000 |
| No-op | 0.0000 | 0.0000 | 0.0000 | 0.0000 |

All four actual submissions passed Render and Constraints. No-op was correctly ungraded. GPT now renders, so this attempt provides business-workflow evidence rather than the gate zeros from its previous two submissions.

## Oracle's three Functional deductions

Oracle passed 37/40 Functional criteria. Its seven lost weighted points came from:

1. **Lost response / live-view recovery, weight 2:** The original request committed and the UI showed uncertainty, but the judge navigated away from the unresolved first UI. The actual retry/live-view checkpoint was lost. This is reported missing setup/evidence, not a demonstrated golden retry defect.
2. **Historical batch receipts / actor isolation, weight 3:** Cal reused Ruth's historical operation and obtained mismatch/stale errors. The criterion demanded an authorization response even though stale metadata and Cal's own prior receipt can determine that response. The agent-visible contract prohibits recovering another person's receipt; it does not prescribe the ordering of these refusals.
3. **Receipts after restart, weight 2:** Several batch and note results replayed correctly, but the judge failed to retain and replay the original individual ROLE-017 success and full-capacity rejection. These receipts must remain distinct from the later ROLE-014 batch A/B labels.

The local golden replay reproduces the actor distinction: Cal's historical request receives 409 stale, a changed request against Cal's own saved identity receives 409 mismatch, and an otherwise-valid current batch as Cal receives 403 authorization. All preserve product state. The current-authorization control is tested while A/B are still fully assessed interview candidates and two openings are free, before Ruth commits them. The historical probe cannot expose Ruth's saved success.

## Implemented verifier repair

- Functional prompt revision advances from r6 to r7.
- A verifier-owned `capture-loss.js` helper captures the actual upstream response, holds it during duplicate activation, aborts delivery, and removes its interceptor. Request arrival and upstream fetches have explicit timeouts. The original page remains untouched while a second authenticated context withdraws the candidate.
- The helper was tested through the pinned Playwright MCP's actual `browser_run_code_unsafe` tool. That runtime does not provide normal global timer functions; the final helper uses supported Playwright waits. It captures one real response with no setup error in the transport fixture.
- `receipt-ledger.py` retains six original captures in verifier-owned files. It validates labels, actors, status classes, request metadata and before/after checkpoints; refuses replacement of an original receipt; and lists missing captures before the one restart. A complete ledger is evidence availability, not automatic behavioral credit.
- The actor-isolation criterion now tests historical cross-person replay separately from a fresh, otherwise-valid unauthorized batch. It still requires authorization enforcement and no access to Ruth's saved success.
- Individual capacity checks now require the precise fresh request, current revision, complete assessment, full-capacity refusal reason and immediate unchanged state. A stale, mismatched, malformed or unauthorized 4xx cannot be credited as capacity enforcement.
- The runner records hashes for both helper files alongside existing prompt/judge/runner provenance.

All 60 criterion IDs, types and weights, the reward postprocessor, timeouts, task configuration, agent-visible requirements and golden solution remain unchanged. No score was rewritten.

## GPT: genuine failures and a false-positive capacity finding

GPT scored 0.7083, which is 0.0083 above the requested ceiling. Its recorded Functional result is 27/40 criteria, 67.5/98 weighted points.

Reported concrete defects include accepting an offer without a complete panel/assessment; allowing a second request during a pending note save; accepting an operation identity on another candidate's route; previewing capacity using only eligible members rather than the full selection; and reusing a stale operation identity after re-review. The source also restricts eligible panel members to Otis/Wren, even though the brief permits Ruth. Some panel/reopening deductions describe incomplete journeys and need better retained evidence to distinguish each exact failed observation.

The 8-point rejected-replay/mismatch criterion was denied because its full before/after checkpoint was not retained. Lost-response and later receipt checks also lost capture evidence. Those are not established backend defects merely because they received zero.

The recorded pass for `competing_offers_cannot_overbook` is contradicted by the exported stage handler and a local diagnostic. `backend/server.js:613–634` accepts legal stage moves without checking offer readiness or vacancy capacity. On an isolated copy of the unmodified GPT source, the diagnostic:

1. Creates two ROLE-017 applicants through the public API.
2. Advances both to interview, assigns Otis/Wren, and records both current scores.
3. Offers the first applicant, leaving zero available openings.
4. Offers the second with a fresh operation identity and the current revision.

The second request returns **200**, with **openings=1, reserved=2, filled=0, available=-1**. See `gpt-capacity-probe.json`, which retains the request and complete before/after vacancy snapshots. This also undermines credit for the later criterion requiring a historical full-capacity rejection: that receipt must first exist as an actual capacity refusal.

The diagnostic used the exported source unchanged, with API-based setup and locally available compatible dependency versions: Express 4.21.2, cookie-parser 1.4.7, and the cached Node/better-sqlite3 environment. Seven JavaScript dependency versions differ from the uploaded lockfile; these are recorded in `diagnostic-dependencies/diagnostic-version-overrides.json`. It is a targeted local reproduction, not a fresh platform run, a browser-workflow grade, or an adjusted GPT reward.

Polish deductions concern color-only vacancy selection, missing navigation/dialog semantics, keyboard/focus handling and absence of a usable drawer-dismiss flow. The keyboard judge also reports accidentally reaching a Reject control and submitting a stage change, so its observations must be understood with that side effect. Visual deductions concern small secondary text, muted contrast and comparatively simple presentation. Those recorded scores have not been changed.

## What this means for the target score

The next step is accurate reevaluation of the existing requirements, not additional weight or threshold changes. Correctly detecting capacity bypass can lower GPT's score; restoring previously missing retry evidence can raise it. The net result cannot be predicted reliably from this run. No in-range result is claimed for the repaired verifier.

The previous Oracle 1.0 and this Oracle 0.9572 used unchanged golden/verifier bytes; the different outcomes reinforce the evidence-reliability problem. Local passing tests show that the golden solution can meet the repaired checks, but only a fresh platform evaluation can establish Oracle 1.0 for the new package.

## Other models

Gemini remains an unrestricted comparison. Its 0.8354 includes evidence gaps in the role matrix, absent-panel-member probe, response capture and retained capacity receipts, plus reported product defects in bad-login feedback, hired/offer conversion, narrow batch tables and focus/touch handling. The repaired capture/ledger procedures apply equally to it.

Haiku now passes the browser/auth gates, but exposes missing creation/editing controls, undefined candidate fields and incorrect funnel figures. Its low result is therefore materially different from its earlier blank/nonfunctional-control gate zero. Full original criterion reasoning for all models is retained in `uploaded-run-review.json`.

## Validation and limits

- 11 golden browser/API regression groups pass, including real batch response loss, repeat activation, exact retry, second-context withdrawal, historical actor probes, and all six original receipts replayed after a real managed restart.
- Eight ledger checks cover malformed captures, wrong actors/statuses, replacement refusal and incomplete evidence detection.
- Actual pinned MCP execution verifies helper compatibility using a synthetic transport fixture. It is not a product score.
- The real wrapper's local synthetic reward is 0.58 solely to test reward handling. It is not an Oracle/model evaluation.
- Standard configuration checks, archive checks and exact image-build attempts are recorded beside the package. The inherited generic upload checker has an exact-wording failure also present in the previously evaluated package; no generic upload or platform-QC pass is claimed.
- Harbor is not authenticated in this session. Fresh Oracle/GPT platform runs remain pending.
- The 186 uploaded files are hash-inventoried and left unchanged. Historical ZIPs and reports remain intact.
