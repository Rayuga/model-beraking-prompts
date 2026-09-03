# Private ballots for members

Can you put together a private-ballot app for a membership group? Voting, turnout, results, and audit activity all need durable server-backed records rather than browser-only state.

Begin with no ballots and one group containing both Member accounts below. A Coordinator should be able to draft a ballot, add choices, open it against a fixed eligibility snapshot, close it, and publish the result. Members get one final vote and should later see only that they participated. The Observer can review setup, turnout, published results, and administrative activity but cannot change anything.

Please keep identified participation separate from anonymous votes. Nothing in the interface, responses, results, or audit should connect a member to a choice, and choice totals stay hidden until publication. Lifecycle and role restrictions must hold on the server.

Run the app from `/app` with Node.js, Express, and SQLite. Use `node /app/server.js`, port `3000`, `/app/public/index.html`, `GET /api/health`, and `/app/commonground.db`. Do not require external browser assets or runtime installs.

Demo password: `CommonGround!2026`

- Coordinator — `ruth.adebayo@commonground.example`
- Observer — `arun.das@commonground.example`
- Member — `leila.ward@commonground.example`
- Member — `owen.park@commonground.example`

Show the current identity and role after sign-in.
