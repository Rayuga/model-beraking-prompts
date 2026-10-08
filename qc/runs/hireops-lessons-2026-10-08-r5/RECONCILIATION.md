# HireOps, Colderwater-lessons round 5 reconciliation

**BLOCKED, and preflight false.** All 54 reports are valid, on input `a79edbb8…`.

Results:
- Quality rows:
  - Fail on 11, 18, 26, 28, 32, 33, 44 and 49.
  - Note on 42, 43 and 50.
  - Not exercised on 40.
  - The rest Pass.
- Deterministic: 47 Pass and 1 Note (the duplicate seed). Its two risk flags are the unmeasured 300 s headroom and the weight comment.
- Preflight is false only on `judge header:functional`. This is the lead-instructed individual mode, recorded in round 4; the QC tooling was not changed.
- Rows 6, 13, 14, 16, 27, 33 and 50 were cut off by proxy errors before writing anything. Each was relaunched in a fresh context.

## Fixed in the next candidate

**Weight comment** (rows 44 and 49, plus the deterministic flag). The cause was in the generator. When the functional section was replaced in round 4, `write_judge` lost its `note=W_FUN` argument, so the functional `judge.toml` kept the generic "1.0/1.5/2.0" comment beside weights of 2 to 5.5. The fix:
- The generator now writes the functional comment. It explains that each criterion's weight is the sum of its legs' 1.0/1.5/2.0 weights, lists every criterion's legs, and records the timeout rationale.
- The header cleanup now strips a multi-line comment, so regenerating twice leaves exactly one comment.

**Timeout rationale lived only in QC notes** (row 11, P1). It is now recorded in the task, in the functional `judge.toml` comment:
- the lead's instruction and its date;
- the per-session timeout semantics;
- the arithmetic: 15 × 600 + 900 + 900 = 10800, under the scored budget of 11100 in `test.sh`.

The measurement is still missing.

**Golden marked a message seen too early** (row 18). The candidate's conversation stayed open when they went to "My applications", so Rafael's next message was marked seen on arrival. Step 4 of `hro_unread_seen` now closes the conversation:
- with the app's own close or back control;
- if there is none, by reloading the page, since a conversation opens only when the candidate chooses it;
- then confirming that none is open.

The golden starts candidate pages with no conversation open.

**Public rules with no matching leg** (row 26). Three rules in the brief had nothing checking them. Each now has one:
- Sending counts as reading. `hro_long_thread` now has Rafael send a reply while scrolled up after Noor's next message, and his unread count must be 0.
- A hiring manager's multi-card move follows the role rules as a set. In `hro_manager_roles`, Ingrid's Offer card plus Screen card moved to Interview is refused with neither card moved. Rafael's identical move is the control, and Interview has 4 places so only the role can cause the refusal.
- Interview places apply to reopening. In `hro_reject_reopen`, reopening a card rejected from Interview while Interview is full is refused, and succeeds once a place is free. The golden driver asserts the same.

**Double grading and broken triggers** (row 28):
- "Sent text does not come back after reload" is now graded only in `hro_messaging`.
- In `hro_undo`, a leg whose trigger fails is left out. The triggers are Mei's re-order, rejection or reopening, and those actions are graded in their own criteria.

**Refusal checked only through the UI** (row 32). Bill's move and note must now be refused by the server, through the UI or by replay; a missing control alone no longer passes. This was the only such instance. Ingrid's read and the Observer's send were already replayed.

**Waivers that contradicted the shared rule** (row 33):
- The shared rule now allows a Bar to state which legs exist only when an action succeeded.
- `hro_activity` expects lines only for actions that succeeded.
- `hro_readonly_roles` has a refusal leg only for request kinds whose staff control succeeded.

**Near-stub credit through Activity** (row 43). `hro_activity` is now 0 if no stage move succeeded in that session.

## Not acted on

- **Row 7 and row 39:** near-stub floor risks. These are notes and need a measured stub run.
- **Rows 40 and 42:** the measured discrimination and ranking runs are absent. Row 42 also raises a scored-suite timeout risk. Both need the user's authorised run.
- **Row 50:** the duplicate seed is a known false positive.

## Evidence after the changes

- The golden, installed with `solve.sh` and run as uid 65534 with a real restart, passes all 26 driver groups. These include the new check that a reopen into a full Interview is refused and succeeds once a place frees.
- The grader-term and criterion-id checks pass, and the 10-word overlap scan finds nothing.
- The largest functional criterion is 2.5 KB.
- None of this is a judge, Oracle or model measurement.

These changes invalidate this round's clearance. A fresh full round on the new bytes follows.
