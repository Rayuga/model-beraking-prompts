# Common Ground Ballot

Could you build us Common Ground, a private ballot workspace for Riverside
Residents Association? I'd like our coordinator to be able to prepare a decision,
let members vote, and publish the outcome without anyone having to wonder whether
their vote saved or who can see it. It needs to work as a real, persistent app.
Coming back tomorrow shouldn't mean starting over.

Ruth Adebayo is our Coordinator. She looks after the member list, prepares ballots
and decides when to open, close and publish them. Arun Das is our Observer: he
needs to review ballot setup, turnout, results, members and audit activity, but he
can't change any of it. Leila Ward and Owen Park are Members. They should see the
ballots they're eligible for, make one final submission on each, and check their
own participation. I'd like Ballots, Vote, Turnout, Results, Members and Audit to
be useful places people can move between, with their name, role and Riverside
Residents Association visible wherever they're signed in. A shared header is fine.

These are the demo logins; they all use `CommonGround!2026`:

- Ruth: `ruth.adebayo@commonground.example`
- Arun: `arun.das@commonground.example`
- Leila: `leila.ward@commonground.example`
- Owen: `owen.park@commonground.example`

I've left our starting records in `/assets/artifacts/common_ground_seed.json`.
That's the source to use for all the initial data, including the ballots already
underway. We'd only import it once; restarting the app mustn't duplicate those
records or wipe out later work. There's also a working base in `/assets/starter/`
with SQLite, the seed import, session/password handling and a six-workspace shell.
Please build on that. The ballot workflows and pending-work experience are still
to be added, and you're free to adapt the schema, routes and UI as you go.

For a new ballot, Ruth needs a title, some optional context, a voting method and
at least two different, non-empty choices. She can change those while it's a
Draft. We use single choice when people should pick exactly one option, and
Approval when they can pick several different options up to that ballot's limit.
Approval needs a stated
maximum between one and the number of choices; at least one choice is still
needed for a vote. Once Ruth opens a ballot, its wording, method and choices are
fixed. Nobody should be able to sneak in a choice from a different ballot either.

The stages we use are Draft, Open, Closed and Published, in that order. Members
vote only during Open. Closing stops voting, but it doesn't reveal the results:
even staff wait until Published for choice totals or leaders. After publication,
that ballot is finished and can't be changed again. For single-choice results I'd
like each choice's count and the total number of ballots. A tied lead should say
it's a tie and name everyone tied. For Approval, show each choice's approvals and
the number of participating members. The percentages use that participant count,
so it's perfectly fine for the percentages across choices to add up to over 100%.

Eligibility is decided when a ballot opens, using the Members who are active
then. Pausing or activating someone later should only affect future ballots.
Owen is a useful example in the starting data: he's paused now, but he's still
eligible for the ballot that was already open. We mustn't take that away from him.

We sometimes put several decisions to the same meeting. Could Ruth select two
or more drafts and open them as one round? She needs to review their titles,
wording, voting definitions and the Members who'll be eligible before confirming.
Selecting drafts, reviewing them or cancelling shouldn't open anything. Keep the
ordinary one-ballot Open as well; a round is a separate action with one receipt.

When she confirms a round, either every selected draft opens or none does. Each
gets one revision advance, the same reviewed eligibility snapshot, and its own
usual Open audit event. A draft outside the selection stays untouched. If another
tab edits or opens even one selected draft after her review, refuse the whole
round without opening the others or adding their audit events. Tell her to review
again. Don't quietly fetch newer revisions and open against information she
hasn't seen. After another explicit review she can confirm a fresh action.

The member list can change under her too. Please check the revisions of the
whole roster she reviewed, including paused Members. Pausing someone and then
activating them again still invalidates an earlier review, even when the active
names look the same. Nothing in the round should open until she reviews that
newer roster. And a round with no active Members can't open.

I don't want a malformed selection to open just the valid part. Refuse the whole
request if it contains fewer than two different drafts, a repeated ballot,
an unknown ballot, a ballot that's no longer Draft, an invalid required revision,
or an incomplete roster. Check this on the server as well as in the form.
Arun and the Members still can't open anything, including through a round.

For retries, order isn't meaningful: the same selected ballots with the same
reviewed revisions and roster, in a different order, are the same round. Return
its original response even if a ballot has since closed or membership changed.
Changing the selection or a reviewed revision under that identifier is different
input and must be refused. Keep the original receipt intact. A well-formed round
refused for an outdated draft or roster also keeps that original refusal after a
fresh round succeeds and after a restart; retrying it must never open anything.

An interrupted round belongs in Pending actions as one recognizable entry listing
its selected ballots. Keep the reviewed selection and roster as they were. Retry
checks that whole original action, rather than opening the ballots separately,
and refreshes their current states after the reply. This should survive a reload,
signing back in and a server restart, just like the other staff work below.

