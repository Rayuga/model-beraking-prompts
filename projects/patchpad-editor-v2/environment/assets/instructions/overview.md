# Overview

I want to build PatchPad, a browser editor for long incident reports. It should
feel like an editor rather than a form wrapped around a large text field.

Start with the report in `/assets/incident_seed.json`. Keep the supplied content
and metadata intact, create it only once, and do not duplicate it when the app
starts again.
The supplied report starts at saved revision 1; each changed save adds one.

Use one Node.js application listening on `0.0.0.0:${PORT:-3000}`, with SQLite as
the source of truth. The application should run with `npm start` and must not
depend on hosted databases or editor services.

Express 5.2.1 is already available under `/opt/patchpad-deps`; copy or use
those supplied modules so starting the delivered app needs no package install.

Build the editing area yourself with DOM, canvas, or SVG. Do not use a textarea,
contenteditable, Monaco, CodeMirror, ProseMirror, TipTap, Quill, Slate, Draft.js,
or another ready-made editor for the document surface.

Keep an `APP_MANIFEST.md` beside `package.json` with the start command, SQLite
path, and main API routes.

Keep package.json and APP_MANIFEST.md in /app. State one absolute SQLite
file path under /app in the manifest. A fresh database must recreate the seed;
normal restarts must keep existing saved data. Serve runtime resources locally.
