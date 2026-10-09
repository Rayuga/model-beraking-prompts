# QC round r9 reconciliation (candidate v3.4, commit 891fe5a9, input e328e9df…)

54/54 valid independent reports (53 quality rows + deterministic). Reconciled before any edit.
Frozen cache checked clean (no `__pycache__`/`.pyc`) after the round.

| Result | Rows |
|---|---|
| Pass | 50 quality rows; deterministic 48/48 |
| Fail | 30 (P3), 42 (P2) |
| Not exercised | 40 (owner-accepted runtime gap, no provider spend) |

Pipeline status BLOCKED: the two Fails plus the accepted runtime gaps (rows 11, 22, 40, 42 lack a
hash-bound measured judge run; preflight "judge header:functional" is the known individual-mode deviation).

## Fails (both judged credible, not refuted)

- **Row 30, negative_checks_have_positive_controls (P3).** Polish `escape_closes` credits "Escape saves
  nothing" without showing a normal edit save or reply send works, so a dead save/reply path earns it.
  Suggested fix: after the Escape steps, save "Saved edit JUDGE-K3" (reads so with edited mark after reload)
  and send "Sent reply JUDGE-K3" (appears); fail if either control does not work.
- **Row 42, reward_ranking_is_monotone (P2).** Functional `persistence` (weight 4.0) fails if any step c
  control fails before restart, and those controls (hold on a reply, M-12 timer, Sian wall, earlier versions,
  search) are graded elsewhere. A durable app with a broken timer (36/44) scores below an in-memory app that
  is otherwise golden (40/44). Suggested fix: keep a small core of required controls (post, reply, edit,
  delete, one search); grade hold/timer/wall/version/unread items only if they worked before the restart,
  failing only when a working item differs afterwards.

## Notes worth carrying (non-blocking)

- Row 31: hold release only tested with Sian on others' messages (author self-release not probed).
- Row 32: live_updates scroll reference should be noted right before Harriet's changes.
- Row 34: thread no-sideways-scroll at 390 px graded only via visual likert.
- Row 37: a schema-retry rerun of timer_changes / hold_scope_and_release would find seed items consumed.
- Row 26: only an https link is probed for linkification.

## Stop rule

Owner rule (9 Oct): zero Fail, Notes OK, at most 3 rounds from r7. r9 is the last round and has 2 Fails,
so the loop stops here. No task files changed after r9. Owner decides: package v3.4 as is, or approve a
v3.5 fix round (rows 30 and 42) with a further QC round.
