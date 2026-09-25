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
unpredictable session, not an account id supplied by the browser. Refuse
unknown, stale, malformed, cross-ballot, or out-of-role writes and leave the
ballot, revision, turnout, results, and history unchanged.

Roster changes need the revision the Coordinator actually viewed, just like
ballot edits. If two tabs are open, an older membership update must not undo a
newer one, even when the member's active status has changed and then changed
back. Refuse it with useful refresh guidance and no new audit event. A fresh
update can succeed. The accepted roster determines who joins the next ballot's
opening snapshot; it must not rewrite eligibility on an already-open ballot.

Validate membership updates before changing the roster. A missing status or
an object or array in place of the requested active/paused value is malformed;
do not silently convert it into an activation or pause. Refusal must preserve
the member's status, its applicable revision, and audit history. It must also
leave the next ballot's eligibility snapshot based on the unchanged roster.

Sign-out ends the current session. Also give each person a way to end all of
their Common Ground sessions. A session that has been ended must not continue
to read or change protected records.

Record successful draft, edit, open, close, publish, and membership actions in
the audit with the action, record, actor, and time. Voting may add anonymous
receipt activity, but never the Member name or selected choices.
