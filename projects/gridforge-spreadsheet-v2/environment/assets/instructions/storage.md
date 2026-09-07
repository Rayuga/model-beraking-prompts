# Persistence and revisions

Save workbook changes automatically and make the current save state clear. A
manual Save action can still be available when someone wants to save now.

Keep saved workbook data in SQLite and create revisions only when something has
actually changed. Opening the workbook again should show the latest saved cells
and formulas, without presenting unfinished work as saved.

Provide a revision history with timestamps so people can preview or restore an
earlier version. A restored version should begin as a draft, remain undoable,
and preserve the existing history. Include automatically saved versions in the
same history.

Autosave a completed edit within five seconds. Restoring an old version must
leave time to inspect or undo that draft before it is saved.

Use a JSON save request with an integer baseRevision, workbookId, and workbook
payload containing id, title, and sheets. Sheets have id, name, and cells, an
address-keyed object of raw string values. Reject missing or invalid structure,
unknown or conflicting identities, non-integer revisions, and non-string cell
values. A cell save cannot rename a workbook or sheet. Invalid requests return
a 4xx response and leave stored content and revisions unchanged.