Privacy is the part I really don't want us to get wrong. Staff need to see who
has and hasn't participated, but nobody gets to connect a person to their choices.
Please keep identified participation separate from anonymous selections. That
separation needs to hold on screen, in responses, in results and in the audit.
After a vote is accepted, please confirm participation without returning the
choices in the response or repeating them in the post-submit confirmation.

Members only get their own participation details and anonymous totals. Leila
mustn't receive Owen's participation status, time or identified turnout row,
even tucked inside a ballot collection or an activity response. Hiding it on the
page isn't enough if it's still in the data sent to her browser. The public demo
names and roles are fine; it's other people's participation that stays private.

I'd expect the server to know who's signed in from a session it issued, rather
than trusting an account ID or role sent by the browser. Each successful sign-in
needs its own distinct, unpredictable session credential. Guessing from public
account details, altering a credential or making up an unsigned identity claim
mustn't let someone in. Normal sign-out ends that session, and people also need
an option to end all their Common Ground sessions. Once ended, a session can't
keep reading or changing protected records.

We do leave tabs open, so changes need to use the revision the person actually
saw. A new draft starts at revision 1, and each accepted draft edit, Open, Close
or Publish adds exactly one to that ballot's revision. A vote doesn't add to it.
The seeded ballots already have revisions, which should stay as supplied.
Membership records start at revision 1 too, with each accepted update adding
exactly one to the applicable membership revision. A refusal or an exact retry
doesn't advance either kind of revision.

An old tab mustn't overwrite newer work. If Ruth pauses Owen and then activates
him again, an older request to pause him still needs to be refused, even though
his status has returned to what that tab remembers. She should get a useful
message asking her to refresh, with no new audit event; a fresh update can then
go ahead. The resulting roster will determine the next opening snapshot, while
ballots that are already open keep theirs.

For draft edits, just saying "refresh" would lose the work Ruth has typed. Could
she review her changes against the latest saved draft instead? Keep the version
she opened and her attempted edit, then show those alongside the latest version
when she chooses to review. Treat the title and context as separate fields. Keep
the voting method, approval limit and ordered choice list together as one voting
definition; mixing halves of two definitions could change the decision itself.

If she changed the title while another tab changed the context, combine both in
the preview. If both copies changed the same field differently, ask which version
to keep for that field, without choosing for her. Matching changes don't need a
decision. Nothing should save merely because she opened the review or selected
an option. She should explicitly save the reviewed draft as a new action against
the latest revision she reviewed. Keep the old refused action's receipt intact.

Another edit might land while that preview is open. Refuse an out-of-date save
again, keep her reviewed working copy, and let her review the newer version. If
someone has already opened the ballot, explain that its definition is locked and
stop the review from saving. She also needs a way to discard her unsaved changes
without sending a write or changing the saved draft. This review is for a refused
draft edit; an uncertain action still belongs in Pending actions until resolved.

One detail here matters: a revision or Approval maximum is a single positive
whole number. A list, object, boolean, null or missing value can't stand in for
one. I don't mind numbers arriving as ordinary HTML-form text, but please don't
turn structured or boolean request values into valid numbers through coercion.
Likewise, a missing membership status, or an object or array where active/paused
was expected, shouldn't quietly activate or pause somebody. Refusing those
updates leaves the member's status, revision and history alone, so the next
ballot still opens against the unchanged roster. More generally, unknown targets,
stale or malformed requests, cross-ballot choices and actions outside someone's
role should leave the ballot, revision, turnout, results and history untouched.

The other awkward case is a lost response. People press Save again because
they don't know whether the first press worked. Each create, edit, membership
change, lifecycle action and vote needs an operation identifier tied to the
person doing it. When the same operation comes back, I'd like the original
response status and body returned, without doing the work or adding its audit
event again. That needs to keep working after a restart and after later changes.
For example, asking about an old Open mustn't reopen a Closed ballot or collect
a new set of eligible members.

Reusing an identifier for different input should be refused, leaving the
original receipt intact. The identifiers belong to the person across all their
actions: Ruth can't reuse a Create identifier for an Edit or a membership change,
and neither record should change if she tries. Another person's identifiers are
independent, though, so Ruth using one doesn't reserve it for Leila. With Approval
votes, the same distinct choices in a different order are still the same vote
and should get the original receipt, even after publication and restart. Changing
a choice is different input. Repeating a choice twice is invalid, not a way to
spell that same set.

We also need to remember a valid request's refusal when the person was allowed
to make it but the revision was old or the ballot was in the wrong stage. If
Ruth tried Publish too early, retrying that same operation after Close should
still return its original refusal status and body. She can choose to make a new
operation with current information instead. There's no need to retain malformed
requests, bad sign-ins or unauthorized requests as receipts. Refusals and retries
shouldn't add audit events. For successful draft creation, edits, Open, Close,
Publish and membership changes, the audit should record the action, record,
actor and time once. Anonymous vote-receipt activity is okay, but never a member's
name or selected choices.

