# How we run things here

The project lives in /app. The API answers on port 4000 and the web interface on
5173, and both need to be listening once it is up.

Storage is SQLite — one file on disk, nothing that disappears when the process
restarts. Put it wherever `SQLITE_PATH` says when that is set, and pick your own
sensible default under the project when it is not; our deployments set it so the
data lands on the right volume.

The process does not run as root in our environments, and the project directory
may be read-only, so create whatever you need to write under a path you know you
own rather than assuming you can write anywhere.

There is a health check on the API at /health. It answers with JSON carrying
`ok` (true when the service is up) and `db` (true when storage is ready) — our
deployment scripts read exactly those two names — and it answers before any
database work can hold up startup. A health check that waits for a migration is
not a health check.

start.sh brings both halves up. Everything the app needs is already installed in
the container under /opt/boardloom — take the packages from there rather than
fetching anything, because whatever you install yourself is left behind when we
deploy and will not be there when this runs.

Our deploy carries your source across and nothing else. Whatever was installed
and whatever was built are left behind, and the packages are put back from
/opt/boardloom on the other side. So start.sh has to bring the app up from source
on its own: if the interface needs building before it can be served, build it
there in start.sh rather than counting on something you built earlier. Lay the
project out however you like — start.sh is the only thing we run.

Once it is running it serves its own fonts, styles and scripts from its own
origin — nothing fetched from an outside host. We have been bitten by a CDN
outage taking a review down.

