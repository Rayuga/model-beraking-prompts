# Product overview

Coursemark is the assessment workspace for BIO-214, Ecology and Field Methods.
It has Courses, Assessments, Attempts, Gradebook, and Audit workspaces. Keep the
product focused on assessment authoring, timed student work, rubric grading,
feedback release, and the records that connect those actions.

Run one non-watch server on `0.0.0.0:3000`. Put the app in `/app`, start it with
`node /app/server.js`, serve `/app/public/index.html`, and persist data to
`/app/coursemark.db`. Provide `GET /api/health` on the same origin.

Use vanilla HTML, CSS and JavaScript in the browser, Node.js with Express on the
server, and SQLite as the source of truth. The installed Express and
better-sqlite3 packages are available without a runtime install. Do not depend
on external scripts, styles, fonts, images, APIs, or other public-network
assets.
