# HireOps, Colderwater-lessons round 3 reconciliation

**BLOCKED.** 54 of 54 valid reports on input `d622da81…`. Quality rows: Fail on 26, 28, 31, 32, 42; Note on 33, 38, 49, 50; Not exercised on 11, 40; the rest Pass. Deterministic: 48 Pass, applied by hand because the private checker executables are not in the workspace.

Reviewers for rows 1, 9, 17, 18 and 34 were cut off by proxy errors, and row 6 by a dropped connection. None had written a report, so each was relaunched in a fresh context.

## Fixed in the next candidate

**Row 31 (P1).** The polish live-board check required the exact scroll offset to survive Mei's move. If her move shortened the board, the browser clamps the scroll, so a correct app could fail.
- Now the judge moves one card to Screen first and scrolls partway. Mei moves that Screen card to Interview, which leaves the board's height unchanged.
- The scroll offset may differ by up to 2 px.

**Row 28 (lesson-16 pattern).** The polish live rows scored 0 when an update took longer than 15 seconds, but Functional already grades that speed.
- The polish rows now wait up to 60 seconds and leave speed to Functional.
- Cascades from a feature graded elsewhere are judged against the state the app actually produced. Candidate wording is read on the linked card only when it exists.
- The refusal rows now have one clear bar.

**Row 26.** Two public asks had no check:
- that the draft and cursor are kept while the user is scrolled up, now a leg of the long-conversation criterion;
- that undo is blocked after a colleague reopens the card, now a leg of the undo criterion. The golden driver now asserts it.

**Row 32.** Whether a reason is present after a reopen is read from the card's current state, never from Activity, whose old rejection line keeps the reason by design. Tomas's status is read after reloading or re-opening his list.

**Row 42 / row 38 note.** If no job can be opened, every board check now falls back to the seeded Product Designer job, so one failure no longer zeroes most of Functional.

**Row 27 notes.** The notes now say, in the requester's voice, that rejecting or reopening a card counts as a move for undo. A refusal message shown right after the attempt counts as the reason.

## Functional judge switched to individual mode (user / lead instruction, 8 October 2026)

The user relayed the lead's instruction to change the functional `judge.toml` from `mode = "batched"` to `mode = "individual"`.

Reading RewardKit 0.1.7 in the verifier image (`judges.py`, `_arun_agent_individual`) shows how individual mode behaves:
- Each criterion gets its own agent session, run one after another.
- Each session sees only its own criterion.
- `[judge].timeout` applies to each session separately.
- A session is rerun, up to 3 times, only when its answer does not match the schema; a timeout scores that criterion 0.

The user chose to merge Functional as far as QC allows. Row 28 explicitly permits bundling several legs inside one criterion.
- The 44 criteria became 12. Each one carries its own steps, on its own suffixed jobs and cards, with one pass bar.
- Each merged criterion keeps the sum of its legs' former weights, so the total is still 61.0 and weights are not steered.
- The shared prompt now says one criterion is graded per session and that earlier sessions have changed the shared workspace.
- Every leg of the former 44 criteria, and every fix above, is carried into the new 12.

**Timeouts.** The binding limit is `tests/test.sh`, a shared harness file that is not changed, which runs the whole scored suite under `timeout 11100`. Functional plus polish (900) plus visual (900) must fit in it.
- The functional per-session timeout is now 700 s: 12 × 700 = 8400. With 1800 for polish and visual, the total is 10200, under 11100.
- `task.toml` `[verifier].timeout_sec` stays 13200, which already exceeds the 1500 for gates plus the 11100 for scored. Raising it, which the user permitted up to five hours, would not change anything without a change to `test.sh`, so it is left as is.
- No judge duration has been measured; row 11 stays open.

## Not acted on

- **Row 49:** `/assets` is described as unavailable at runtime, but the template harness keeps it. This is template-controlled and harmless.
- **Row 50:** the duplicate seed is a known false positive.
- **Rows 11, 40 and 42 (measurement part):** no configured judge run, reward-discrimination run or reward-ranking run exists. These need the user's authorised run.

## Evidence after the changes

- The golden was installed with `solve.sh` into an empty `/app` and launched as uid 65534 from another working directory, with a real restart. It passes all 26 driver groups, including the new legs: undo blocked by a colleague's reopen, and reopen refused in both directions.
- The grader-term and criterion-id checks pass, and a 10-word overlap scan finds nothing.
- Each functional session's prompt is about 13 KB (shared prompt plus app context of 10.6 KB, plus one criterion of at most 2.6 KB). Polish is 13.4 KB and visual 7.4 KB.
- None of this is a judge, Oracle or model measurement.

These changes invalidate this round's clearance. A fresh full round on the new bytes follows.
