# Collaboration and edit history

GridForge has a small seeded-user login so edits can be attributed to people.
Users should be able to sign in as one of the seeded users, edit the workbook,
and see who last changed a selected cell.

Track each cell change with its previous and new values, user, and time.

## Editing sessions

Treat every open workbook view as its own editing session and tie it to the
seeded user selected in that view. Saves and attribution must belong to that
same view and user. Invalid, expired, or contradictory session details should
be refused by the server.

## Live collaboration

Support live collaboration across open workbook views. Show who is present,
keep each view distinct, and display their current selections with clear
spreadsheet-style colors and a small legend. Presence should stay current as
people move, switch users, or leave.

Keep saved edits synchronized across open views without a reload and persisted
with the workbook.
Preserve local drafts, combine changes to different cells, and show a conflict
when people change the same cell.

## Conflict safety

Make saves revision-aware and merge unrelated concurrent edits while rejecting
conflicts. The server must reject conflicting stale, malformed, or identity-changing save
requests without changing the workbook or revision history.

Show a separate color and current cell or range for each open view, including
two views owned by the same person. Remote selection outlines must leave cell
contents clear, including when people select the same cell. Keep presence and
saved changes current within five seconds on a local connection.
