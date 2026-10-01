# Workspace rules

For WebDev task authoring and QC, start with `qc/README.md`, `qc/REVIEW_POLICY.md`, `NEW_TASK_AUTHORING_CONTEXT.md` and `TASK_AUTHORING_WORKFLOW.md`. Current user/lead instructions take precedence over historical notes.

- Use BOTH `WebDev Rubrics QC.xlsx` and `harbor-webdev-rubric-qc/SKILL.md` with its references. A generated spreadsheet is not evidence that checks passed.
- Before declaring a task ready, use `scripts/qc_pipeline.py prepare --mode single-per-row` for ONE audit round: one separate fresh reviewer context for each of the 53 quality rows, plus a separate review covering all 48 deterministic rows. Finish the round, reconcile the union, and fix confirmed defects before another round. Reviewers must not read one another's findings before finishing. The 1 October user instruction supersedes the historical three-full-review process; preserve its reports as history.
- Reconcile the union of findings. Never outvote a credible failure, rerun unchanged candidates until green, or waive missing measurements. Fix a confirmed defect in a new candidate; refute a mistaken finding with evidence and independent confirmation.
- Preserve template-controlled files and settings. Task-specific prompts and criteria can change. Do not edit shared harness code or reward policy to silence QC. The user permits justified timeout changes below five hours per lead guidance; record the reason and authorization, never increase automatically. Current candidate budgets remain unchanged without a measured reason.
- Local source checks, scripted golden tests, full configured judge runs and hosted QC are different evidence. Never promise a portal pass, Oracle 1 or a model score without the corresponding measured result.
- Current tasks live under `projects/`. Reports and ZIPs live outside those task folders. Keep unique evidence and reference tasks. Use the bounded cleanup script for reproducible archive extractions; preview its plan first.
- Before packaging, reconcile against the current bytes. Any source, workbook, skill, template, checker or review-policy change invalidates the corresponding clearance. Keep prior reports as history.

These parallel-review instructions apply to task QC, not ordinary small edits or unrelated requests. Do not send messages externally, spend on provider runs, or upload a task without existing user authorization.
