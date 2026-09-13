# Task Learnings: 13 September 2026

## Full Turnout Can Hide A Wrong Denominator

Common Ground Ballot's new GPT run scored 0.9595. All existing approval fixtures
had equal eligible and participating counts. Source review and an unmodified
captured-app browser probe found that GPT divided by eligibility, not participation.
With two eligible Members but only one approval submission, it showed 50/0/50
instead of the required 100/0/100, including after restart.

Choose fixtures that make competing implementations produce different outcomes.
Retain the full-turnout case as a positive control; add partial turnout to the
same denominator criterion rather than multiplying its weight through siblings.
The golden and an intentionally wrong denominator variant establish both sides.

## Do Not Diagnose Oracle From Its Total Alone

The same upload's Oracle was 0.9917 with all 19 Functional criteria passing.
Only Visual contrast lost credit. Fix the actual badge/secondary-text colors,
measure the rendered contrast, and wait for theme transitions before screenshots.
An intermediate frame can falsely make readable controls appear dark-on-dark.
Local visual inspection does not guarantee the next LLM Visual rating is 1.0.

## Use The Right Role In Later Dimensions

Polish told the judge to inspect Member voting as Ruth, a Coordinator. Review
staff surfaces as staff and voting as a Member. Later dimensions must tolerate
earlier mutations and should create an ordinary UI fixture only if needed, never
reset records or fail solely because the wrong role cannot access a workspace.

## Capture Before Closing And Before The Next Restart

Gemini's export lost mutation exchanges and skipped a Member vote before Close.
It also lacked Results evidence after restart one although restart two was read.
Use short checkpoint tables; preserve each response before another request and
each restart's rendered results before the next restart. Do not call missing
observations demonstrated app defects or award untested criteria as passes.

## Avoid Hidden Filesystem Restrictions

When the brief permits installed dependencies and normal app structure, do not
reject safe symlinks merely because they are not under node_modules/.bin. Resolve
the final target, permit only explicit safe roots and test both allowed internal/
dependency links and forbidden verifier-path links. Keep the app unprivileged.

## Scores Need Honest Calibration

Fairness fixes can raise scores. The denominator correction alone would leave
the recorded GPT near 0.9274 if all other verdicts stayed unchanged. It cannot
justify claiming the task will enter the target band. The saved Ballot difficulty
plan proposes explicit staff-operation receipts and conflicting roster workflows;
those are proposals, not hidden requirements in the corrective package.

Ballot review: reports/common-ground-ballot/2026-09-13-review/.
Coursemark is paused at its validated checkpoint in
reports/coursemark-assessment-workspace/2026-09-13-conversion/HANDOFF.md.

## Approved Stateful Scope: r9

The user subsequently approved the staff-receipt and roster-conflict proposal.
It is implemented in Functional r9, with three explicit new requirements and
three separately owned workflow groups. The r8 archive remains the unchanged
corrective package described above. New evidence and handoff:
reports/common-ground-ballot/2026-09-13-stateful-r9/.

An active/paused/active roster cycle is useful: the final boolean equals the
stale tab's original value, but the revision has advanced. A stale Pause must
still be refused. Follow that refusal into the next opening snapshot, then
make a fresh Pause and inspect a different snapshot. Do not stop at a toast.

Replay success responses after unrelated later work and restart. Compare each
original response separately from current state: returning an old active or
Open snapshot must not activate a member or reopen a ballot. Bundle related
staff receipt actions into one group instead of seven copies of the same bug.

Recorded refusals need an explicit product contract. Distinguish well-formed,
authorized stale/state refusals from malformed or unauthorized requests whose
receipt storage is not required. State whether status and full response body
must remain identical; do not silently grade incidental fields beyond the promise.

Captured r7 GPT, Gemini and Haiku apps accepted stale membership actions, but
they were never asked for the new guarantee. Record this as new-scope diagnostic
evidence only. Do not reduce old scores or claim a new model build will omit it.

Local golden tests passed27 groups; six targeted broken variants were detected.
These are implementation evidence, not a paid Oracle or platform53/53 verdict.
The new three2.0-weight groups still do not establish GPT below0.7. An illustrative
old-build calculation with those failures and the denominator correction is
about0.8328; do not force the target with duplicate weights or concealed requirements.

During the captured-GPT diagnostic, selecting Single did not change a default
selection limit of2. The first diagnostic submission was therefore invalid.
Correct the visible limit to1 and verify the successful setup before testing
replay. A probe setup mistake is not a model failure.
