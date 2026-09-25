# Common Ground Ballot

Build Common Ground, a private ballot workspace for Riverside Residents Association.
Deliver the complete running application under `/app`. This file contains the full
brief. The authoritative starting records are `/assets/artifacts/common_ground_seed.json`.

Start by copying `/assets/starter/.` into `/app/`, then copy the seed to
`/app/common_ground_seed.json`. The supplied foundation already implements the SQLite
schema, transactional seed-once import, secure persistent sessions, password checks,
sign-in, sign-out, end-all-sessions, and a responsive six-workspace shell. Extend it
with ballot workflows, protected projections, receipts, and recovery. You may adapt
its schema, routes, and UI; their exact names are not requirements. The foundation
does not implement ballot business routes or pending actions.

Work through the supplied ballots as each demo user, make a new decision from draft
through publication, and check that accepted changes survive a fresh sign-in and
server restart. Registration, email delivery, public result links, imports, exports,
and real-world election certification are out of scope.

# People and workspaces

Common Ground is for one group, Riverside Residents Association. Use the demo
accounts below; they all have the password `CommonGround!2026`.

| Person | Sign-in | Role |
|---|---|---|
| Ruth Adebayo | `ruth.adebayo@commonground.example` | Coordinator |
| Arun Das | `arun.das@commonground.example` | Observer |
| Leila Ward | `leila.ward@commonground.example` | Member |
| Owen Park | `owen.park@commonground.example` | Member |

Ruth prepares ballots, manages the active member list, and moves ballots
through their lifecycle. Arun can review ballot setup, turnout, results,
members, and audit activity but cannot change them. Members can see ballots
for which they are eligible, cast one final ballot, and see their own
participation. In every protected workspace, show the signed-in person's name,
role, and the group name Riverside Residents Association; a shared header is fine.

Provide useful Ballots, Vote, Turnout, Results, Members, and Audit workspaces.
Seed every record from `common_ground_seed.json` exactly once. A restart must
not duplicate the seed or overwrite later work.


# Ballots and decisions

A draft has a title, optional context, a voting method, and at least two
different non-empty choices. Ruth can edit a draft. Once it opens, its wording,
method, and choices are fixed.

Support two voting methods:

- Single choice accepts exactly one choice.
- Approval accepts one or more different choices, up to the ballot's stated
  limit. The limit must be between one and the number of choices.

Opening a ballot captures the active Members at that moment. Later roster
changes affect future ballots, not that snapshot. This is why Owen remains
eligible for the seeded open ballot even though he is currently inactive.

Each eligible Member has one final submission per ballot. A choice from a
different ballot is never valid.

People sometimes retry an action after losing its response. Give each create,
edit, membership change, lifecycle action and vote an operation identifier tied
to the signed-in person. Retrying the same operation should return its original
response status and body, without repeating the change or its audit
event. Reusing that identifier for different input must be refused. Keep these
outcomes through restart, even if the ballot or roster has changed since then;
replaying an old Open must not reopen a closed ballot or recapture its members.

Approval choices form an unordered set. Retrying the same operation with the
same distinct choices in another order is the same submission and must return
the original receipt, including after publication and restart. Changing a
choice is different input and must be refused. Repeated copies of a choice
are invalid input, not another spelling of the set.

Each person's operation identifiers share one namespace across all actions.
An identifier used to create a ballot cannot later edit a ballot or change
membership for that same person. Refuse that collision without changing either
record or replacing the original receipt. Different people have independent
namespaces; an identifier used by one person does not reserve it for everyone.

Each newly created draft starts at revision 1. Each accepted draft edit, Open,
Close, or Publish advances that ballot revision by exactly one. Voting does not
advance the ballot revision. Preserve the revisions provided for seeded ballots.
Refusals and exact replays never advance a revision.

A viewed revision or approval maximum represents a single positive whole
number. Lists, objects, booleans, null and omitted required values are not
versions or limits; do not coerce them into valid numbers. Text encoding in an
ordinary HTML form is fine, but structured or boolean values in a request must
not become a version or limit just because a numeric conversion accepts them.

For a well-formed operation from someone allowed to perform it, remember a
refusal caused by a stale revision or the wrong ballot state too. A premature
Publish must still return its original refusal when retried after Close. To
try again with current information, the person submits a new operation. This
does not require keeping malformed requests, bad sign-ins or unauthorized
requests as receipts. Refusals and retries never add audit events.

The order is Draft, Open, Closed, Published. Voting happens only while Open;
results stay hidden through Closed and appear only at Published. Published is
terminal. Actions should be based on the revision the person is viewing so an
out-of-date write is refused without changing anything.

Published single-choice results show each choice count and total ballots. If
top choices are level, call it a tie and name all leaders. Approval results
show approvals per choice and participating ballots; percentages use the
number of participating Members, so they may add up to more than 100%.


# Privacy, access, and history

Keep identified participation separate from anonymous selections. Staff may
see who has or has not participated, but no screen, response, result, or audit
entry may connect a person with a choice. A successful vote response should
confirm participation without returning the submitted choice or choices.

Members may see their own participation and anonymous totals, but never
another Member's participation status, timestamp, or identified turnout row.
Apply this boundary to every protected response as well as the screen,
including nested ballot collections, turnout payloads, and activity data.
Public demo account names and roles alone are not participation records.

