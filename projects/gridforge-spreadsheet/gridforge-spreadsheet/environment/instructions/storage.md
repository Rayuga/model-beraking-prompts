# Storage and revisions

SQLite is the record of truth for the workbook, raw formulas, edit attribution
and revisions. Browser storage may hold temporary interface preferences but is
not the workbook database.

## Saving

- Autosave after the user pauses editing; ordinary work should not depend on
  pressing Save.
- Show dirty, saving, saved and failed states honestly.
- A visible Save control may offer “save now”.
- Saving changed workbook content creates one revision.
- Saving unchanged content does not create a duplicate revision.
- Do not call an edit saved before the server has committed it.
- Reloading shows the last committed cells and raw formulas.

## Revision history

- Show revision number and timestamp.
- Previewing an old revision does not change live content, dirty state or saved
  history.
- Restoring an old revision loads it as an unsaved draft rather than immediately
  creating another revision.
- Treat the complete restore as one undoable action so one Undo returns the
  workbook to its pre-restore state.
- Autosaved and manually saved changes appear in the same history.

## Startup

Starting with an empty database creates the seed once. Restarting against that
same database preserves committed changes and leaves the logical SQLite content
unchanged unless a real user action changed it.
