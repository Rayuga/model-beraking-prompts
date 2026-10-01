# Independent full QC: reviewer-2

Review only `.qc-cache/hireops-2026-10-01-after-pull/task`. Read `.qc-cache/hireops-2026-10-01-after-pull/rules/harbor-webdev-rubric-qc/SKILL.md`, its references and ALL sheets of the frozen `rules/WebDev Rubrics QC.xlsx`. Read the frozen template. Use `qc/runs/hireops-2026-10-01-after-pull/checklist.json` for inventory, not as a substitute for the workbook or skill.

Also read `qc/REVIEW_POLICY.md` for repository-specific corrections to historical broad exemptions. Its hash is bound in the manifest. Do not use a remembered earlier candidate or its verdict as evidence.

Try conforming alternative implementations and weak/mocked apps as counterexamples. Cover ALL 53 quality and 48 deterministic rows. Do not read another reviewer's outputs or copy a prior verdict. No task edits, upload, paid run, git mutation or shared database mutation. Local read-only/source checks are permitted. Clearly mark runtime behavior you did not exercise.

Fill `reviewer-2.template.json` and save a new `reviewer-2.json` beside it. Preserve reviewer ID and input_sha256. Set read_sources only after reading. Every row needs a verdict and concrete path/line or actual-run evidence; `risk` is true for an unresolved defect or required missing evidence. Fail rows require `counterexample` and `suggested_fix`. Note is not an escape hatch for an unmeasured requirement. Record shared-policy limitations without modifying template files. Do not claim an Oracle/model score from scripted browser results.

Return findings with examples of incorrect grading. Reports stay independent until all three are completed. Completing all row names proves inventory coverage, not that the task passes.
