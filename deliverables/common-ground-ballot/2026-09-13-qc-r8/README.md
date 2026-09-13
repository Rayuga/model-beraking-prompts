# Common Ground Ballot Review

Reviewed the five trials in the four exports uploaded on 13 September 2026.
All evaluated prompt/judge/runner/reward hashes match the 12 September judge-r5
archive. Captured Oracle source matches that archive's golden solution.

| Trial | Recorded reward | Functional passes |
| --- | ---: | ---: |
| Oracle | 0.9917 | 19/19 |
| GPT 5.4 mini | 0.9595 | 18/19 |
| Gemini 3.7 Flash | 0.6809 | 12/19 |
| Claude Haiku 4.5 | 0.2762 | 1/19 |
| NOP | 0 | Not graded |

## Findings And Changes

- Oracle has no recorded Functional failure. The dark-theme Pending badge used
  the light-theme brown foreground on a dark background. Corrected it, improved
  secondary text and small icon/brand foregrounds, then measured contrast and
  inspected settled desktop/mobile screenshots. The new Visual score is unknown.
- GPT's Published vote replay failure reproduces before and after restart.
  Its approval denominator also fails on partial turnout, a case the old fixtures
  did not distinguish. The new input belongs to the existing approval criterion.
- Gemini's reasons include lost role-probe exchanges, Leila's vote omitted before
  Close, and missing first-restart screenshots despite correct second-restart
  results. These are missing judge evidence, not established independent app bugs.
  The ordered procedure now explicitly checkpoints those observations. No score
  has been edited or recomputed as an official result.
- Polish previously told the judge to use only Ruth while inspecting voting.
  Use the appropriate Member account for Vote and staff accounts for staff data;
  retain labels, focus, feedback and mobile usability requirements.
- The runner's symlink allowlist rejected valid internal/preinstalled dependency
  links not forbidden by the brief. Resolved links inside /app or the installed
  Node dependencies are now allowed; links into verifier paths are still rejected.

## Evidence

run-analysis.json and criterion-matrix.csv contain every recorded verdict.
gpt-probe-results.json is a disposable real-UI reproduction, not a new model run.
browser-results.json, contrast-results.json, runtime-results.json and
harness-results.json contain unpaid local checks. Three negative-control folders
retain deliberate failures. package.py generates the final source/ZIP audit and
the 53-point local rubric review only after those checks pass.

See DIFFICULTY-PLAN.md before commissioning another model build. The corrective
ZIP is not evidence of a model-breaking score. A fresh platform Oracle/QC run on
its exact checksum is still required; no paid provider calls were made here.
