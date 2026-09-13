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
