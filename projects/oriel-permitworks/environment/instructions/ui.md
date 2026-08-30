# Audit and trust boundaries

Sensitive writes create append-only audit entries that visibly identify the
actor, action, affected entity, timestamp, and relevant permit revision.
Administrators can review this evidence from the browser.

Never trust browser-supplied role, district, owner, parcel zone, eligibility,
fee, levy, total, state, revision, waiver authority, inspection outcome, or
certificate prerequisites. Enforce authorization and lifecycle rules on the
server for every object, including guessed identifiers. Do not expose a hidden
back door or implement workflow changes as UI-only labels.

The browser must show enough persisted evidence to verify each successful
action after a refresh or reopen. Errors should be understandable without
requiring exact prescribed copy. The final product must remain usable after the
server process restarts without clearing its SQLite data.
