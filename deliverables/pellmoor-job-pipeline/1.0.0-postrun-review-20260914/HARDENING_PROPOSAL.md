# Pellmoor: next difficulty revision

GPT's recorded result is 0.7661. It already passed most concurrency, durability,
assessment freshness and capacity checks. Strengthening the judge's wording
alone cannot establish a score below 0.7. Correcting unfair deductions could
increase its measured score.

The current review revision implements stricter, disclosed type validation and
per-request state-preservation observations, plus corrected authentication and
workflow probes. A direct GPT diagnostic also found two activity events for one
interview-entry action; the existing complete-panel criterion now explicitly
counts event IDs before and after each action. It does not add the new workflows proposed below. Existing
criteria IDs, weights and the 60/20/20 formula remain unchanged.

## Recommended extension: atomic batch offers

This is a useful coordinator/manager workflow: a hiring manager selects several
fully assessed applicants in one vacancy, reviews the combined capacity impact,
and confirms one batch. A batch must either offer every selected applicant or
change nothing. Selection and preview are read-only. This extends the existing
single-candidate offering behavior with genuinely new product outcomes.

Agent-visible rules must specify all of the following before a model run:

1. Only Ruth can commit a batch. Each selected applicant must belong to the
   displayed vacancy, be at interview, and have a complete current assessment.
   Reject empty selections, duplicate IDs and mixed-vacancy selections.
2. Check capacity for the whole batch. If any applicant is ineligible or the
   total exceeds available openings, reject without changing any applicant,
   score, assessment version, capacity, stage history or activity.
3. One accepted batch advances the vacancy revision exactly once and records
   one attributed stage event for each affected applicant, all linked to one
   batch operation. Other applicants and vacancies remain unchanged.
4. Batch and single-candidate writes participate in the same revision check and
   atomic transaction. Two requests from one revision cannot partially commit.
5. Persist the exact batch result with its writes. Retrying after a dropped
   response or restart returns the original receipt without additional offers,
   events or capacity use. Document whether selected ID order is significant;
   use the existing array-order rule consistently unless explicitly revised.
6. The UI shows the selected applicant count and projected remaining capacity,
   prevents duplicate submission while pending, and refreshes current state
   after conflicts or receipt replay. A failed batch preserves the selection
   for review without automatically retrying against a new revision.

The golden implementation needs one backend transaction, shared capacity and
eligibility validation, persistent batch receipts, and a visible selection /
review / confirm flow. Sequentially calling the existing stage endpoint is
insufficient: it can leave partial changes and consumes several revisions.

Grade independent outcomes: successful batch fidelity; all-or-nothing failure;
arbitration with another write; durable replay; and review/pending UI behavior.
Do not award or deduct the same atomicity assertion repeatedly under different
names. Keep the existing rubric intact until a complete coverage review assigns
weights by product importance. Do not choose weights from GPT's observed score.

Validate both a correct implementation and deliberately broken variants before
running models. Useful negative controls are a loop of independently committed
stage changes, capacity checked per candidate outside the transaction, a receipt
saved after commit, and a UI that silently retries a stale batch. Local probes
must detect each corresponding defect while passing the golden implementation.

## Alternative extension: approval tied to an assessment snapshot

If batch selection is not desired, add a two-person offer proposal workflow.
Cal proposes an offer against a particular assessment version; Ruth explicitly
approves that proposal. An assessment/panel change invalidates the proposal,
whereas adding a note does not. Approval consumes current capacity atomically,
requires a different authorized actor, survives restart and retains the
original proposal/decision in the audit trail. Replaying a decision cannot
approve a newly reopened interview. Specify these distinctions in the brief,
then implement the workflow and independent tests in the golden solution.

This is an alternative product extension, not an additional hidden gate for
the current four-account task. Adding both extensions at once would make it
harder to diagnose which requirements are measuring useful failures.

## Calibration and release

With GPT's recorded Polish=0.6 and Visual=0.7083 held fixed, Functional would
need to be at most approximately 0.7306 to yield overall <=0.7. Its recorded
Functional is 0.8408. This arithmetic explains why fixing the golden UI alone
cannot solve the target-model band; it is not a prescription to remove points.

After implementing one extension, freeze the task ZIP and record its hash.
Build both exact images, run golden and negative-control regressions, then run
a full Oracle and GPT-5.4-mini evaluation on that same artifact. Retain every
attempt and report all results. Oracle must pass all Functional criteria and
meet the overall threshold; Visual=1.0 remains the authoring target and needs
actual judge evidence. Keep Gemini as an unrestricted comparison. Rerun Haiku
with the corrected launcher before interpreting its score.

No proposed extension guarantees GPT will land in 0.1–0.7. If it still performs
above that band, report that result and reassess the product's difficulty;
do not hide passes, reuse old scores for a changed task, or lower the golden
Visual anchors.
