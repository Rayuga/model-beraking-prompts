# Current Colderwater status, 1 October 2026

At the user's request, the experimental shared-harness edit was removed from
both `projects/webdev-task-template/tests/test.sh` and
`projects/colderwater-playground-devtools/tests/test.sh`. They again have the
original identical SHA256
`bd68259276ca4b034654efc8a1723a4e702ed62dbe590af6201565f43eabe5aa`.
The current task bytes once again match the completed QC candidate at
`qc/runs/coldwater-2026-10-01-lifecycle-controls`, input
`6a1e1645d3f5518ba2b935fdb339053a96ae6cbfbaeb48546616d752f3133ca2`.
Its 54 review records reconcile with no missing reviewers and passing structural
preflight, but the verdict remains **BLOCKED**: 42 Pass, 3 Fail, 5 Not exercised
and 3 Notes among the 53 quality rows. The 64 task source guards pass. The
configured judge, Oracle and target-model scores remain unmeasured.

The offline harness correction and its successful local controls are preserved
as [historical proposal evidence](repairs/coldwater-2026-10-01-shared-harness/SHARED_HARNESS_FIX.md).
The `coldwater-2026-10-01-shared-harness-fix` snapshot is not the current task;
its changed `test.sh` bytes have been reverted from both live projects.

---

# Completed Colderwater audit, 1 October 2026

Current candidate: `qc/runs/coldwater-2026-10-01-lifecycle-controls`, input `6a1e1645d3f5518ba2b935fdb339053a96ae6cbfbaeb48546616d752f3133ca2`. Status **BLOCKED**. Quality records: {'Pass': 42, 'Fail': 3, 'Not exercised': 5, 'Note': 3}. Deterministic records: {'Note': 11, 'Pass': 31, 'N-A': 5, 'Fail': 1}. See [final report](runs/coldwater-2026-10-01-lifecycle-controls/FINAL_QC_REPORT.md) for all 53 records, applied repairs, measurements and remaining shared/evidence limits. The current golden passes all 79 scripted Functional observations; that is not an Oracle grade. No upload or push occurred. Earlier status is retained below.

---

# Active Colderwater candidate, 1 October 2026

`qc/runs/coldwater-2026-10-01-lifecycle-controls` is the current frozen candidate (`6a1e1645d3f5518ba2b935fdb339053a96ae6cbfbaeb48546616d752f3133ca2`). Four task repairs are applied. Fresh scripted golden: 79/79 Functional facts, both gates, six Polish facts, eleven runtime regressions; local structural/source/CLI checks pass. A fresh single-per-row independent round is underway. **Not cleared; no configured Oracle/Luna score.** See its REPAIR_STATUS.md and raw evidence. Shared template concerns and required missing measurements are still open.

The completed previous extension-scope2 audit had 39 Pass, 8 Fail, 5 Not exercised and 1 Note. Its reports remain historical; they do not clear changed files. Earlier status follows.

---

# Current: extension-scope repair, 1 October 2026

Use [current repair and review status](runs/coldwater-2026-10-01-extension-scope2/REPAIR_STATUS.md).
Input `ce4b8f85ae12d3b7c3fe222c948c79364600e082541c3b04f1a16039a553cea8`.
Removed duplicate extension-capitalization scoring and its public requirement.
Fresh scripted golden: 74/74 Functional, both gates, six Polish and 11 runtime
regressions pass. Structural50/50 and source59/59 pass. Two targeted repair
confirmations pass. ONE fresh 53-row independent QC round is in progress in
small parallel groups, plus the separate deterministic review. No configured
judge, Oracle or Luna score is claimed; shared findings remain open.

Everything below is historical and does not clear the current candidate.

# Follow-up, current frozen candidate unchanged

Colderwater received two fresh reviews: golden deliverables Pass; requirement coverage Fail only for inherited backend/DB_PATH checks. Alternate DB_PATH golden control and current configured-run offline preflight pass. Full paid judge execution awaits the user's answer; no configured score exists. Remaining fresh agent reviews are unavailable at the current thread limit. See [continuation](../qc/repairs/coldwater-2026-10-01-ready-loop/CONTINUE.md). Release remains blocked.

# Current local QC status

