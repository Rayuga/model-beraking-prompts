# Revisions, retries and run records

Keep one monotonic integer run revision per account and show it with the current
sync state. Every start, save, clear, progress and finish mutation carries the
visible expected revision plus a fresh unpredictable operation id.

Commit a matching revision only once in a SQLite transaction. Replaying the
same id and payload returns its original HTTP status and body without another
change; reusing that id for a different payload is rejected. Store receipts for
successful requests and known 4xx failures. A stale revision returns `409` with
the current revision and authoritative saved state, without changing either.

Suppress pending double activation in the UI. On a stale response, reconcile to
the server state, freeze active play and explain which revision won. This must
work across two independently signed-in tabs and survive reload.

Store the latest ten terminal runs per account with run id, outcome, level,
score, time and exact terminal snapshot. Show newest first and let a player
inspect a record. A retried finish creates neither a second personal record nor
a second global leaderboard row.
