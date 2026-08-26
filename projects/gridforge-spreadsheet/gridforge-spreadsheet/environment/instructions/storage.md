# Persistence and revisions

GridForge should autosave workbook changes after the user pauses editing. Users
should not need to press Save for ordinary edits. The UI should show whether
changes are dirty, saving, saved, or failed to save. A visible Save control can
still be provided as a manual "save now" action.

Saving changed workbook content writes to SQLite and creates a new revision.
Saving unchanged content must not create a duplicate revision. Reloading the
page must show the last saved workbook, including raw formulas and evaluated
values. Edits that have not finished saving should not be presented as saved.

Show a revision history with revision number and timestamp. Users must be able
to preview and restore a prior revision without corrupting the saved history.
Restoring a revision should load it as an unsaved draft and behave as one
undoable action, so Undo returns to the workbook state from before the restore.
Autosaved changes should appear in revision history just like manual saves.