- Latest measured Colderwater repairs: [repair status](runs/coldwater-2026-10-01-final-local/REPAIR_STATUS.md), input `40651486c32fb6046f3435969205b44a02d8e9fd8343b65717760487539ccf39`, local reference commit `6b1e1f1b`. CSS carry-over removed. Fresh scripted golden passes 75 Functional observations, both gates, six Polish checks and 11 runtime regressions; 13 focused lifecycle checks and the Stop-preview-loss mutant also pass their expectations. Structural50/50 and source58/58 pass. **Release BLOCKED:** shared harness restart/cleanup and procfs isolation findings remain; configured Oracle/model/workload/reward measurements are absent. A fresh complete independent review has not run after these repairs. Full preceding single round completed40 Pass/8 Fail/5 Not exercised; original reports remain history.

Entries below are historical and do not clear the latest candidate.

# Current QC evidence

- Latest candidate: [CSS-fresh status](runs/coldwater-2026-10-01-css-fresh/REVIEW_STATUS.md), input `97d29f44bfeb8fe71843ced9fd7960569b26214853c52db11f4f74fd8abd45f7`. **IN PROGRESS, NOT CLEARED.** User-authorized CSS carry-over feature removal is complete. Functional is now 74 criteria / 23 protocols / weight 32.40. Fresh scripted golden passes all 74 Functional facts, both gates, seven Polish checks and 11 runtime regressions. ONE independent audit round is running, with a fresh context per 53 quality rows plus a separate 48-row deterministic review. Canonical settings remain unchanged; configured Oracle/model evidence and shared owner decisions remain open.

Entries below are historical. The prior triple-review mode was stopped by the latest user instruction.

- Latest candidate: [form/CSS status](runs/coldwater-2026-10-01-form-css/REVIEW_STATUS.md), input `f4935da54bbc95167903b9d8738b785af5120b0cf285984d6e99bde46c1ee80b`. **IN PROGRESS, NOT CLEARED.** The golden now preserves live form values on rollback, executes ordinary JavaScript containing HTML-like text correctly, and the existing library/restart scenario explicitly covers CSS storage. Fresh full scripted golden passes 78 Functional observations, two gates, seven Polish checks and 11 runtime regressions. Task complexity, weights and canonical settings remain unchanged. Three fresh independent full reviews are finishing; supplemental 53-row reviews have not started for these bytes. Full configured judge/Oracle/model measurements and shared owner decisions remain open.

Older entries below are historical and do not clear the current candidate.

- Latest candidate: [HTML-location status](runs/coldwater-2026-09-30-html-location/REVIEW_STATUS.md), input `d99cf2402e849362228cde36cc04a586adc913bd9f6645b6891a63ab3b120132`. **NOT CLEARED.** Fresh scripted golden passes 78 Functional observations plus gates, Polish and runtime controls. Independent review nevertheless reproduced lost form values on rollback and identified missing CSS save coverage. The three full reports are closing before those repairs; supplemental row reviews have not started for this candidate. Configured Oracle/model scores remain unmeasured.

- Latest follow-up: lexical-repair's three complete independent reviews are **BLOCKED**. A full reviewer and the dedicated row-17 reviewer independently found a golden HTML error-line bug when script text also appears earlier as ordinary page text. Bounded reproduction/repair is now staged under `qc/repairs/coldwater-2026-09-30-html-offset/`; the remaining 52 supplemental rows are stopped pending a corrected candidate. Prior scripted passes do not refute this additional supported-input case. No source/rubric weakening or shared setting change is planned.

- Current Colderwater candidate: [lexical-repair manifest](runs/coldwater-2026-09-30-lexical-repair/manifest.json), [applied changes](runs/coldwater-2026-09-30-lexical-repair/APPLIED_CHANGES.md), [review status](runs/coldwater-2026-09-30-lexical-repair/REVIEW_STATUS.md). **IN PROGRESS, NOT CLEARED.** Input `f192d9e9b7647fc54dd903139e0c80621124742a6e3d32a598b6735835db5c6e`. Harmless local-name rejection and caught SharedWorker refusal are repaired. Fresh scripted78 Functional+2 gates+7 Polish+11 regressions pass;74 focused observations,7 refusal variants and17 lifecycle variants pass. Structural50/50 and guards55/55 pass. Three full independent reviews are active; supplemental53 prepared. Public requirements,78 Functional criteria/32.70 weight and canonical settings remain unchanged. No configured Oracle/model result exists.

