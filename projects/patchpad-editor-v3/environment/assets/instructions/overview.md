# Overview

I want to build PatchPad, a browser editor for long incident reports. It should
feel like an editor rather than a form wrapped around a large text field.

Start with the report in `/assets/incident_seed.json`. Keep the supplied content
and metadata intact, create it only once, and do not duplicate it when the app
starts again.
The supplied report starts at saved revision 1; each changed save adds one.

Provide a server-backed list of available reports, including each report's id,
title and author, so we can see which reports are stored. It can be included
in the initial server-rendered page or loaded through the app's normal
same-origin requests; no
particular route name or document-list sidebar is required. A fresh workspace
should list only the supplied report, and restarting the app must not add
another copy or lose its saved content and revision history.

Put the finished app in `/app`. Use one Node.js application listening on
`0.0.0.0:${PORT:-3000}`, with SQLite as the source of truth. Start it with
`npm start` and open the editor at `/`. It must not depend on hosted databases
or editor services.

Express 5.1.0 is available under `/usr/local/lib/node_modules`. You can use
the network and install dependencies during development. Include the Node.js
dependencies needed by `npm start` with the delivered app, so server startup
requires no package-install step. Public network access is also available at
runtime: browser resources such as scripts, styles, fonts and images may load
from public URLs, including CDNs. Other browser network requests are permitted;
an off-origin request is not itself a defect. The report, saves and revision
history must still be served by the local Node.js application backed by SQLite.

Build the editing area yourself with DOM, canvas, or SVG. Do not use a textarea,
contenteditable, Monaco, CodeMirror, ProseMirror, TipTap, Quill, Slate, Draft.js,
or another ready-made editor for the document surface.

Leave an `APP_MANIFEST.md` beside `/app/package.json` with the start command,
SQLite path and the main application routes and request methods used for
opening reports, saving and browsing revision history. A route may serve more
than one purpose; separate data-reading endpoints are not required.
Write the database location on one line as
`SQLite path: /app/your-file.db`, using your actual absolute path under `/app`.
The path may be enclosed in backticks; the filename can have any extension or none.
A fresh database must recreate the seed;
normal restarts must keep existing saved data.
