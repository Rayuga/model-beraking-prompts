# DropLine Four Lite delivery package

This folder mirrors the evidence layout used by the BazaarBridge delivery.
Only `dropline-four-lite.zip` should be uploaded as the Harbor task. Everything
else is supporting run and QC evidence.

## Contents

- `dropline-four-lite.zip`: clean 28-file platform upload, version 6.0.3.
- `dropline-four-lite/`: readable extraction of that exact platform ZIP.
- `dropline_four_lite_oracle/`: consolidated golden-solution verifier result.
- `dropline_four_lite_gpt_5_4-mini-high/`: untouched GPT-5.4-mini run and its
  verifier-only rerun with the corrected judge timeout.
- `dropline_four_lite_gpt_5_4-mini-high.zip`: shareable copy of the GPT run.
- `dropline_four_lite_haiku_4_5-high/`: untouched Haiku agent run and its final
  verifier-only result.
- `dropline_four_lite_haiku_4_5-high.zip`: shareable copy of the Haiku evidence.
- `dropline_four_lite_eval_report.docx`: final evaluation summary.
- `CASE_STUDY_dropline_four_lite.md`: short task and run case study.
- `qc/`: final QC workbook, formal RL scorecard, source findings JSON, and
  scorecard cross-check.
- `MANIFEST.json`: hashes and headline scores for this package.

## Validated scores

- Oracle: 1.0000.
- Untouched GPT-5.4-mini: 0.3642.
- Untouched Claude Haiku 4.5: 0.0000 after hard gates (functional 0.6842).
- No-op: 0.0000.

The GPT artifact was generated against version 6.0.2. Version 6.0.3 changes
the constraints-judge timeout, records frozen hashes, and includes the verified
mobile layout repair; it does not repair or alter the preserved GPT artifact.
