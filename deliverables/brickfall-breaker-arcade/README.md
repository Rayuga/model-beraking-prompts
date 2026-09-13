# Brickfall releases

Current grouped handoff: [final-submission-20260912](final-submission-20260912/).
It contains the task ZIP, four named job-directory ZIPs, and the Brickfall
evaluation report and case study using the supplied Drawbill document format.
Recorded Oracle is 0.9583 (Functional 1.0000, 25/25), GPT-5.4 mini is 0.6094,
and Gemini is a Constraints-gated 0.0000. The latest completed Haiku run,
`run-8e4c12dd-0dbb-449a-a3a8-ad70d8758786` / `6uqBDww`, is 0.1689
(Functional 0.0870, 2/25; both gates passed). Its job archive and updated reports
are included. The prior completed `run-05fd6dc8` also scored 0.1689 but had
different criterion outcomes; its export and prior delivery files remain preserved.
The earlier startup-timeout attempt is not used as a score. Reports explain the
latest Haiku's missing checkpoints, inactive lab and bundled session-check failure;
the latter is not evidence that account-wide logout failed.
The Oracle job ZIP includes the no-op control. Reports summarize recorded
outcomes, not a new complete QC certification. Packaging evidence and Word/PDF
validation are outside the delivery folder in `submission-preparation-20260912/`.
The older `final-submission/` is historical and remains unchanged.

Latest prepared upload: **1.0.0**, task name **brickfall-breaker-arcade**.

- [Upload ZIP](1.0.0-coverage-gaps/brickfall-breaker-arcade.zip)
- [Changes, checks and limitations](1.0.0-coverage-gaps/README.md)
- [Coverage and fairness review](1.0.0-completed-standard-20260911/QC_REVIEW.md)

Editable source is `projects/brickfall-breaker-arcade/`. The latest release
completes the five-dimension standard migration with native OpenAI/max settings,
public networking for both environments, 40 criteria and gated 60/20/20 scoring.
The original 37 criteria are preserved; three Functional checks now cover best-score
increases, forged identity and completion with a surviving solid. Golden changes
are the prior mobile CSS fix and one solid brick added to the Final wall fixture;
client gameplay logic is unchanged. 119 local standard checks and 44 browser
groups passed, along with reward math and restart persistence. Exact Docker
builds were blocked by local proxy/download failures. The newly supplied platform
runs above match the current verifier hashes and Oracle source. A fresh platform
QC result is not part of this run-results handoff; the older release notes below
describe the pre-run preparation state.

The root and final-submission evaluation reports describe the older accepted
2.2.1 task. Their scores and ZIPs are historical, not evidence for the latest
package. Existing versioned release folders and projects/brickfall-breaker-arcade-v0
remain preserved. Upload only the task ZIP, never this entire collection.

The preceding two-file correction explicitly requires the lab's visible cumulative
simulation-step counter and aligns the Functional prompt with that requirement.
The existing golden counter passes 120/240/1-step checks, pause freeze and resets.
This correction changes no golden code, criterion definitions or weights.
Five new counter groups plus the prior 36 browser groups were rerun on the current
package at that time. It is retained in the new three-gap coverage release;
source/ZIP hashes and exact changed-file scope are recorded in the current audit.
