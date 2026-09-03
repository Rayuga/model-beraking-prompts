# DropLine Four Lite scorecard cross-check

Reviewed against `RL_Task_QC_Scorecard.xlsx` and `Task QC - platform.docx` on
2026-09-04. This report is outside the upload ZIP.

The completed formal workbook is `DropLine_Four_Lite_RL_Scorecard.xlsx`:
52/58 (89.7%), 23 Pass, 6 Partial, 0 Fail, with a Conditional Accept verdict
because rollout-batch spread and three-repeat judge consistency are unmeasured.

## Delivery evidence

- Final task version: 6.0.3.
- Consolidated Oracle: 1.0000 (constraints 1.0, functional 1.0, render 1.0,
  polish 1.0).
- Untouched GPT-5.4-mini artifact: 0.3642 (constraints 1.0, functional 0.4737,
  render 1.0, polish 0.2).
- Untouched Claude Haiku 4.5 artifact: 0.0000 after hard gates (constraints
  0.0, functional 0.6842, render 0.0, polish 0.0).
- No-op: 0.0000 with `no_op=1`.
- Clean platform archive: 28 files, allowlist retained, no excluded files,
  LF-only text, and shell scripts stored as Unix mode 0755.

## Scorecard disposition

- Instruction coverage, natural voice, feasibility, Oracle solvability,
  no-op rejection, score ordering, hard gates, seed isolation, deterministic
  pinned judges, allowlisted verifier networking, and package integrity pass.
- The task has three verified reward levels (1.0000, 0.3642, and 0.0000), not
  the four distinct levels requested by the scorecard's distribution ideal.
- Eight independent target-model rollouts were not requested, so rollout
  spread and failure-frequency requirements are not measured.
- The same artifact was not independently rescored three times, so judge
  repeatability statistics are not measured.
- Browser reload and sign-in persistence are tested, but a server-process
  restart against the same SQLite database is not mechanically tested.
- Same-origin server behavior is verified, but the exact Express/SQLite stack
  is not mechanically inspected.
- Prompt-injection-resistant judge wording is present; a dedicated injected
  adversarial submission was not run.
- Debian base images and apt packages remain floating, which is a low-priority
  reproducibility risk.

None of the unmeasured statistical items invalidates the verified Oracle,
target-model, no-op, or clean-archive evidence. They require additional runs or
new deterministic preflights if the platform treats them as mandatory gates.
