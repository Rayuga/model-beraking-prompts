# DropLine Four Lite delivery package

This folder mirrors the evidence layout used by the accepted reference tasks.
Only `dropline-four-lite.zip` is the Harbor task upload. Everything else is
supporting run, report, and QC evidence.

## Contents

- `dropline-four-lite.zip`: clean 28-file v6.0.3 task archive. It extracts into
  one top-level `dropline-four-lite/` folder.
- `dropline-four-lite/`: readable extraction of that exact task archive.
- `dropline_four_lite_oracle.zip`: exact-package Oracle run and verifier output.
- `dropline_four_lite_gpt_5_4-mini-high.zip`: exact-package GPT-5.4-mini run,
  generated artifact, trajectory, and verifier output.
- `dropline_four_lite_haiku_4_5-high.zip`: exact-package Claude Haiku 4.5 run,
  generated artifact, trajectory, exception record, and verifier output.
- `dropline_four_lite_eval_report.docx`: evaluation report.
- `CASE_STUDY_dropline_four_lite.md`: task and run case study.
- `qc/`: QC workbooks, findings JSON, and scorecard cross-check.
- `MANIFEST.json`: hashes and headline results for this package.

## Validated v6.0.3 results

All three runs used task checksum
`c7400c4c34da652f7e4d050c40a063e4aa4fd4ffeacd3b6aa4ecd092d10aa528`.

- Oracle: 1.0000 — Render 1.0, Constraints 1.0, Functional 1.0, Polish 1.0.
- GPT-5.4-mini: 0.5390 — Render 1.0, Constraints 1.0, Functional 0.6316,
  Polish 0.4. The agent reached `FINISHED`; no exception or no-op occurred.
- Claude Haiku 4.5: 0.3327 — Render 1.0, Constraints 1.0, Functional
  0.4211, Polish 0.2. All 22 criteria returned non-empty reasoning with no
  judge timeout. After building the graded artifact, Haiku used a broad
  `pkill -f` command that also terminated OpenHands, so Harbor records one
  model-caused exit-143 exception.
- No-op: 0.0000.

The task and verifier both use `network_mode = "public"`, matching the platform
configuration used by the other accepted tasks. The run archives exclude API
configuration, `.jwt_secret`, and raw completion dumps.

## Post-run QC

- Documented upload checks: 26/26 pass.
- Run-evidence checks: 9/9 pass.
- Source-decidable checks: 18/19 pass.
- RL scorecard: 50/58 (86.2%), Conditional Accept.

The one failed source check is DLF-09. The packaged
`solution/app/server.js` contains mixed LF/CRLF line endings, so its raw
SHA-256 differs from the LF-normalized hash recorded in `task.toml` and
`coverage.json`. The scored package was left unchanged to preserve exact-run
provenance. Review the QC workbook and evaluation report before submission.
