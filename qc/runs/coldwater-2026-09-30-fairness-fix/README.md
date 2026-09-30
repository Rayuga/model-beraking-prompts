# Colderwater: three verifier fairness repairs

Superseded by [fairness-fix2](../coldwater-2026-09-30-fairness-fix2/README.md). Independent targeted review found an additional S03 HTML-dispatch dependency and an understated fallback-action estimate. Both were corrected in the new frozen candidate. The original reports below are historical evidence; their earlier in-progress wording is not current status.

User-authorized fix pass after the postrepair audit. Input: `8faaf5e48a4cae4947c7ce686778ed295da6f76aa3723aee306215aa97d02ba6`.

Only `tests/scored/functional/prompt.md` and four descriptions in `tests/scored/functional/judge.toml` changed. All 64 Functional criteria, their weights (32.70 total), 23 protocols, public requirements, golden application files, other dimensions and canonical files/settings remain identical to the previous candidate.

1. S16 compares a short successful Run with a successful Run that schedules its own four-second timer. Later preview interactions no longer supply that measurement.
2. S24 can establish successful ordinary unpadded creation/update controls when padded writes fail. The trimming failure remains; collision and empty-title protection get their own observations.
3. S03 establishes a currently working handler before Stop and can use a fresh immediate-handler control after delayed interaction fails. A never-working handler still cannot earn suppression credit.

The planning estimates increase from 450 to 454 ordinary UI actions and add one four-second Run. Up to ten conditional fallback actions are stated. These are source estimates, not measured LLM-judge workload or an assurance that a configured judge completes within its timeout.

Verification is in progress. `preflight.json` has 50 passing structural assertions; `source-regressions.json` has 53 passing source guards. These are not 53 semantic QC passes. Targeted independent reviews and fresh scripted golden/partial-app browser evidence will be recorded separately. The generated three complete-review skeletons are unused in this bounded fix pass; no full current-candidate QC or Oracle score is claimed.

Known unresolved issues outside these three repairs remain: inherited canonical restart-helper behavior, the shared browser-only/backend-policy coverage conflict and ungraded artifact obligations, the uncommitted golden baseline, and missing full configured judge/workload/discrimination/ranking measurements. Do not change the shared harness or invent runtime results to clear them. No task upload, paid judge run, ZIP or Git write is part of this fix pass.
