# Fresh Colderwater review after repair3

This audit uses one new independent agent context per quality point, with up to three workers concurrently, as explicitly requested by the user. The 53 assignment prompts and original reports live in `per-row-review/`. Reviewers must finish their own row before seeing other findings. All 48 deterministic workbook entries are also applied locally.

`scripts/qc_pipeline.py prepare` froze the task, workbook, skill, template and checker/policy hashes. Its default three full-review skeletons remain unused because the user requested the dedicated-row format. They must not be filled with cloned or aggregated findings to imply that three complete reviewers ran.

The input hash is `27f81c18259555d26b61a5a2b0f026f0360b7380bc072523513b0ad2deca9efc`. It matches repair3. Existing raw scripted golden evidence may be reused only after verifying the app and relevant protocol hashes. See `raw-evidence-index.json` for raw artifact locations; prior reviewer summaries are excluded from independent assignments.

This is a review-only round. The task source stays unchanged. No new ZIP, upload, paid provider run, Oracle grade or target-model score is produced by this review.

Fresh local checks are recorded separately: 50 structural preflight assertions, 53 source regression assertions, three parser checks and manual application of the 48 documented deterministic checkers. None is represented as execution of the private portal checker suite. The snapshot directory is named `task`, so a directory-name assertion on the snapshot itself fails by construction; the source-directory check passes and hash verification establishes identical contents. Both results are retained.

Use `per-row-review/summary.json` for completion while work is active. Final reconciliation must preserve originals, include every credible finding and explicitly retain missing runtime measurements.
