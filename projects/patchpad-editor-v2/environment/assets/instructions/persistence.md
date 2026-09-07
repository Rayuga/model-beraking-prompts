# Persistence

Provide find and replace for the open report, including moving through matches,
replacing one match, and replacing all matches.

Show whether the report is saved or has unsaved changes. Saving changed content
should create one new SQLite revision; saving unchanged content should not.
Reloading should return to the latest saved content and discard anything that
was never saved.

Show revision numbers and timestamps in a revision history. People should be
able to preview an older revision and restore it safely without damaging the
saved history. Previewing must not change the saved report. Restoring an older
revision should open it as an unsaved editor action so it can be undone before
it is saved.
