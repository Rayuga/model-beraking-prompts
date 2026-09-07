# Overview

I want to build PatchPad, a browser editor for long incident reports. It should
feel like an editor rather than a form wrapped around a large text field.

Start with the report in `/assets/incident_seed.json`. Keep the supplied content
and metadata intact, create it only once, and do not duplicate it when the app
starts again.

Use one Node.js application listening on `0.0.0.0:${PORT:-3000}`, with SQLite as
the source of truth. The application should run with `npm start` and must not
depend on hosted databases or editor services.

Express 5.2.1 is already available under `/opt/patchpad-deps`; copy or use
those supplied modules instead of running a package install.

Build the editing area yourself with DOM, canvas, or SVG. Do not use a textarea,
contenteditable, Monaco, CodeMirror, ProseMirror, TipTap, Quill, Slate, Draft.js,
or another ready-made editor for the document surface.

Keep an `APP_MANIFEST.md` beside `package.json` with the start command, SQLite
path, and main API routes.

Keep package.json and APP_MANIFEST.md in /app. Include one line in the manifest
labelled `SQLite path:` followed by the absolute database file path under /app,
optionally enclosed in backticks. The filename can have any extension or none.
A fresh database must recreate the seed;
normal restarts must keep existing saved data. Serve runtime resources locally.
