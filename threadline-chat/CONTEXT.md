# Threadline Authoring Context

This file is author-only context and must not be included in the upload zip.

## Feature dependency map

```text
Gate 1: deterministic seed + authenticated session
  -> Gate 2: channel membership and object authorization
     -> Gate 3: ordered messages and threads
        -> unread state, mentions, reactions, pins, search
        -> live delivery, presence, typing, reconnect
        -> webhook delivery and idempotency
        -> append-only audit and restart durability
```

## Planned verifier metadata

Every browser criterion will include `feature`, `sub_feature`, and
`depends_on`. Criteria will be self-contained and will create or recapture the
state they inspect. Server trust-boundary criteria will replay raw requests and
confirm rejected requests make no durable change.

## Model-breaking targets

- session identity forgery and private-channel object authorization
- server ordering, optimistic reconciliation, retries, and idempotency
- thread parent metadata after reply edit/delete
- per-user unread and mention correction after message mutation
- duplicate reaction suppression and pin cleanup
- multiple-view presence, typing expiry, and reconnect deduplication
- stale message versions and permissions revoked after request capture
- webhook secret, channel binding, and duplicate event enforcement
- append-only audit history and SQLite restart persistence
