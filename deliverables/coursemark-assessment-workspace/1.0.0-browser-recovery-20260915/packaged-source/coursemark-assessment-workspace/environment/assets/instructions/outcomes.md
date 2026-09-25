# Course outcomes, grading worksheets and reviewed release

The Gradebook provides an outcome ledger, an atomic grading worksheet and an
instructor batch-release workflow. These are required working surfaces. Keep
the existing single-row grading and individual release workflows usable too.

## Weighted outcome ledger

Start with A-01 weighted 40%, A-03 weighted 40% and A-04 weighted 20%. Drafts
have no weight. A newly published assessment starts at 0% (unweighted).
The instructor edits the whole policy in one operation. Include each published
assessment exactly once; accept nonnegative percentages with at most two decimal
places totaling exactly 100%. Reject duplicates, unknown/draft assessments,
missing rows, invalid numeric types and invalid totals atomically. Each accepted
policy save advances revision once and writes one audit event. The instructor
can excuse a student's published assessment with a required reason, or restore
normal inclusion, without deleting attempts or grades. Each exception save is
also one revision and one audit event.

Use each student's most recently created attempt for an assessment. Distinguish
missing, pending/unreleased, released, excused and unweighted work. Released zero
is a real score; missing and unreleased work are never treated as zero. Excused
work removes that assessment's weight from this student's denominator. Exclude
zero-weight work. If any included positive-weight work is missing or unreleased,
or no weight remains included, the final percentage is unavailable, never zero.
Otherwise calculate 100 * sum(weight * awarded_points / maximum_points) /
sum(included_weights), rounding only the final answer to two decimal places.
Released scores 4.5/10 and 0/5 at 50% each give 22.50%. Excusing the second gives
45.00%; restoring it gives 22.50%. If the second is missing instead of released
zero, the final is pending. Excusing missing work allows the remaining released
result to count.

Instructors see all enrolled students and can search by name/email. Students
receive only their own row, explanation and policy; unreleased awarded values
remain absent or null in every response. The TA uses the assigned grading queue
and cannot read the full outcome ledger or change policy/exceptions. Preserve
policy, exceptions and computed outcomes through reload, sign-in and restart.
Render labeled assessment cells that remain readable on mobile.

## Atomic grading worksheet

Instructors and the assigned TA can select multiple rubric rows on submitted,
unreleased attempts, edit scores/feedback and save the selection together.
Allow partial selection; unselected rows remain unchanged. Validate all rows
before saving any: reject duplicate or foreign criteria, invalid numeric
types/ranges and forged fields. One accepted worksheet advances revision once
and writes one grade audit event for the attempt, regardless of row count.
Rejecting it changes no grade, total, attempt state, revision or audit event.
Recalculate completion and totals from the complete stored rubric. Single-row
and worksheet grading share the same authoritative data.

Two graders editing from the same revision cannot overwrite one another. Refuse
the stale save, keep the loser's typed values, explain the conflict, refresh
authoritative data and allow an intentional fresh retry. Exact accepted/rejected
receipts and changed-input mismatch handling apply, across restart and sign-in.

## Reviewed batch release

Only the instructor can select fully graded, unreleased attempts and preview
their recipients, assessment titles and actual awarded totals. Preview neither
releases scores nor changes course revision/audit. A stored preview handle may
be created without counting as a course-data write. Bind the reviewed selection
to the instructor and course revision on the server. Clients cannot replace
reviewed IDs, recipients or totals at commit time.

Reject empty or duplicate selections, nonexistent/foreign attempts, already
released attempts and ungraded attempts. Validate the entire selection. Any
intervening course-data write makes a preview stale, even if commit supplies
the new revision. Require a fresh visible preview before retry; selection changes
invalidate the visible preview.

A valid commit releases every selected attempt atomically, advances revision
exactly once and writes one release audit event per attempt. Students then see
only their own released results. Exact commit replay returns its original result
without another release/revision/event; a fresh operation using a consumed
preview refuses. Rejected commits cannot partially release a selection.
Preview bindings, consumption state and receipts persist across restart.