- Colderwater follow-up: the browser-safe candidate below is **SUPERSEDED, NOT CLEARED**. Its three full reviews completed, but the supplemental row-17 agent found a golden bug: harmless local `Worker`/`Function` bindings are refused by the name-only parser guard. A browser reproduction confirms it. Seven of 53 supplemental reviews finished (five Pass, two Fail); the remaining 46 stopped while the defect is repaired. The staged repair is under `qc/repairs/coldwater-2026-09-30-local-bindings/`. A fresh candidate and review cycle will follow measured repair evidence. No configured Oracle or model grade exists.

- Current Colderwater candidate: [browser-safe manifest](runs/coldwater-2026-09-30-browser-safe/manifest.json), [applied repair](runs/coldwater-2026-09-30-browser-safe/APPLIED_CHANGES.md), [measured golden](runs/coldwater-2026-09-30-browser-safe/golden/BROWSER_SAFE_PROOF_SUMMARY.json). **IN PROGRESS, NOT CLEARED.** Input `c9533464e21db908f5058b3f45a967361c9ea57f3e5d686e34e8a8771e8bd660`. Fresh scripted golden passes78 Functional,2 gates,7 Polish,11 regressions; exact style inspection and7 refusal/17 lifecycle variants pass. Structural50/50 and source guards55/55 pass. Three independent full reviews are active; supplemental53 agents still pending. Public requirements, Functional weight32.70 and canonical settings remain unchanged. Shared owner decisions and configured measurements remain open; no Oracle/model grade is claimed.

- Rejected intermediate candidate: [data-repair status](runs/coldwater-2026-09-30-data-repair/REVIEW_STATUS.md). Fresh full golden exposed Playwright inspection changing Complete to Error after focused tests passed. That concrete regression was repaired in the current candidate; rejected raw evidence and aborted source reviews remain intact.

- Superseded lifecycle candidate: [review status](runs/coldwater-2026-09-30-lifecycle-repair/REVIEW_STATUS.md). Its three complete full reviews found harmless quoted data could be refused by the golden. The current repair fixes that and source-URL literal corruption. Old full and targeted evidence does not clear new bytes.

- Superseded refusal-repair candidate: [three full reviews](runs/coldwater-2026-09-30-refusal-repair/QC_REVIEW.xlsx), [review status](runs/coldwater-2026-09-30-refusal-repair/REVIEW_STATUS.md). All three complete101-row reviews were reconciled as **BLOCKED**. Scripted golden69 Functional and focused refusal controls passed, but two reviewers demonstrated remaining later-recovery couplings elsewhere. The new candidate repairs those; prior results do not clear its changed source.

- Superseded coverage-repair candidate: [manifest](runs/coldwater-2026-09-30-coverage-repair/manifest.json), [shared decisions](runs/coldwater-2026-09-30-coverage-repair/OWNER_DECISIONS.md). **IN PROGRESS, NOT CLEARED.** Task-side coverage, launch wording and visual-ownership repairs are applied. Local structural checks pass50/50 and regression guards pass55/55. Fresh scripted golden and independent QC are being completed against the frozen candidate. The official harness is unchanged; its tested correction is an unapplied proposal. No configured Oracle or target-model score is claimed.

- Previous completed Colderwater QC: [consolidated reconciliation](runs/coldwater-2026-09-30-committed-audit/per-row-review/RECONCILIATION.md), [53-row table](runs/coldwater-2026-09-30-committed-audit/per-row-review/QC_53_RECONCILED.md), [workbook](runs/coldwater-2026-09-30-committed-audit/per-row-review/QC_53_REVIEW.xlsx). **COMPLETE, release BLOCKED: 43 Pass, 6 Fail, 4 Not exercised.** Three independent full reviews plus 53 distinct row agents completed; all credible findings are retained. The six failures include the same inherited restart defect in three rows. Task-side launch clarification, coverage and visual-overlap concerns remain; canonical harness issues require shared-template resolution. All 91 input files, 56 original reports and bound raw evidence pass [final verification](runs/coldwater-2026-09-30-committed-audit/final-input-verification.json). Task source is unchanged; full configured judge timing, Oracle and model scores remain unmeasured. Earlier evidence below is historical and does not clear this candidate.

