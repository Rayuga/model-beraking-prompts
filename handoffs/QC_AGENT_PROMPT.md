# Independent QC handoff

Do not use a ZIP hash or verdict copied from an older handoff. Follow [local QC](../qc/README.md) and the [review policy](../qc/REVIEW_POLICY.md).

1. The coordinator runs `python scripts/qc_pipeline.py prepare projects/<slug> --run <unique-name>`.
2. Open the assigned `qc/runs/<name>/reviewer-N.md`. Use only its frozen task and rules. Read both the workbook and the skill with its references.
3. Three agents run in parallel. Each reviews all 53 quality and 48 deterministic rows and writes only its assigned report. Do not inspect another reviewer's conclusions beforehand.
4. Record path/line or actual-run evidence, defensible counterexamples, and missing measurements. A matching source hash does not turn scripted tests into a full Oracle run.
5. Return the report path, confirmed problems and evidence gaps. The coordinator reconciles all findings, obtains independent confirmation for refutations, and freezes a new candidate after fixes.

This file is a reusable entry point. Candidate-specific instructions are generated per run. Historical candidate references removed from this file remain available in Git commit `254615f9838c1054b136f3490a48757ffcc91d9f`.
