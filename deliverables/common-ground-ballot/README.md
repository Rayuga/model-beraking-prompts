# Common Ground Releases

Current upload: [common-ground-ballot.zip](2026-09-14-auth-gate-r10/common-ground-ballot.zip).
Current source: `projects/common-ground-ballot/`, version `1.0.0` per the current template.

Read [the r10 gate correction](2026-09-14-auth-gate-r10/README.md) before upload.
The previous package passed static 45/45 but had a genuine shared authentication
gate omission in rubric QC. All five prompts now require signed-out protected
data denial and incorrect-password refusal. The r9 stateful scope remains intact.
Fresh platform QC/Oracle on this checksum is pending; no new GPT band is proven.
Historical releases remain unchanged.

| Folder | Contents |
| --- | --- |
| [2026-09-14-auth-gate-r10](2026-09-14-auth-gate-r10/) | Current ZIP: corrected authentication gate in all five dimensions; 36 unchanged criteria; 32 browser groups, 15 runner cases, 5 runtime groups, 9 mutants, 115 standard and 55 focused gate checks; no new platform score |
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
