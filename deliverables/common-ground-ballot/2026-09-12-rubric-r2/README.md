# Ballot Approval-Tally Rubric Correction

Upload `common-ground-ballot.zip`. It has one `common-ground-ballot/` wrapper,
36 files and 33 unchanged criterion IDs/weights. The prior upload remains in
`../2026-09-12-standard-r1/`.

## Platform Finding

The supplied screenshot reports 45/45 static checks and 52/53 Rubric Source
checks passing. The remaining finding, `no_criterion_grades_the_unrequired`, is
valid: the approval-tally test required an on-screen explanatory sentence that
the instructions never requested. Correct percentages alone should satisfy that
part of the requirement.

## Correction

Only `tests/functional/judge.toml` and its prompt-version line changed. The
`published_approval_tally` criterion still requires publication by Ruth, one
revision advance, 2 participating ballots, Street trees 2/100%, Bike racks 1/50%,
Community noticeboard 1/50%, private selections and durable publication. It now
explicitly does not require a separate sentence explaining the percentage sum.

Functional prompt revision is r4. The golden solution, instructions, seeds,
runtime, network configuration, scoring formula and all other criteria remain
byte-identical to the prior ZIP. Coverage stays outside the uploaded task.

## Evidence and Limits

`validation.json` records fresh exact-image builds and local runtime/browser/
harness results. `standard-checks.json` records local template checks.
`browser-results.json` covers the golden approval result and the rest of the 13
workflow groups; `harness-results.json` covers 12 synthetic score/startup cases.
These are local regressions, not full LLM Oracle verdicts.

`before-after.json` proves the two-file scope. `package-audit.json`,
`source-hashes.json`, `prompt-provenance.json` and `SHA256SUMS.txt` tie the ZIP to
the tested source. The package script refuses any unrelated source difference.
The authoring lesson is recorded in `TASK_LEARNINGS_2026-09-12.md` at repo root.

A fresh full Oracle and platform QC have not been run. The screenshot's pass
counts belong to the preceding upload and must not be reported as a new pass.
No provider API calls were used for this correction.

Reproduce from repo root with `python deliverables/common-ground-ballot/2026-09-12-rubric-r2/validate.py`,
then run `references/task-templates/check-standard.py` for `projects/common-ground-ballot`
with `--output deliverables/common-ground-ballot/2026-09-12-rubric-r2/standard-checks.json`,
then this folder's `package.py`.
