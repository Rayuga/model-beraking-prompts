Keep the pipeline and its activity trail in SQLite so accepted work survives a
reload or restart. Record who made each candidate, stage, panel, score and note
change and when it happened. Notes and recorded activity are append-only.

Make vacancy updates revision-aware. If somebody saves against an older view,
refuse it and return the current state so they can review and retry. A retried
request should take effect once, while reusing its retry identity for different
input must be rejected. Failed, stale or malformed writes must not alter any
candidate, funnel, revision or activity record.

The server owns candidate identifiers, stage history, funnel figures,
attribution and revisions; ordinary browser input cannot supply or replace them.
Reject extra write fields claiming these server-owned values, even when their
values happen to match the current record. Normal target identifiers and an
expected revision used for concurrency are not ownership claims.

Validate write metadata without coercing JSON types. An expected revision sent
in JSON must be a nonnegative integer number, not a numeric string, Boolean,
array or object. A revision carried in an HTTP header is necessarily text;
accept its valid integer representation and reject missing or malformed values.
Scores sent in JSON must be integer numbers from 1 through 5, never values
converted from strings, Booleans, arrays or objects. Reject each invalid write
without changing any product state, even temporarily between later requests.

Retry lifetime and identity
---------------------------
Operation identities belong to the authenticated person, across that person's
sessions and across server restarts. Distinct people may independently use the
same identity. Authenticate before looking up any saved result; a revoked token
cannot replay one. Persist both successes and business rejections for requests
with valid metadata addressing existing records. Exact retries return the saved
status and JSON result even after another action changes the vacancy. JSON object
key order is immaterial; method, path, values and array order are significant.
Reusing an identity for different input returns a distinct 409 mismatch.

Store a successful result atomically with its product writes. A business
rejection may store its receipt but must leave all product state untouched.
After restarting, signing in again as the original person must recover the same
saved success or rejection. A replay is a historical acknowledgement: the UI
must refresh the current vacancy rather than treating an old receipt snapshot
as current. Assessment history and capacity are part of persisted product state.
The server also owns assessment versions and capacity; reject client fields
that attempt to supply them.
