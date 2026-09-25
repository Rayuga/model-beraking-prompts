# Common Ground Releases

Final delivery: [seven-file download bundle](common-ground-ballot-final-deliverables.zip),
with individual files in [final-submission-20260917](final-submission-20260917/).
Includes the unchanged r27 task ZIP, Oracle/NOP and GPT/Gemini/Haiku job ZIPs,
an 11-page evaluation DOCX and a 3-page case-study DOCX. Matched the established
Gambit Hollow/Dropline/Patchpad format. Both reports rendered in Word; all 237
run files are preserved byte-for-byte. [Delivery audit](submission-preparation-20260917/README.md).

Latest tested ZIP: [common-ground-ballot.zip](2026-09-17-review-safety-r27/common-ground-ballot.zip).
**Latest r27 results: Oracle 1.0000; fresh GPT-5.4-mini 0.5788, with Render and Constraints both 1.0.**
[Latest rerun analysis and evidence](../../reports/common-ground-ballot/2026-09-17-r27-rerun/README.md).

All verifier hashes and the Oracle app match r27. The Oracle export is the same
previously passing run, not a second Oracle measurement. GPT completed the fresh
ballot journey and scored Functional 0.3357, Polish 0.9286, Visual 0.9583.
Fresh Haiku and Gemini score zero from application gate failures; both were graded
normally. NOP remains zero. Oracle grading took 65m44s with all 86 criteria full
credit; fresh GPT grading took 52m16s. This GPT sample meets the <=0.6 target with
a 0.0212 margin; it does not guarantee the same result on every future sample.
Separate platform Rubric/Source and Static Checks results were not supplied.
Keep this ZIP unchanged; no further hardening is currently recommended.

The release also has 101 local golden browser checks, eight round mutation
controls, 30 runner checks and 294 ZIP checks. Five verifiers, 66 Functional
criteria. [Original release report](../../reports/common-ground-ballot/2026-09-17-review-safety-r27/README.md).

