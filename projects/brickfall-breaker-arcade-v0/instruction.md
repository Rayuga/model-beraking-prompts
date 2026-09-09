# Brickfall

can you build a proper brick-breaker arcade game that feels great in the first
few seconds but still holds up across a full run? i need predictable physics,
meaningful levels and power-ups, not a canvas demo with random bounces.

please give the demo players real sign-in too. Their unlocked levels, active
run, best score and leaderboard results should return after reload or sign-in.
Two tabs must not silently overwrite each other, and retrying an action must not
duplicate it. Add a signed-in mechanics lab so collision, power-up and life
rules can be checked in the real engine without affecting scores or saves.

The full contract is in eight files under `/instructions`. Seeded profiles,
levels and records are in `/assets/artifacts/brickfall_seed.xlsx` and
`/assets/artifacts/brickfall_scenarios.json`.

Put the app in `/app` using vanilla HTML/CSS/JavaScript with canvas, Node.js,
Express and SQLite. Store server-issued bearer tokens in SQLite. Start it with
`node /app/server.js` on port `3000`, serve `/app/public/index.html`, persist to
`/app/brickfall.db`, and require no runtime installs or public-internet assets.
