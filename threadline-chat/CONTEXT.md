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

The browser rubric currently has 22 binary, feature-scoped criteria with a
total weight of 30.5. The machine-readable mapping is in
`tests/rubric/browser/feature-map.json`; matching metadata is repeated beside
each criterion in `browser.toml` so a run report can be grouped by feature and
sub-feature.

## Authoring rules carried forward

- Require the exact named interaction path. A visible edit, reaction, pin,
  member-management, copy-link, mouse, or keyboard action cannot be replaced by
  a direct API write merely because it reaches similar final state.
- Use direct same-origin request replay for trust boundaries, stale writes,
  idempotency, and forged identity. Re-read durable state after every rejected
  request; status or toast text alone is not proof.
- Every negative test has a positive control in the same criterion.
- Keep criteria self-contained and restore shared membership state after a
  destructive check.
- Assert exact marker content and state transitions, but do not require a
  golden-specific DOM shape, route name, initial version number, deletion
  presentation, or exact 2xx status when the product instruction allows
  alternatives.
- A criterion is conjunctive: if any named sub-check fails, the criterion
  fails. Dependency metadata identifies the upstream gate when a downstream
  feature cannot be exercised.

## Current validation status

- Golden API smoke passes identity forgery, private access, cross-target
  idempotency rejection, stale edit/audit, mention reconciliation, reaction
  uniqueness, pin cleanup, thread integrity, membership revocation, webhook
  replay, and logout revocation.
- Golden live-browser smoke passes cross-session message/thread delivery,
  typing cleanup, and exact reply deep links.
- Golden mobile smoke passes the 390x844 channel, message, thread, and return
  workflow without horizontal document overflow.
- The verifier independently hard-gates clean-seed restart idempotence before
  browser grading and exact committed SQLite durability after browser grading.
- Oracle and model runs have not yet been performed for Threadline. The next
  gate is an Oracle score of 1.0, followed by the single configured model run.

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
