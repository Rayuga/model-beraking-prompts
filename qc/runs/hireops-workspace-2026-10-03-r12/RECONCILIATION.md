# Recruiting workspace, round 12 reconciliation

**BLOCKED.** 54 of 54 valid reports on input `2996e34d…`. Quality rows: Fail on 28 and 33; Note on 50; Not exercised on 11, 40 and 42; the rest Pass. Deterministic: 40 Pass, 8 Note, 0 Fail. Rows 26 and 31, which failed in round 11, pass. Failures by round: 11, 9, 9, 5, 4, 5, 4, 2, 3, 2, 3, 2.

Fixed in the next candidate (rubric wording only; the golden and its driver are unchanged):

- Row 28 (P2): hro_refusal_status, added in round 10, also failed when a replay was wrongly accepted. That deducted the acceptance a second time, on top of the row that owns it. The row now counts only replays that were actually refused. An accepted replay is deducted only in its own row (hro_observer_readonly, hro_candidate_no_staff, hro_thread_access or hro_stale_refused). If none was refused, the row is 0.
- Row 33 (P2): hro_candidate_private banned activity and board places in one clause, then allowed board and Activity replays "answered with only that candidate's own data" in another. That gave the judge two targets. Such a replay must now be refused, or answered with only what the candidate's own view shows: their applications with job, team and status wording, and their own conversations. It must contain none of the banned data. In hro_activity, "notes and messages are not recorded in Activity" now reads "need not appear", so an app that also logs notes is not failed for it.

The scripted golden driver (25 groups) passes with no page errors. The golden answers a candidate's board and Activity reads with their own applications only. The public grader-term and criterion-id checks pass. A 10-word overlap scan of the test files against the public files finds nothing. Rows 11, 40 and 42 remain open because no configured judge run exists. That is not evidence of a portal pass, an Oracle score or any model score.
