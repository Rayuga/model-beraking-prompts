# Conflict safety

Base saves on the revision the browser started editing. If another tab has
already saved a newer version, refuse the stale save and keep that newer content
on the server. Keep the rejected tab's unsaved draft in its editor and show a
useful conflict message. Only discard that draft when the user chooses to reload
or discard it; do not silently replace it with the server's content.

Enforce save safety on the server. Reject stale, malformed, unknown, or
contradictory document requests without changing the document or its revision
history.

Save requests carry an integer baseRevision and text content. If a documentId
is included, it must match the document being saved. Missing content, non-text
content, or a non-integer revision is invalid. Return HTTP 409 for a stale save
and a non-success response for other invalid requests.
