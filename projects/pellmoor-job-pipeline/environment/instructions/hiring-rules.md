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
