# Overview

PatchPad is a browser-based editor for long incident reports. The core product
is a custom editing surface with predictable editor behavior, saved revisions,
and conflict-safe persistence.

Seed the app from `/assets/incident_seed.json` on first startup. The seed file
contains one document, a title, and enough structured text to exercise a long
editor. Preserve its generation metadata and trailing sections exactly.
Starting from an empty SQLite database must create the seeded document and its
first revision. Starting again must not duplicate the document or revision.

Use one Node.js web app listening on `0.0.0.0:${PORT:-3000}` with SQLite as the
system of record. Do not use an external database or hosted editor service.
`package.json` must expose a working `npm start` command. Put `APP_MANIFEST.md`
beside it with a fenced `bash start` block, the database path, and the main API
routes.

Build the document editor from scratch. Do not use `<textarea>`, `<input>` as
the editing surface, `contenteditable`, Monaco, CodeMirror, ProseMirror, TipTap,
Quill, Slate, Draft.js, or another editor widget or library for the editable
area. Normal DOM, canvas, or SVG are allowed, but the app must own the document
model, cursor, selection, keyboard handling, clipboard handling, undo/redo, and
save behavior. Small form controls outside the editor, such as search fields,
are allowed.
