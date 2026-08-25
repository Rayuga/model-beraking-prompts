# Collaboration and save safety

GridForge has a small seeded-user selector so changes can be attributed to a
person. No password flow is required. The signed-in person should always be
clear in the interface.

## Editing sessions and attribution

- Every open workbook view is a distinct server-recognized editing session.
- Bind that session to the seeded user selected in that view.
- Attribute saved cell changes to the session's user, not merely to a user id
  claimed by the request body.
- Reject a save when its editing session is missing or unknown, or when a
  claimed user does not own that session.
- How the session is transported is up to the implementation. It may use a
  cookie, header, request field or another normal mechanism; no particular
  JavaScript global or field name is required.

For every changed cell, keep the previous value, new value, signed-in user and
server time. People should be able to inspect this history for the selected
cell and see who last changed it.

## Live views

- Presence and selections update across open views without reload.
- Show who is present and how many views each person has open.
- Two views belonging to the same person remain two independent sessions.
- Draw another view's selection as a colored boundary without covering or
  replacing cell contents.
- Keep a compact legend near the top connecting each color to the person's name
  and selected address.
- Give two views from the same person different colors without inventing tab
  names or numbers.
- Moving a selection, changing the selected user or closing a view retires the
  old presence and selection promptly.

## Concurrent changes

- A clean view receives a newly saved remote change automatically.
- A view with an unsaved change in another cell keeps its draft and merges the
  remote cell.
- If both views changed the same cell, keep the local draft visible as a
  conflict and reject the losing save rather than overwriting either value.
- Different-cell changes based on the same saved revision should both survive.

## Save API trust boundary

Every save carries the revision from which editing began. Enforce all save
rules on the server rather than relying on disabled controls, hidden fields,
browser storage or client validation.

Reject a request without writing anything or creating a revision when it has:

- an unknown workbook id or disagreement between URL and payload workbook ids
- a missing, malformed, negative, fractional, string or unknown future base
  revision
- a missing or malformed workbook, sheets or cells structure
- an invalid cell address or a non-string cell value
- a changed workbook title, sheet id or sheet name in an ordinary cell save
- a missing or unknown editing session, or a user/session mismatch

A rejected request must not partially change content, attribution, workbook or
sheet identity, the current revision, or revision history. Treat unexpected
server errors as failures rather than silently normalizing bad data.
