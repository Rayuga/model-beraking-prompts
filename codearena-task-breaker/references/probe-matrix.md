# Adversarial probe matrix

Apply these axes to every mutating endpoint and to every read/isolation claim.
Each probe has two required parts: the honest interaction first, then the
forged replay that proves the server, not the page, enforces the rule.

| Axis | Probe | Must happen |
| --- | --- | --- |
| Identity | Unknown or invented identity value | Refused; never falls back to a default identity |
| Role | Wrong-role actor performs the action | Refused at the endpoint, not merely hidden |
| Ownership | Valid actor targets another tenant's record | Refused; no record data returned |
| Value integrity | Client supplies price/amount/status/owner/merchant | Server recomputes from its own records |
| Decoys | Real identifier plus contradictory fields | Server follows the stored record, not the payload |
| Decoys only | Only decoy fields, no real identifier | Refused; no fallback to name/default/last-viewed |
| Existence | Invented id in the same format | Refused; never reports success |
| Format | Malformed, out-of-range, empty values | Refused on its own merits; no coercion, no crash |
| Omission | Required fields absent | Refused; no defaulting |
| Ordering | Step N attempted before step N-1 | Refused at the endpoint |
| Idempotency | Same operation replayed 2-3 times | Exactly one effect, one activity entry |
| Replay | Fabricated or expired reference | Refused; creates nothing |
| Terminality | Move a final state backwards or sideways | Refused; record re-reads unchanged |
| Uniqueness | Second write against a one-per-key record | Refused; original not overwritten |
| Precondition | Reserve/quote treated as commit | Nothing persists before the commit event |

## Forging rules

1. Record the exact request shape the page itself sends (method, path, body,
   and the session credential the page used, cookie or header).
2. Replay in-page from the app's own origin, changing only what the probe
   requires. Never use curl or shell commands.
3. A refusal passes only when the response performs no write, exposes no
   protected data, the record re-reads unchanged, and no new activity entry
   exists. A 4xx, an HTML error page, or a redirect to a refusal all count;
   a response that applies the change does not.
4. Re-read after every refused write: same values, same rows, same counts.
5. Establish the owner's data first, then verify other identities cannot reach
   it. Grade read isolation on the response body, not rendered hiding.
6. After a terminal or ordered workflow, also prove the legitimate path still
   works: negative checks require a positive control using a dedicated record
   the earlier probes did not consume.

## Stateful chain recipe

- Start with a seed state the brief makes derivable.
- Establish state A through the UI.
- Perform interaction B; verify the consequence on A (for example an approval
  becoming invalid, a hold blocking dispatch, a qualification expiring, a
  reservation disappearing).
- Replay B or the invalidating write; confirm refusal and unchanged re-read.
- Finish with a positive control proving the valid path still exists.
- Name only records allocated to this criterion. Never let one chain consume
  another chain's positive control.
