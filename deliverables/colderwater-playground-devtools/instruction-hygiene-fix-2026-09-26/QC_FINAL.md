# Colderwater instruction-hygiene correction: final local QC

The corrected archive changes only six functional criterion IDs and their matching names. **Descriptions, weights, order, requirements, golden behavior and all other task files are unchanged.** Independent comparison proved exactly twelve label-line substitutions in one file; the other49 files are byte-identical.

## Correction to the previous review

The prior local `check-instruction-hygiene.py` PASS came from semantic review and did not perform the literal ID-collision scan. Platform feedback disproved that PASS: six ordinary public words were also criterion IDs, matching nine public-text lines. This was a local preflight omission. Public prose did not expose actual grading instructions, but it still violated the platform's literal rule.

The new independent whole-token scan checks all36 criterion IDs against `instruction.md` and six instruction notes and finds **zero collisions**. Private labels were renamed; public prose remains unchanged. This is a documented local equivalent, not execution of the private platform checker or a guarantee that the platform will accept the upload.

## Frozen candidate

- Archive: `colderwater-playground-devtools.zip`
- SHA-256: `d250db516a70255c4c0ea05f8f5dff12ed3c94021625878bf7c3285b95dd7da0`
- 50 files; 831,501 bytes; one root `colderwater-playground-devtools`.
- ZIP CRC, source/entry/manifest hashes and executable LF shell modes independently pass.
- Counts remain24 functional criteria, weight49.5; four polish checks; six visual topics; 60%/20%/20% shares and functional floor0.05.

## Evidence and scope

| Review | Evidence |
| --- | --- |
| Exact old/new ZIP and semantic comparison | `independent_label_review.json` |
| Augmented source audit:80/80 on source and extracted ZIP | `qc_source_evidence.json`, `qc_extracted_source_evidence.json` |
| Mapped contract audit:22/22 | `contract_checks.json` |
| Known-bad old candidate returns nonzero | `source_audit_regression.json` |
| Rebuilt verifier image:15 copied files match current source | `verifier_image_evidence.json`, `verifier_build.log` |
| Current-to-historical criterion mappings | [CRITERION_ID_CROSSWALK.md](CRITERION_ID_CROSSWALK.md) |
| Preserved fairness mapping | [Previous fairness ledger](../hardening-2026-09-26/FAIRNESS_LEDGER.md), read with the crosswalk |
| Preserved golden/frontend coverage | [Previous frontend validation](../hardening-2026-09-26/GOLDEN_FRONTEND_VALIDATION.md), read with the crosswalk |
| Prior runtime and complete source QC | [Previous local QC](../hardening-2026-09-26/QC_FINAL.md), subject to the hygiene correction above |

All53 workbook judgments and all48 deterministic inventory names are represented exactly once: **47 Pass, 6 Note, 0 Fail**. The retained results concern unchanged behavior; broad application tests were not rerun for private label changes. The rebuilt verifier image is `sha256:31bac530e99b6a63f0940d09ce63d6f79619f49e6fe556e286ea519188a454e6`; all15 copied verifier files match current source. No shared files, task requirements or goldens were altered by this review.

Paid Oracle/model scores and acceptance by the private platform checks remain unmeasured for this corrected candidate. Synthetic harness scores are not Oracle scores. Browser behavior still cannot prove the exact internal framework or database engine; those existing review limitations remain documented in the workbook.
