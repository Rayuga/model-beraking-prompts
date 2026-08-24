# Task: PatchPad Editor

Build **PatchPad**, a browser-based editor for long incident reports. It is not
a CRUD dashboard. The core deliverable is a custom editing surface with
predictable editor behavior, saved revisions, and conflict-safe persistence.

## Data

Seed the app from `/assets/incident_seed.json` on first startup. The seed file
contains one document, a title, and enough structured text to exercise a long
editor. Preserve its generation metadata and trailing sections exactly.
Starting from an empty SQLite database must create the seeded document and its
first revision. Starting again must not duplicate the document or revision.

## Required stack

- One Node.js web app listening on `0.0.0.0:${PORT:-3000}`.
- SQLite as the system of record.
- No external database or hosted editor service.
- `package.json` must expose a working `npm start` command.
- Put `APP_MANIFEST.md` beside `package.json` with a fenced `bash start` block,
  the database path, and the main API routes.

## Custom editor surface

The document editor must be built from scratch. Do **not** use `<textarea>`,
`<input>` as the editing surface, `contenteditable`, Monaco, CodeMirror,
ProseMirror, TipTap, Quill, Slate, Draft.js, or another editor widget/library
for the editable area.

Use normal DOM, canvas, or SVG if you like, but the app must own the document
model, cursor, selection, keyboard handling, clipboard handling, undo/redo, and
save behavior itself. Small form controls outside the editor, such as search
fields, are allowed.

## Editor behavior

The editor opens the seeded document and shows line numbers, the current cursor
position, saved revision, and whether the document is saved or dirty.

Users must be able to:

- Click or keyboard-focus the editor and type text.
- Insert characters and new lines.
- Use Backspace and Delete.
- Use ArrowLeft, ArrowRight, ArrowUp, and ArrowDown for normal editor cursor
  navigation.
- Use Home and End on the current logical line.
- Support standard mouse and keyboard selection, including word, line, range,
  and full-document selection, and replace selected text by typing or pasting.
- Copy selected text, cut selected text, and paste clipboard text copied from
  either inside PatchPad or another application/browser tab. Cutting text must
  be one undoable edit.
- Continue mouse or keyboard selection beyond the visible editor; the editor
  should scroll to keep extending the selection through the document.
- Use Ctrl/Cmd+Z and Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z for undo and redo.
- Paste multi-character text as one undoable edit.
- Create multiple carets with Alt+Click or Ctrl/Cmd+Click. Typing, Backspace,
  and Delete should apply across all active carets. One undo reverses the whole
  multi-caret edit.

Provide Undo and Redo as visible controls and through keyboard shortcuts.

## Find and replace

Provide find and replace controls for the current document. Users should be able
to find matches, cycle through matches, replace the current match, and replace
all matches.

## Persistence and revisions

Saving changed document content writes to SQLite and creates a new revision.
Saving unchanged content must not create a duplicate revision.
Reloading the page must show the last saved content. Unsaved edits should be
marked dirty and must not become saved merely because the page reloads.
Show a revision history with at least the latest few saved revisions, including
revision number and timestamp. Users must be able to preview and restore a prior
revision without corrupting the saved history.

## Conflict safety

Every document save must include the revision number that the browser started
editing from. If another tab or request has already saved a newer revision, the
older tab must be refused with a visible conflict message and must not overwrite
the newer content.

The server must enforce this rule. Do not rely only on a disabled Save button,
client-side checks, hidden fields, or browser storage. A request with a stale
base revision, an unknown document id, or a mismatched document id must be
rejected without changing the stored document.

## Interface expectations

Use labels and controls that are discoverable by intent. Nothing should require
a hidden route, magic element id, or external instructions to use. The app
should include:

- A document list or document header showing the seeded document.
- A custom editor area.
- Save, undo, redo, find next, replace current, replace all, and revision
  history controls.
- Visible errors for rejected saves and invalid actions.

The product is judged by behavior, not visual polish, but the editor should be
usable in a normal browser.
