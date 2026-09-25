Coursemark seed and HTTP-contract repair

The latest supplied platform screenshot passed 51 of 53 Rubric Source checks. Its two failures were valid authoring defects: AT-102 was declared graded/released without any rubric-grade records, and stale-write criteria required an HTTP status that the task never specified. Previous local checks shared the golden implementation's assumptions and did not independently prove seed/contract/rubric consistency. Passing those checks was insufficient evidence of semantic correctness.

This revision adds explicit historical grades for AT-102/RC-3 and AT-102/RC-4, both zero, graded by Ada. Both distributed seed copies contain the identical new collection; every pre-existing seed field remains unchanged. The golden bootstrap imports all supplied rubric-grade rows in its first-creation transaction. The records contract explains zero versus missing grades and historical import without new audit events. Nora's released result is now supported by actual complete rubric records: objective 5 + rubric 0 = 5/10. The 50.00% outcome requirement is consequently consistent with the data.

Stale revision and stale release-preview assertions now require 4xx, with 409 and 412 explicitly accepted. Replay must preserve the actual original status/body. Unchanged state, correct revision, visible conflict feedback and intentional recovery remain required. The contract's explicit operation-identity mismatch 409 is retained. An audit of every remaining exact status demand found the mismatch requirement supported by coordination.md and health HTTP 200 supported by overview.md.

Validation now includes an independent seed-invariant checker, covering uniqueness, foreign keys, course/role authority, assessment and accommodation timing, attempt limits, item/rubric point agreement, answer ownership, grade completeness and derived totals. It rejects the previous delivered seed and eight additional corrupted-seed cases. This is independent of the golden server's bootstrap.

Forty local API/browser groups passed. The five new groups prove:

- Fresh import includes both zero grades and displays their released feedback with 5/10 on mobile.
- A real process restart preserves grades and release state without duplicate grades or audit events.
- A separate fresh-database variant with scores 1 and 2 imports those values and produces 8/10, demonstrating that the importer does not hardcode the original totals.
- A separate app variant returning HTTP 412 for stale writes preserves state, original receipts and visible fresh-retry behavior.
- HTTP 412 for a stale preview binding rejects a fresh-revision bypass and supports visible re-preview/commit recovery.

The alternate implementation is a local diagnostic fixture outside the task ZIP. The delivered golden continues using HTTP 409 for stale conflicts, which remains a valid implementation choice. The rubric accepts other contract-compliant 4xx choices. These diagnostics are not platform model grades.

The actual runner's RewardKit discovery loaded all five configurations. The final package passes 145 repository standard checks, 419 archive checks, and ten reward-postprocessor cases. The source and extracted archive hashes match. The local runner's 0.58 fixture is synthetic and must not be reported as Oracle performance. Docker definitions are unchanged; the earlier fresh-build network limitation remains, and no new full-image build or platform QC/model run is claimed.

All 66 criterion IDs and weights, product difficulty, task version 1.0.0, timeouts and 60/20/20 scoring are retained. Functional prompt revision is r5; the other four prompts remain r4. The implementation change is the golden grade importer. The new released-feedback surface was visually inspected after browser capture.

Upload the task-named ZIP in this directory and rerun platform QC. Its semantic result and the GPT/Oracle scores remain unconfirmed. GPT around 0.4 and Oracle 1.0 are still evaluation targets, not promised outcomes.

Final ZIP SHA-256: `ea00f51799cb831ccfc114eb87d7a5dccd36ba7f469d0d6062b2c4b046bcb250`.

Evidence: seed-contract-check.json, seed-runtime.json, runner-logs/prompt-provenance.json, package-verification.json, upload-check.json, extracted-standard-check.json and seeded-released-feedback-mobile.png. Prior deliverables are unchanged.