- Prior Colderwater repair baseline: [verified fairness repairs](runs/coldwater-2026-09-30-fairness-fix2/REPAIR_REPORT.md), [measured results](runs/coldwater-2026-09-30-fairness-fix2/REPAIR_RESULTS.json). Fresh scripted golden passes64 Functional,2 gates,7 Polish and11 runtime regressions; all10 focused partial-app outcome vectors match. Three independent targeted reviews pass. Only the Functional prompt and four descriptions changed; requirements, app bytes, weights and canonical settings remain. **Targeted repairs verified; release NOT CLEARED.** Shared-profile findings and full judge measurements remain open. The [cross-device handoff](../NEW_DEVICE_TASK_HANDOFF_2026-09-30.md) accompanies the commit recording the repaired golden baseline; earlier reports retain their original uncommitted-baseline finding. The prior full audit below covers prior bytes. No new task QC review was performed for this handoff.

- Previous Colderwater audit: [reconciliation](runs/coldwater-2026-09-30-postrepair-audit/per-row-review/RECONCILIATION.md), [53-point table](runs/coldwater-2026-09-30-postrepair-audit/per-row-review/QC_53_RECONCILED.md), [workbook](runs/coldwater-2026-09-30-postrepair-audit/per-row-review/QC_53_REVIEW.xlsx). **BLOCKED — 39 Pass, 9 Fail, 4 Not exercised, 1 Note.** All 53 distinct row agents finished; task source unchanged. Fresh exact-image isolation passes. Full judge/workload/reward evidence and confirmed findings remain unresolved. Older targeted repair confirmations do not clear this candidate.

- Colderwater source provenance: [repair3 report](runs/coldwater-2026-09-30-repair3/REPAIR_REPORT.md), [manifest](runs/coldwater-2026-09-30-repair3/manifest.json). Findings known at that repair stage were addressed; the fresh audit above found additional issues. Scripted golden passes64 Functional,2 gates,7 Polish and11 runtime regressions. Shared harness unchanged. Full source review is now complete and BLOCKED; configured Oracle/model grades remain unmeasured. Do not use older ZIPs as the current source.

The entries below describe earlier candidates and remain historical evidence.

- Workflow: [README](README.md), [review policy](REVIEW_POLICY.md).
- Current Coldwater candidate: [30 September hardening manifest](runs/coldwater-2026-09-30-hardening/manifest.json), [changes and fairness map](runs/coldwater-2026-09-30-hardening/HARDENING.md). The [initial three-review summary](runs/coldwater-2026-09-30-hardening/SUMMARY.md) and [initial workbook](runs/coldwater-2026-09-30-hardening/QC_REVIEW.xlsx) are preserved; the dedicated audit below is the latest finding set.
- The [dedicated review of all 53 quality points](runs/coldwater-2026-09-30-hardening/per-row-review/RECONCILIATION.md) is complete: 53 independent agents, one per point, as requested. Final verdicts are **36 Pass, 11 Fail, 5 Not exercised, 1 Note** after documented reconciliation. Use the [current table](runs/coldwater-2026-09-30-hardening/per-row-review/QC_53_RECONCILED.md) and [current workbook](runs/coldwater-2026-09-30-hardening/per-row-review/QC_53_REVIEW.xlsx). The earlier three full reviews missed concrete defects; their original reports remain history, not current clearance.
- Fresh [scripted golden verification](runs/coldwater-2026-09-30-hardening/golden/RUN.md) passes58/58 prescribed functional facts with one actual restart. The dedicated audit also found a golden-source error case outside those probes. Local release status is **BLOCKED** by source findings, unmeasured full judge/runtime/reward evidence and shared-profile/corpus assurance gaps; no Oracle or Luna score is claimed.
- Previous complete review: [round3 result](runs/coldwater-2026-09-29-round3/SUMMARY.md), [workbook](runs/coldwater-2026-09-29-round3/QC_REVIEW.xlsx), [historical golden reproduction](runs/coldwater-2026-09-29-round3/golden/RUN.md). These do not clear the changed candidate.
- Mechanism tests: [validation](VALIDATION.md).
- Cleanup: [deletion and recovery manifest](cleanup/2026-09-29.json).

Release remains blocked while required evidence or credible findings are unresolved. Earlier run folders retain their original reviews and follow-up dispositions. No hosted QC, paid judge or target-model run was performed during this setup.
