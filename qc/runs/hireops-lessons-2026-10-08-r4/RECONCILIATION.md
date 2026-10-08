# HireOps, Colderwater-lessons round 4 reconciliation

**BLOCKED, and preflight false.** All 54 reports are valid, on input `2efc8dcc…`.

Results by row:
- Quality rows: Fail on 4, 13, 26, 28, 31, 32, 33, 34, 35, 37, 40, 48 and 49. Note on 42. Not exercised on 11. The rest Pass.
- Deterministic: 48 Pass. Two of them are flagged as risks because the functional judge header differs from the template.

**Why preflight is false.** The only failed check is `judge header:functional`. The functional `[judge]` table now differs from the template, because the lead instructed `mode = "individual"` (relayed by the user on 8 October 2026). The QC tooling has no override, and it was not changed to silence the check. This deviation stays visible until the template or the lead's guidance changes.

**Process notes:**
- Rows 8, 21, 28, 35 and 51 were cut off by proxy errors before writing a report. Each was relaunched in a fresh context.
- Mid-round I fixed the golden's badge race in `threads.js`, then saw that this changed the frozen bytes. I reverted it at once, confirmed the bytes matched the manifest hash, and applied the fix only after the round.
- The row-21 reviewer noted that its scratch simulation reused a session-scratchpad folder named `sim`. No workspace file was touched.

## Fixed in the next candidate

**Lena's seeded count** (rows 13, 31, 37, 48, 49; one defect, five reports):
- `hro_readonly_roles` could send a message in Lena's conversation, which breaks the seeded "Lena's count is 1" in `hro_unread_seen`.
- Now only `hro_unread_seen` may sign in as Lena or touch her conversation.
- The read-only check sends its message on a card it creates itself.

**Bundles too coarse** (row 40):
- Binary bundles of up to 7/61 made a near-correct app score like a blank one.
- `hro_moves` was split into moves and reject/reopen.
- `hro_undo_activity` was split into undo and activity.
- `hro_messaging` was split into messaging and drafts.
- Functional now has 15 criteria. The total weight is still 61.0, with each criterion carrying the sum of its legs' former weights.
- The per-session timeout is now 600 s: 15 × 600 + 900 + 900 = 10800, under `test.sh`'s scored budget of 11100.

**Undecidable or wrongly anchored legs** (row 32, P1):
- `hro_manager_roles` now sets up three cards in Interview, so two cards share a late stage when Ingrid re-orders.
- Undo replays now use the identifier of the move under test. A refusal caused only by a stale identifier does not count.
- A forbidden target that neither the UI nor any observed request can express now passes when the card is unchanged and the allowed action is the control. The judge never adds fields that the observed requests do not carry.

**Restart coverage** (rows 26, 35):
- Before the restart, the intake/restart criterion now moves a card, re-orders one and rejects one with a reason.
- After the restart it compares order per stage and the rejection and its reason.

**Leave-out rule could skip graded legs** (row 33): the setup exception now applies only to setup for legs the Bar does not itself grade.

**Seen-mark confirmation** (row 34):
- A seen mark is visible only inside the conversation, so a negative seen mark is now confirmed in a fresh context of the sender, who opens the conversation there.
- Counts are still confirmed without opening the conversation.

**Draft and focus ownership** (row 28): the polish live-thread row owns draft and focus at the newest message; Functional's `hro_long_thread` owns them while scrolled up.

**Unsaved notes stated publicly** (row 4): the notes now say, in the requester's voice, that an unsaved note is the writer's own and no one else on that browser sees it. The golden already behaves this way (`keep` keys include the user id).

**Leftover drafts** (row 42): the functional prompt tells the judge to record and clear any text it did not type in that session.

**Golden** (row 18 residual): `threads.js` `update()` now treats a message arriving in the open conversation at its newest message as read before repainting. The row badge and the nav total therefore never show a transient +1 while `catchUp`'s GET is in flight.

## Not acted on

- **Row 3 (P3):** one long line in `hireops_rules.md`.
- **Row 50:** the duplicate seed is a known false positive.
- **Row 8:** the optional suggestion to name HireOps in the description.
- **Rows 11, 40 and 42 (measurement):** no configured judge run, reward-discrimination run or ranking run exists. They need the user's authorised run, and are not waived.

## Evidence after the changes

- The golden, installed with `solve.sh` into an empty `/app`, launched as uid 65534 from another working directory and given a real restart, passes all 26 driver groups.
- The grader-term and criterion-id checks pass, and the 10-word overlap scan finds nothing.
- Functional sessions are about 12 KB of prompt and app context, plus one criterion of at most 2.4 KB.
- None of this is a judge, Oracle or model measurement.

These changes invalidate this round's clearance. A fresh full round on the new bytes follows.
