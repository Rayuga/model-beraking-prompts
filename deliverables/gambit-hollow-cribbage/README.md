# Gambit Hollow Cribbage

Final deliverables: [complete download bundle](gambit-hollow-cribbage-final-deliverables.zip),
with the seven individual files in [final-submission-20260915](final-submission-20260915/).
Includes the unchanged task ZIP, Oracle/NOP and three supplied model run archives,
plus evaluation and case-study Word reports. Oracle scored 0.9833 with all 40
Functional criteria passing; GPT scored 0.6616. Haiku's interrupted run is retained
and clearly qualified; no Sonnet export was supplied. See the
[delivery audit](submission-preparation-20260915/README.md).

## Earlier preparation

Current candidate: [v1.0.0 browser acceptance ZIP](1.0.0-browser-check-20260915/gambit-hollow-cribbage.zip).

Adds a real-browser acceptance check to the instructions and provides the same pinned Playwright/Chromium development tools used by the verifier. Golden solution, all verifiers, weights, timeouts and task configuration are unchanged from the preceding complete-match candidate. [Review and evidence](1.0.0-browser-check-20260915/REVIEW.md).

The new ZIP passes 401 local archive checks, 134 configuration checks and five browser acceptance groups. Fresh environment build verification is blocked by local network/proxy failures. No new Oracle or model score is claimed.

The user reports Oracle passes the [complete-match candidate](1.0.0-resilient-matches-20260914/gambit-hollow-cribbage.zip). Two GPT-5.4-mini runs scored zero due to basic browser integration bugs. [Analysis](20260914-two-zero-gpt-analysis.md) and [isolated diagnostic repairs](20260915-model-diagnostics/). Diagnostic copies never replace official submissions or their scores.
