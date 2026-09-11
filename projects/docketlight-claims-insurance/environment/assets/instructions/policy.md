# Delivery ground rules

One Node server, reachable locally, is the whole product. Keep everything it
needs inside the delivered folder: only the preinstalled Node, Express, and
SQLite libraries may be used, with no package installs, fetched assets, or
services outside the handover.

SQLite is the source of truth for both claim data and sessions. Seed from the
copy of the sample data you deliver, or the location the run environment
points you to, without duplicating records on a restart.
