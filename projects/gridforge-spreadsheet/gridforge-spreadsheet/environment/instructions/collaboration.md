# Collaboration and edit history

GridForge has a small seeded-user login so edits can be attributed to people.
Users should be able to sign in as one of the seeded users, edit the workbook,
and see who last changed a selected cell.

Track edit history at the cell level. When a cell value changes, record the
previous value, the new value, the signed-in user, and the time of the change.
Users should be able to inspect the history for a selected cell.

## Editing sessions

Treat every open workbook view as a distinct server-recognized editing session
bound to the seeded user selected in that view. Attribute saves to that session's
user. Reject saves with a missing or unknown session, or when a request claims a
different user from the one bound to the session.

## Live collaboration

Make the workbook feel shared while people have it open. Presence and current
selections should stay in sync across open views without a reload. Show who is
there and how many views each person has open; opening the workbook twice should
still create two independent editing sessions for that person.

Use a familiar spreadsheet-style presence treatment for remote selections.
Outline another person's current cell or range in their color while leaving the
cell interior and its contents clear and editable. A compact legend near the top
should connect each color with the person's name and current address. If one
person has multiple views open, give those selections different colors instead
of inventing names or numbers for their browser tabs.

Presence should follow what is actually active. Moving a selection, switching
the selected user, or closing a view should retire the old visual cue rather
than leaving stale names or outlines behind. When several people land on the
same cell, keep each of their colors recognizable.

A clean view should display a newly saved remote change automatically. If a
view has an unsaved edit in a different cell, merge the remote change while
preserving the local draft. If both views changed the same cell, preserve the
local draft and show a visible conflict instead of silently replacing either
value.

When two users edit different cells from the same saved workbook version, both
changes should be kept. When two users edit the same cell from the same saved
workbook version, the later save should be rejected with a visible conflict
message instead of overwriting the earlier user's edit.

## Conflict safety

Every workbook save must include the revision number that the browser started
editing from. The server should compare what changed since that version. If a
newer save changed different cells, keep both users' changes. If a newer save
changed the same cell, reject the later save with a visible conflict message and
do not overwrite the earlier user's cell value.

The server must enforce these rules. Do not rely only on a disabled Save
button, client-side checks, hidden fields, or browser storage. A request with an
unknown workbook id, a mismatched workbook id, or an invalid base revision must
be rejected without changing the stored workbook.

Treat the save API as a trust boundary. Reject missing, malformed, or
structurally inconsistent workbook data and invalid revision values without
partially changing the workbook or creating a revision.

Cell-save requests must not rename the workbook or change sheet identity
metadata. Reject payloads that change the workbook title or a sheet's id or
name without modifying stored data or creating a revision.