| Folder | Contents |
| --- | --- |
| [2026-09-17-review-safety-r27](2026-09-17-review-safety-r27/) | Current: measured Oracle 1.0000, fresh GPT 0.5788 with Render/Constraints 1; separate platform rubric report not supplied |
| [2026-09-17-atomic-rounds-r26](2026-09-17-atomic-rounds-r26/) | Previous atomic-round candidate; r27 fixes review race and closes two rubric gaps |
| [2026-09-17-conflict-review-r25](2026-09-17-conflict-review-r25/) | Previous draft-review/recovery hardening; r26 adds reviewed atomic rounds |
| [2026-09-16-oracle-transport-r24](2026-09-16-oracle-transport-r24/) | Historical r24 platform Oracle 0.9521 / GPT-5.4-mini 0.7885; two Oracle evidence gaps and additional difficulty addressed in r25 |
| [2026-09-16-budget-revision-r23](2026-09-16-budget-revision-r23/) | Failed platform Oracle0.4 due Functional MCP crash before business tests; repaired inr24 |
| [2026-09-16-product-gate-r22](2026-09-16-product-gate-r22/) | Previous workflow-gate repair; latest screenshot exposes gate-budget and vote-revision coverage findings fixed in r23 |
| [2026-09-16-natural-brief-r21](2026-09-16-natural-brief-r21/) | Previous natural-brief repair; latest screenshot 52/53 rubric, remaining read-only floor issue addressed in r22 |
| [2026-09-16-runtime-contract-r20](2026-09-16-runtime-contract-r20/) | Static45/45, rubric51/53 in supplied screenshot; two remaining brief-voice findings addressed in r21 |
| [2026-09-16-qc-repair-r19](2026-09-16-qc-repair-r19/) | Superseded: 44/45 static checks passed; private Python helpers misclassified as app entrypoints, repaired in r20 |
| [2026-09-16-verifier-repair-r18](2026-09-16-verifier-repair-r18/) | Superseded: seven screenshot-QC findings, including double wrapper installation in the actual Dockerfile; repaired in r19 |
| [2026-09-15-recovery-r17](2026-09-15-recovery-r17/) | Failed platform Oracle: 0.7517 overall / 0.5862 Functional; recovery checks were not completed and other evidence was lost; repair needed |
| [2026-09-15-coverage-r16](2026-09-15-coverage-r16/) | Preserved v9 coverage repair; matching supplied GPT export0.897, user-reported Oracle1; superseded by r17 hardening |
| [2026-09-15-oracle-ready-r15](2026-09-15-oracle-ready-r15/) | Preserved previous candidate: 56 criteria and reward/runtime fixes; new v9 screenshot exposed three remaining coverage gaps, fixed in r16 |
| [2026-09-15-platform-qc-r14](2026-09-15-platform-qc-r14/) | Preserved screenshot-QC repair, superseded by r15 for the new TXT rubric |
| [2026-09-15-crosscheck-r13](2026-09-15-crosscheck-r13/) | Preserved MCP dialog and evidence-capture cross-check |
| [2026-09-14-oracle-repair-r12](2026-09-14-oracle-repair-r12/) | Preserved Oracle repair candidate and local evidence |
| [2026-09-14-functional-r11](2026-09-14-functional-r11/) | Preserved stricter functional revision and historical run review |
| [2026-09-14-auth-gate-r10](2026-09-14-auth-gate-r10/) | Preserved ZIP: corrected authentication gate in all five dimensions; 36 unchanged criteria; 32 browser groups, 15 runner cases, 5 runtime groups, 9 mutants, 115 standard and 55 focused gate checks |
| [2026-09-13-stateful-r9](2026-09-13-stateful-r9/) | Preserved ZIP: three explicit stateful requirements, 36 criteria; platform screenshot reported static 45/45 and rubric 52/53, missing shared authentication negatives; fixed in r10 |
| [2026-09-13-qc-r8](2026-09-13-qc-r8/) | Preserved corrective ZIP: contrast, partial-turnout denominator input, role-aware Polish, safer runner links;112 standard checks,18 browser groups,15 runner cases,5 runtime groups and3 mutants;53-point local review, no new platform score |
| [2026-09-12-judge-r5](2026-09-12-judge-r5/) | Scored r7 upload: Oracle 0.9917 (19/19 Functional), GPT 0.9595, Gemini 0.6809, Haiku 0.2762, NOP 0; September 13 review records matching provenance and two reproduced GPT defects |
| [2026-09-12-judge-r4](2026-09-12-judge-r4/) | Preserved previous upload: exact invalid controls, independent scoring, persisted-result checks, mobile turnout fix; 15 local golden groups passed |
| [2026-09-12-judge-r3](2026-09-12-judge-r3/) | Scored r5 upload: Oracle 0.9595, GPT 0.7393, Gemini 0.6536, Haiku 0; review in reports/common-ground-ballot/2026-09-12-r5-review |
| [2026-09-12-rubric-r2](2026-09-12-rubric-r2/) | Previous scored upload: approval-note fix; Oracle 0.8928 with three missed/lost judge checkpoints |
| [2026-09-12-standard-r1](2026-09-12-standard-r1/) | Previous five-dimension upload; user reported static 45/45 and rubric 52/53 |
| [2.0.0](2.0.0/) | Preserved previous upload and template migration notes |
| [v0](v0/) | Untouched original 1.0.6 task ZIP, Oracle/model evidence and reports |
| [pre-template-2.0.0](pre-template-2.0.0/) | Preserved earlier draft ZIP with the old v2 slug |

The original source is archived at `projects/common-ground-ballot-v0/`.
Its task metadata is intentionally unchanged; do not upload that archive folder
as a newly named task. The active ZIP uses exactly one `common-ground-ballot/`
wrapper. Reports and local helpers stay outside that wrapper.

Historical Oracle 1.0 does not establish a score for the current package. See the
current release's README and evidence files for exactly what was tested locally.
