# Coursemark

can you build a proper assessment workspace for our ecology course? instructors need
to prepare and publish assessments, students need timed attempts with their own
accommodations, and our teaching assistant needs a safe grading queue. Scores and
feedback must stay private until release. This must be a durable working product.

Please finish and test the complete request in this run rather than handing
back a scaffold or asking me whether to continue.
please make sign-in real as well. A reload or later sign-in should restore the
same work. Two tabs must not silently overwrite one another, retried actions
must not duplicate records, and signing out should revoke every session for
that account.

The full contract is under `/instructions`; initial records are in
`/assets/artifacts/coursemark_seed.json`. Put the app in `/app` using vanilla HTML,
CSS and JavaScript, Node.js with Express, and SQLite. Store server-issued bearer
tokens in SQLite. Start with `node /app/server.js` on port `3000`, serve
`/app/public/index.html`, persist to `/app/coursemark.db`, and use no runtime installs
or public-internet assets.
