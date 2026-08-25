# Persistence

Provide find and replace controls for the current document. Users can find
matches, cycle through matches, replace the current match, and replace all
matches.

Saving changed document content writes to SQLite and creates a new revision.
Saving unchanged content must not create a duplicate revision. Reloading the
page must show the last saved content. Unsaved edits are marked dirty and must
not become saved merely because the page reloads.

Show revision history with at least the latest few saved revisions, including
revision number and timestamp. Users can preview and restore a prior revision
without corrupting the saved history. Restoring a revision loads it as an
unsaved draft rather than saving immediately, and one undo returns to the draft
that was present before the restore.
