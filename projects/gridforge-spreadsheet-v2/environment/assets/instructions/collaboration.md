# Working together

Let people choose one of the seeded users so the team can tell who changed
what. A toolbar selector or a simple entry screen is fine. When someone selects
a cell, they should be able to inspect its history, including the previous
value, new value, person, and time.

Each open view is a separate editing session, even when the same person opens
two views. Saves and attribution belong to the user chosen in that view.
The server should refuse invalid, expired, or contradictory session details.

Show who's here and where they're working, with a small legend and a separate
color for each view's current cell or range. Selection outlines should leave
the contents readable and editable. If two views select the same cell, keep
both colors recognizable. As people move, change users, or close a view,
remove the old presence indicators.

Colleagues' saved changes should appear without a reload. Keep presence and
saved changes current within five seconds on a local connection. Someone's
unsaved draft must survive incoming changes: combine edits to different cells,
and show a conflict if both people changed the same cell.

Use the saved revision each view was working from when resolving concurrent
saves. Keep unrelated work from both views, but reject an overlapping stale
save instead of replacing the first person's saved value. Malformed saves or
requests that contradict the workbook's identity should be refused by the
server without altering the workbook or its revision history.
