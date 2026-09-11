# Making it real

The browser and the server have to be one product. Reads, sign-in, and every
write are real requests to the server; records, permissions, calculations,
and history must not be simulated in the page or kept only in browser storage.

Sign-in gives the browser an HttpOnly session cookie JavaScript cannot read,
backed by durable server storage. Reloading, reopening the browser, or
stopping and starting the server keeps the session until it ends or is
revoked; sign-out and suspension invalidate it server-side. Nothing sensitive
is a browser-visible token.

Store the SQLite database beside the server, honouring DB_PATH and SEED_PATH
when the run environment supplies them, and seed once so a restart never
duplicates records. The running app must not depend on its starting directory
or on anything outside the delivered folder.