Authority belongs on the server. Derive the person and role from a server-issued
unpredictable session, not an account id supplied by the browser. Each successful
sign-in creates a distinct session credential; public account details, modified
credentials, and unsigned identity claims must never grant protected access. Refuse
unknown, stale, malformed, cross-ballot, or out-of-role writes and leave the
ballot, revision, turnout, results, and history unchanged.

Membership records start at revision 1. Each accepted membership update advances
the applicable membership revision by exactly one; refusals and exact replays
do not advance it.

Roster changes need the revision the Coordinator actually viewed, just like
ballot edits. If two tabs are open, an older membership update must not undo a
newer one, even when the member's active status has changed and then changed
back. Refuse it with useful refresh guidance and no new audit event. A fresh
update can succeed. The accepted roster determines who joins the next ballot's
opening snapshot; it must not rewrite eligibility on an already-open ballot.

Validate membership updates before changing the roster. A missing status or
an object or array in place of the requested active/paused value is malformed;
do not silently convert it into an activation or pause. A required membership
revision also cannot be a list, object, boolean, null or omitted value; use the
single whole-number revision the person actually viewed. Refusal must preserve
the member's status, its applicable revision, and audit history. It must also
leave the next ballot's eligibility snapshot based on the unchanged roster.

Sign-out ends the current session. Also give each person a way to end all of
their Common Ground sessions. A session that has been ended must not continue
to read or change protected records.

Record successful draft, edit, open, close, publish, and membership actions in
the audit with the action, record, actor, and time. Voting may add anonymous
receipt activity, but never the Member name or selected choices.


# Runtime

Public networking is available during implementation and runtime. External fonts,
scripts, styles and API resources are permitted.

- Use Node.js 22, Express, and better-sqlite3, which are already installed.
- Run one process with `node /app/server.js` from `/app`, on port 3000,
  listening on `0.0.0.0`, and serve the browser UI at that address.
- `GET /api/health` should answer successfully.
- Honor `DB_PATH` when provided; otherwise store SQLite at `/app/commonground.db`.
- Keep sessions, ballots, votes, participation, membership, operation receipts,
  and audit activity in SQLite so accepted work survives restart.
- During implementation copy the supplied seed to `/app/common_ground_seed.json`.
  Honor `SEED_PATH` if supplied; otherwise use that embedded seed file.
- Only `/app` is retained as the finished application. `/assets` and
  this brief are build-time inputs and may be absent at startup.


# Interface notes

Make the lifecycle and current ballot status easy to understand. Staff should
be able to scan eligibility and turnout without seeing live choice totals, and
Members should get a clear privacy explanation before their final submission.

Validation and refused actions need a useful message that stays available
until the person dismisses it or completes another action. Disable or explain
actions that do not apply, but do not rely on hidden controls for security.

Use a polished responsive layout with a light/dark theme control. The six
workspaces must stay reachable around 390 by 844 without horizontal page
overflow. Use landmarks, real headings, associated labels, visible keyboard
focus, comfortable touch targets, and status text that does not rely on color
alone. Respect reduced-motion preferences.

Use consistent readable typography, spacing, alignment and contrast across
the ballot list, turnout, published results, roster and forms. Keep clear
visual hierarchy and the same coherent presentation in both themes and sizes.


# Picking up interrupted staff work

Our coordinators sometimes lose the connection just after pressing Save. They
cannot tell whether the server accepted the change, and they often reload or
sign out before coming back. Give them a Pending actions area inside the
workspace so they can resolve that uncertainty without repeating the change.

Keep each staff attempt before sending it: creating and editing a draft,
opening, closing, publishing, and changing membership all need this support.
If no usable confirmation arrives, say that the outcome is unknown and retain
the attempt through page reload and a later sign-in in the same browser profile.
Identify its action and affected record clearly. Do not automatically resend it
on startup, refresh or sign-in. An unreadable response or server failure does not
prove the write was refused. A confirmed write followed by a failed refresh is
still a confirmed write; explain the refresh problem separately.

Provide an explicit Retry for each pending attempt. Retry must use that exact
attempt's original target, action, inputs, operation identifier and viewed
revision. Even if another tab has edited the record or advanced the ballot,
Retry is asking what happened to the original attempt, not requesting a new
change. Resolve the pending entry when a usable success or definite business
refusal arrives, show the outcome, and refresh the current records. Do not copy
an old receipt's state over newer data. After a refusal, trying a changed action
is a separate user decision using current information and a new identifier.

Several actions can be uncertain at once. Keep them separately recognizable and
let people continue independent work. Retrying or dismissing one must leave the
others intact; it must not send the entire queue. Dismiss removes the reminder,
not a change that may already have happened, and the UI should explain that.

Pending work belongs to the person who initiated it. Signing out hides its
details. Another account on the same browser must neither see those details nor
send the original person's requests. Returning as the original person restores
their unresolved work. If a session expires or is revoked, keep the uncertainty
for that person to resolve after signing in again; do not silently replay it as
whoever signs in next. This recovery area is for staff writes, not Members'
private selections.

We also keep two tabs open for the same account in the same browser profile.
They share the pending work. Once one tab resolves or dismisses an entry, the
other must reflect that on its next interaction or reload. A stale tab or late
response must not bring a removed entry back or overwrite another pending
attempt. Disable an action while its request is in flight so a double click
does not create two new attempts. A pending attempt must not run concurrently
from two tabs in the same profile. No particular storage library or layout is
required; accepted business records and receipts still belong in SQLite.
