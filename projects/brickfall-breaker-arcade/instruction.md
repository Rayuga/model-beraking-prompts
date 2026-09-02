# Brickfall

can you build a proper brick-breaker arcade game that feels great in
the first few seconds but still holds up across a full run? i need predictable
physics, meaningful levels and power-ups, not a canvas demo with random bounces.

please give the demo players real sign-in too. Their unlocked levels, active
run, best score and leaderboard results should live on the server and come back
after a reload or later sign-in.

The complete game contract is in six files under `/instructions`. Seeded player
profiles, ten level layouts and starting leaderboard records are in
`/assets/artifacts/brickfall_seed.xlsx`.

Put the application in `/app`. Use vanilla HTML, CSS and JavaScript with canvas,
Node.js with Express, and SQLite. Issue bearer tokens and store active tokens in
SQLite. Start with `node /app/server.js`, listen on port `3000`, and serve
`/app/public/index.html`. Keep durable data in `/app/brickfall.db`, and require
no runtime installs or public-internet assets.
