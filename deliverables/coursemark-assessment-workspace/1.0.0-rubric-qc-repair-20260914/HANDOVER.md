Coursemark rubric-source QC repair, prompt revision r4

Upload the task-named ZIP in this folder. It replaces the previous target-0.4 ZIP. The harder product requirements and golden implementation remain; this revision repairs evaluation instructions. All 66 criterion weights and the 60/20/20 scoring formula are preserved. Four criteria were renamed to reflect their revised responsibilities.

The screenshot reports four failed platform QC rules, not four failed application tests:

| Platform finding | Repair |
| --- | --- |
| timeouts_fit_the_work | Removed repeated gate journeys within each dimension, moved token revocation out of all five gates into its Functional test, removed business-workflow exploration from Render/Constraints, enabled serial captured-request matrices, and replaced duplicated Polish transaction journeys with bounded UI inspections. Functional now has a consolidated 123-minute planning estimate within 150 minutes; Polish 14 within 15. Functional leaves one reusable inspection fixture. |
| criteria_are_independent_and_noncontradictory | Functional owns accepted transactions and stale recovery. Polish owns selection, validation, keyboard/focus and readonly preview, with an explicit narrowly bounded setup-write exception. Render owns the public shell; Constraints owns local-service boundaries and the documented health endpoint. |
| criterion_description_is_self_consistent | Removed the unperformed-retry waiver. All binary criteria use one rule: every mandatory observation needs direct evidence for 1; otherwise 0, with insufficient evidence distinguished from an observed product failure. |
| dimension_prompts_are_accurate_and_consistent | Rewrote the affected prompts around their actual criteria and made the shared prerequisite identical across all five dimensions. Mandatory wrong-password rejection and anonymous protected-data refusal remain. |

The fixed repository budgets are unchanged. Prior evidence gives context for the workload correction: GPT's previous agent execution ran from 20:39:14.212214Z to 20:49:24.990051Z, about 10.18 minutes; that previous full verifier ran about 42.89 minutes and Oracle's about 45.85 minutes. These are predecessor runs, not measurements of this expanded revision. The new scheduling estimates do not prove platform timeout sufficiency. A fresh full run must confirm it; no new model score or Oracle 1.0 is claimed.

Validation: 35 local API/browser groups passed, including all previous 32 and three new checks for public health, a graded/unreleased written handoff fixture, and the revised Polish flow with unchanged course state. Actual RewardKit discovery loaded all five final configurations. The real runner's provenance code recorded final prompt/config hashes separately in final-prompt-provenance.json. Final wording/line-ending adjustments did not change the golden or tested actions. The local score fixture remains synthetic and is not an Oracle score.

The final archive passes 419 upload checks and 145 repository standard checks; local targeted checks also cover the reported conflicting clauses. These local checks are not the platform's semantic Rubric Source evaluation. No cloud model/Oracle/QC run was performed. Both Dockerfiles and golden files are byte-identical to the previous revision, so the prior fresh-image network limitation remains unconfirmed rather than being relabeled as a build pass.

A local fixture initially failed because Windows line endings prevented its synthetic executable from being selected; its logs are retained under failed-local-fixture-lineendings. A draft archive failed the local prompt-marker matcher due to CRLF; it is retained under failed-upload-crlf. Both local tooling issues were corrected before this final archive. Only the task-named ZIP directly in this folder is the deliverable.

Next: rerun platform QC on this exact ZIP. After Rubric Source passes, run Oracle and GPT on this same checksum. The target remains approximately 0.4 for GPT and 1.0 for Oracle; neither is guaranteed by local checks.

Final ZIP SHA-256: `8cc7392b13234bb65848fdbfd0a342cf1d1645702cef172339c7259423bb42c3`.
