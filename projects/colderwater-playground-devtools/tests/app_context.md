## Application

Name: Colderwater playground
URL: http://localhost:3000

Colderwater is a local JavaScript and HTML code playground: a custom code editor, a preview, a console and a shared library of saved snippets with revision history. The filename ending (.js or .html) chooses how Run executes the source.

## Accounts

None. The app has no sign-in; every browser tab or context uses the same shared library.

## Key screens

One workspace at /. It shows title and filename fields, the code editor with its Undo, Redo, Format, Find and Replace controls and a line and column readout, Run, Stop, New and Save controls, the preview, the console, the saved library and the revision history of the open snippet.

## Notes for grading

- The editor is the app's own surface, not a form field. Enter text with real key presses, or by pasting with the usual shortcut. Read the current source from the rendered editor lines and check it equals your fixture before acting on it.
- A selection can be confirmed by copying it with the usual shortcut and pasting it into an ordinary field such as Find, or by reading the highlighted text.
- Use fresh scratch drafts for editor checks. The app may ask for confirmation before discarding an unsaved draft; accepting that dialog is normal.
- Saved records are identified by the server, not by title, and the library may already hold records from earlier checks. Do not assume an empty library and do not delete records that earlier checks created.
- Health address: http://localhost:3000/api/health. It is the only address outside the workspace page that criteria refer to.
- Where a criterion needs two tabs, any two pages of the app are acceptable. Tabs share browser storage, so where a criterion says to clear browser storage first, run a script on the app page that clears localStorage, sessionStorage, IndexedDB databases and cookies for this origin, then reload; this is the one permitted use of script to change browser state.
- After the restart tool has been used, open fresh pages instead of reusing pages opened before the restart.
- If the editor draws its text on a canvas, read colours and text from screenshots instead of computed styles.
- The preview may be restored as a static picture after a failed run.
- Network access to public assets by the app itself is allowed and is not a failure.
