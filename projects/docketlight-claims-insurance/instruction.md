# Docketlight claims desk

Hi. I run the claims desk at Northstar Mutual and I need a dependable web desk our intake team, adjusters, supervisors, and finance people can use all day: sign in and move claims through their lifecycle, with every decision saved by the server rather than living in the browser.

I've put what matters to me in six notes (overview, behaviour, security, ui, integration, and policy) under /assets/instructions/; please read them together before you start. The sample data file at /assets/artifacts/docketlight_seed_data.json is our book of record; use it as-is instead of inventing your own book. Every sample account in that book signs in with the same shared password: password123.

Please build the finished application under /app with node /app/server.js starting it on port 3000 and serving the browser page at /app/public/index.html. Deliver your own copy of the sample data at /app/seed_data.json, a small /app/Dockerfile, and a short /app/APP_MANIFEST.md with the start command. Honour DB_PATH and SEED_PATH when the run environment supplies them; otherwise keep the database and seed copy beside the server.

Only the preinstalled Node, Express, and SQLite libraries are available: please do not install or fetch anything, and keep the whole application self-contained under /app. Saved claim and session state must survive the app being stopped and started again. Hand over the sample data file, never a database: keep SQLite database files and their sidecars out of the delivered folder, because each fresh start creates an empty database and seeds it from the /app/seed_data.json copy you ship.
