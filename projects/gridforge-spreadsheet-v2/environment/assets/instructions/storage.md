# Saving and recovering work

People shouldn't have to remember to save every small change. Autosave a
completed edit within five seconds, show whether it has reached the server,
and offer Save for someone who wants to save now. Opening the workbook again
should bring back the latest saved cells and formulas.

Keep the workbook in SQLite and add a revision only when its content changes.
Let people browse timestamped revisions, including autosaves, and preview an
earlier version before deciding to restore it. Restoring should put that
version into an undoable draft and preserve the history. Give the person time
to inspect or undo that draft before autosaving it.

We need each save to carry the target workbook identity, a complete workbook
snapshot, and the integer revision it was based on. Keep the snapshot in the
supplied seed's layout: a workbook identity and title, sheets with identities
and names, and cells keyed by address. Store each cell's raw entry as text,
including numbers and formulas, so reopening it preserves what was entered.

A cell edit shouldn't rename the workbook or its sheets. If a save arrives
with missing data, malformed workbook or cell data, unknown or mismatched
identities, or an invalid revision, refuse it with a 4xx response and leave
the stored content and history alone. Revision values must be integers; raw
cell values must be strings. The same checks belong on the server so a broken
or outdated browser can't damage someone else's work.
