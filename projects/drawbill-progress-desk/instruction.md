# Task: DrawBill

build me a progress-billing desk for Northline Construction. they file pay
applications against a living schedule of values, an architect stamps an
exact net, owners release certified papers, and the plant's card desk
collects.

the app opens already signed in as Avery Lin. a visible switcher moves
between the seeded people. there is no login and no password.

the brief is under `/instructions/` — read every file. seed JSON is in
`/assets/artifacts`; copy it into `/app` and load that copy on first boot.
`/assets/CREDENTIALS.md` is SQLite, the card desk, and the plant desks. artifact
money is whole dollars; the books keep pennies. `/assets` is only there
while you build.

put the app in `/app` with `APP_MANIFEST.md` (`bash install` / `bash start`).
listen on port 3000. copy `/assets/npm-pin/` into `/app` and `npm ci
--omit=dev --offline --cache /opt/npm-offline`. that cache is the only
place packages come from when this is scored.
