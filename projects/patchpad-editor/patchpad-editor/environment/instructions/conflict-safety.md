# Conflict safety

Base saves on the revision the browser started editing. If another tab has
already saved a newer version, refuse the stale save, keep the newer content,
and show a useful conflict message.

Enforce save safety on the server. Reject stale, malformed, unknown, or
contradictory document requests without changing the document or its revision
history.
