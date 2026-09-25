# Product overview

Coursemark is the assessment workspace for BIO-214, Ecology and Field Methods.
It has Courses, Assessments, Attempts, Gradebook, and Audit workspaces. Keep the
product focused on assessment authoring, timed student work, rubric grading,
feedback release, and the records that connect those actions.

Run one non-watch server on `0.0.0.0:3000`. Put the app in `/app`, start it with
`node /app/server.js`, serve `/app/public/index.html`, and persist data to
`/app/coursemark.db`. Provide public `GET /api/health` on the same origin: HTTP 200 with a nonempty
JSON health object, without sign-in or protected course records.

Use vanilla HTML, CSS and JavaScript in the browser, Node.js with Express on the
server, and SQLite as the source of truth. The installed Express and
better-sqlite3 packages are available without a runtime install. Development
networking and dependency installation are allowed. Public scripts, styles,
fonts and images are permitted; authentication and course storage must remain
in the local Node.js/SQLite application, not a hosted service.

Normal server restarts must retain all saved work, session revocation, audit,
course revision and operation receipts without reseeding. Honor DB_PATH when
supplied by the runner; otherwise use /app/coursemark.db. The runner may launch
a writable copy of the app as an unprivileged user.

Leave APP_MANIFEST.md beside server.js. Include a fenced bash start block,
the line `SQLite path: /app/coursemark.db`, and the actual methods and paths
used for authentication, course/assessment/attempt reads, authoring, starts,
answer saves, submission, grading, release and audit. Shared routes are fine.
