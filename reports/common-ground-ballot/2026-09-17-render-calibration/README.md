# GPT Render calibration

The useful next target is a model submission that completes the basic product
journey and passes Render/Constraints, while remaining below 0.6 overall because
of harder Functional requirements. Oracle already scored 1.0 on r27.

## What was tested

A fresh disposable copy of the supplied GPT-5.4-mini app received two limited
data-response changes:

1. The Vote workspace loads complete eligible ballot details, including choices.
2. The staff Turnout response supplies its identified eligibility/participation
   arrays, which the existing renderer already expects.

No submitted artifact, golden solution, task instruction, verifier, weight or
release archive was edited. The two replacements are recorded in
[diagnostic-patch.json](diagnostic-gpt/diagnostic-patch.json). They are human
diagnostic repairs, not a new model-generated submission.

The actual browser then completed:

- All six workspace surfaces across Ruth and Leila, without browser errors.
- A new single-choice ballot through visible Create, Open, Vote, Close and
  Publish, with one accepted participant and correct 1/0 totals after reload.
- A new Approval ballot through the same visible journey, with one participant,
  both choices approved and 100% for each choice after reload.
- Before/after vote revision checks: both remained at revision 2.
- Exact vote receipt replay after publication, including reversed Approval
  choice order, without changing current published records.

An independent draft-edit problem remains: its ordinary edit form still loads
an empty choice list from the incomplete draft summary. The diagnostic did not
repair advanced review, round or pending-action behavior.

[Captured observations](diagnostic-gpt/diagnostics.json) show these results.
This exercises the two Render behaviors locally; it is not an autonomous judge
run or proof that every Functional criterion now passes.

## Score implications

The actual supplied GPT score is still zero because Render failed. Merely
changing that dimension to passing, with all three weighted dimension scores
held fixed, would give:

`0.6 * 0.1824 + 0.2 * 0.6429 + 0.2 * 0.8333 = 0.40468`.

However, real voting repairs unlock previously unavailable Functional evidence.
Turnout and voting repairs can also improve Polish and Visual. Therefore 0.4047
is only a fixed-score counterfactual, not a predicted score for the repaired app
or a fresh model run. At unchanged Polish/Visual, Functional must remain at or
below approximately 0.5079 to keep the total at or below 0.6. If Polish/Visual
improve, the allowable Functional score becomes lower.

## Recommended next step

Keep the independently passed r27 golden and existing Render checks intact.
They correctly require working navigation and voting. A more informative next
measurement is a second fresh GPT run on this same version: one broken submission
does not establish how often the model can finish the core flow.

If basic-flow failures recur, make a separately versioned task revision that
strengthens the public smoke-test guidance or supplies a small, consistent
workspace-data foundation for all solvers. Preserve privacy and the advanced
Functional requirements. Such a revision needs its own Oracle, GPT and platform
QC runs; this human-repaired diagnostic copy cannot stand in for those results.

The separate platform rubric/QC result remains absent from the supplied files.
Passing Render alone cannot establish platform rubric acceptance or the final
GPT <=0.6 score after other behaviors improve.
