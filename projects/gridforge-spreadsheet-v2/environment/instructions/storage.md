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
