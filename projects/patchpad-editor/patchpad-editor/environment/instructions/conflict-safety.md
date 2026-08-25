# Conflict safety

Every document save must include the revision number that the browser started
editing from. If another tab or request has already saved a newer revision, the
older tab must be refused with a visible conflict message and must not overwrite
the newer content.

The server must enforce this rule. Do not rely only on a disabled Save button,
client-side checks, hidden fields, or browser storage. A request with a stale
base revision, an unknown document id, or a mismatched document id must be
rejected without changing the stored document. Malformed saves, including
missing or invalid revision and content fields, must also be rejected without
changing content or revision history.