On the browser side, could we have a Pending actions area? Ruth sometimes loses
the connection just after pressing Save, then reloads or signs out before coming
back. She needs a way to find out what happened without accidentally doing it
twice. I'd want this for creating and editing drafts, opening, closing,
publishing and changing membership. Keep the attempt before sending it, including
what action it was and which record it concerned. If no usable confirmation
arrives, say the outcome is unknown and keep that reminder through a reload and
a later sign-in in the same browser profile. Don't resend it automatically on
startup, refresh or sign-in. This area is for staff work, not members' private
selections.

An unreadable response or a server failure doesn't tell Ruth whether the write
was refused, so those attempts stay uncertain too. On the other hand, if Save
was confirmed and only the following refresh failed, the save is still confirmed.
I'd like a message about the refresh problem without turning it into a pending
write.

An explicit Retry should ask about that exact original attempt: same target,
action, inputs, operation identifier and viewed revision. Another tab may have
changed the record in the meantime; Retry mustn't silently become a new edit
against that newer revision. Once a usable success or definite business refusal
comes back, clear that reminder, explain the outcome and refresh the current
records. An old receipt shouldn't replace newer data on screen. After a refusal,
trying a changed action is a separate choice with current information and a new
identifier.

There could be several uncertain actions at once. Ruth should be able to tell
them apart, keep doing independent work, and retry or dismiss one without sending
the whole queue or losing the others. Dismiss just removes the reminder; it
doesn't undo a change the server may already have accepted. Please make that
clear where she uses it.

Those reminders belong to the person who made them. Signing out should hide
their details. If Arun, Leila or Owen signs in on that browser, they shouldn't
see Ruth's pending work or send her requests. When Ruth returns, her unresolved
work should be there again. The same goes for an expired or revoked session:
keep the uncertainty for her to resolve after signing back in, without replaying
it as whoever happens to sign in next.

One more shared-computer problem: a Retry response might arrive after Ruth has
signed out and somebody else has signed in. Whether it's a success or an expired
session response, it mustn't put Ruth's recovery details or feedback on the other
person's screen, change their session, or send Ruth's action again. A confirmed
outcome can settle Ruth's own reminder silently; otherwise leave it for her next
sign-in. The new person should be able to carry on with their own workspace.

We also keep two tabs open for the same account in the same browser profile.
They should share the pending work. Once one tab resolves or dismisses an entry,
the other should
reflect that on its next interaction or reload. A stale tab or late response
mustn't bring a removed reminder back or overwrite a different pending attempt.
While a request is in flight, its action should be disabled so a double click
can't create two attempts, and the same pending attempt can't run concurrently
from both tabs.

If the tab checking a pending action closes before its reply arrives, the other
tab mustn't be left saying "busy" forever. After refreshing the surviving tab,
Ruth should be able to retry that same saved attempt herself; don't resend it
just because a tab disappeared.
I don't have a preferred storage library or layout for this.
Accepted business records and receipts still belong in SQLite.

I'd like it to feel calm and finished, with the ballot's stage easy to spot and
eligibility and turnout easy to scan without exposing live choice totals. Members
need a clear privacy explanation before making their final submission. If an
action doesn't apply, make that clear or disable it; the server still has to
enforce the rule. A useful validation or refusal message should stay until the
person dismisses it or completes another action, rather than vanishing before
they've read it.

People will use this on phones and with keyboards too. Around 390 by 844, all
six workspaces should remain reachable without sideways page scrolling. I want
a light/dark switch, readable type and contrast, and consistent spacing,
alignment and visual hierarchy through the ballot list, turnout, results, roster
and forms in both themes and screen sizes. Please give keyboard users a visible
focus indicator and make the controls comfortable to tap. Proper page landmarks,
headings and labels connected to their controls will help people using assistive
tools. Statuses for ballots, membership and participation need words, not just
a colored dot. If someone has asked for reduced motion,
respect that preference.

A few hosting details from our side: we'd like this built with Node.js 22, Express
and better-sqlite3, which are already installed. We'll keep the finished app under
`/app` and start one process
with `node /app/server.js` from there. It needs to listen on `0.0.0.0`, port 3000,
serve the browser UI there and answer `GET /api/health` successfully. Sessions,
ballots, votes, participation, membership, operation receipts and audit activity
all need to live in SQLite so accepted work survives a restart. The usual file
is `/app/commonground.db`; use `DB_PATH` if we've provided it.

Please bring the starter into `/app` and include the supplied seed as
`/app/common_ground_seed.json`. At startup, read from `SEED_PATH` if we've provided
it; otherwise use that embedded copy. Only `/app` will be retained, so the running
app can't depend on `/assets` or this
request still being around. Public networking is available both while building
and when running; external fonts, scripts, styles and API resources are fine.

For now I'm only after the local demo with these accounts. We don't need
registration, email delivery, public result links, imports, exports or real-world
election certification. Before handing it over, please try it as each person,
take a new decision from draft through publication, and check that saved work
survives signing back in and restarting the server.
