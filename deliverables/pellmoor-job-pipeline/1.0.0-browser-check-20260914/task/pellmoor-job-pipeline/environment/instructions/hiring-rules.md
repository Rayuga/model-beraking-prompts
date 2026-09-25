# How we run a vacancy

Candidates move through applied, screening, interview, offer and hired in that
order. Do not skip stages. Moving back one stage is allowed, but not a larger
jump. Rejected and withdrawn applications are terminal records.

An interview panel needs at least two distinct people and cannot consist only
of the hiring manager. Every panel member gives a whole-number score from 1 to
5, including both end values, before an offer can be made.

Treat applications to different vacancies independently. The same person may
apply for different roles, but must not appear twice against one vacancy.

Only the hiring manager moves candidates. The coordinator adds candidates and
arranges panels. Assigned panel members score their candidates. Everyone may
add notes. Notes are additions to the record and cannot be edited or deleted.

Derive each vacancy's funnel from candidate stage history: show how many people
reached each stage, remain there, and were lost there. A person is lost at the
last pipeline stage they reached before the application became rejected or
withdrawn; simply progressing to the next stage is not a loss. Do not accept
stored or browser-supplied funnel totals.
Keep stage history in visit order, including a return to a previously visited
stage. After a backstep followed by withdrawal or rejection, the loss belongs
to that last visited pipeline stage; reached counts still count people once.

Assessment freshness
--------------------
Each application starts at assessment version 1, including imported candidates.
The seeded scores belong to version 1. Every accepted panel addition or removal,
and every transition into interview, advances that application's assessment
version once. All earlier scores become historical, including scores from panel
members who remain assigned. Keep them visible with their version and scorer;
they never satisfy the current offer gate. Retain the final score per member
per historical version; edits within a version remain in the activity trail.
Retain the panel when reopening an
interview. Everyone on the current panel must score again in the new version.

Cal can add and remove panel members only at applied, screening or interview.
Only Ruth, Otis and Wren are eligible panel members; Cal cannot score and cannot
be assigned. Duplicate additions and removal of an absent member are rejected.
Scores can be recorded or changed only at interview by the assigned scorer.
At offer, hired, rejected or withdrawn, panels and scores are frozen. Notes
remain available. To revise an offered assessment, Ruth first moves it back to
interview. Rejected changes must not advance the version or invalidate scores.
Each accepted action still produces exactly one vacancy revision and one
activity event, which includes any assessment-version change and its reason.

Vacancy capacity
----------------
An offer reserves one opening and a hired candidate fills one opening. For each
vacancy, reserved plus filled must never exceed its seeded openings. Derive and
display reserved, filled and available counts from current application stages.
An interview-to-offer move needs a free opening as well as a complete current
assessment. Offer-to-hired converts a reservation into a filled opening; the
legal hired-to-offer backstep converts it back without requiring extra space.
Leaving offer or hired for a stage outside that pair releases the opening.
Never change another candidate or vacancy to make room automatically.

Concurrent attempts from one vacancy revision can commit at most one change.
After refreshing, the losing applicant may still be refused because the vacancy
is full. Refusing a full vacancy must leave candidates, assessment versions,
scores, histories, capacity, funnel, revisions and activity exactly unchanged.
After a withdrawal releases an opening, another fully assessed applicant can
receive an offer. Replaying an earlier success or failure must never reacquire
an opening, undo that release or bypass the current state for a new operation.


Atomic batch offers
-------------------
Ruth can select one or more applicants from one vacancy, review the complete
selection and confirm their offers as one operation. Selection, cancellation
and preview are read-only: they reserve no openings and create no revision,
receipt or activity. Show each selected name, identifier, assessment version
and eligibility, the selection count, current capacity and projected capacity.
A preview is a point-in-time review, not permission to bypass later validation.

Commit the entire selection or none of it. Every selected applicant must belong
to the vacancy, be at interview and have a complete eligible current panel and
current scores. There must be enough available openings for the whole batch.
Reject empty selections, duplicate or unknown identifiers, mixed-vacancy
selections, malformed identifier arrays, unauthorized actors and supplied
server-owned counts, versions or attribution. Reject the whole batch if even
one applicant is ineligible, regardless of where they occur in the selection.
A failed batch changes no candidate, score, assessment, note, stage history,
capacity, funnel, revision or activity. Existing receipt rules still apply.

A successful batch moves each selected applicant from interview to offer,
appends that visit once, and advances the vacancy revision exactly once for
the batch. Keep panels, scores and assessment versions unchanged. Add exactly
one attributed stage event per selected applicant, linked by a shared stable
batch identifier and labeled with its position and the total batch size.
The event includes the stage change and current assessment version. Do not add
an extra aggregate product event. Unselected applicants and other vacancies
must remain unchanged. All writes and the durable result commit atomically.

Batch and individual writes share the same vacancy revision and capacity
arbitration. A commit uses the revision the person actually reviewed, even if
another tab has since fetched newer data. Two overlapping batch submissions,
or a batch and an individual offer from one revision, can commit at most one
whole operation; the loser returns a stale 409 without a partial batch.
After a stale refusal retain the selection and explain the conflict. The user
must explicitly review the current selection before confirming a new operation;
never silently refresh the revision and resubmit the old confirmation.

Use the same actor-scoped durable retry contract for batches. Preserve the
selected identifier order in requests, receipts and linked event positions.
Object key order is immaterial; array order remains significant. Success and
business-rejection receipts survive capacity releases, later stage changes,
logout and restart. An old rejection stays rejected even when room later
exists. A success replay never restores a withdrawn applicant or reserves an
opening again. Reordering identifiers with the same operation identity is a
409 mismatch. A different authenticated actor cannot recover Ruth's receipt.

While confirmation is pending prevent repeat activation. If its response is
lost, retain the exact operation identity, reviewed revision and ordered
selection. Provide an explicit retry that recovers the original result, rather
than starting another operation. Do not let the user edit an unresolved request
into a different payload. After an acknowledgement fetch the current vacancy;
a historical receipt is not the current pipeline. Preserve the selected vacancy
and show a clear outcome. Closing a read-only review restores useful focus.
