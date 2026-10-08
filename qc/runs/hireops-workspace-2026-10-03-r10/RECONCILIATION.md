# Recruiting workspace, round 10 reconciliation

**BLOCKED.** 54 of 54 valid reports on input `622c7c3d…`. Quality rows: Fail on 26 and 33; Note on 31 and 32; Not exercised on 11, 40 and 42; the rest Pass. Deterministic: 40 Pass, 8 Note, 0 Fail. Rows 28 and 32, which failed in round 9, now pass or note. Failures by round: 11, 9, 9, 5, 4, 5, 4, 2, 3, 2.

Fixed in the next candidate:

- Row 33 (P2): hro_pol_live_board let the judge either add cards until the board scrolls or skip the scroll leg, so a defective app's score depended on the judge's choice. The judge must now add cards through ordinary controls until the page or board scrolls. It may skip the leg only if neither scrolls with twelve cards in one stage, which is an observed fact about the app.
- Row 26 (P2): the public rules state 403 for role refusals and 409 for out-of-date moves, but only 401 was graded. A new functional row, hro_refusal_status (weight 1), grades the statuses of the refusals the protocol already replays: Observer 403, Ingrid and Observer sends 403, candidate 403 (or 404 for an application that is not theirs), and the stale move 409. The other rows still grade only "refused, nothing changed", so no defect is deducted twice. Functional is now 44 criteria with total weight 59.5. The reward weights between dimensions are unchanged. Not acted on from row 26: the on-screen naming of a UI-initiated stale move. This was refuted in rounds 2 and 8 because the grader cannot reliably force a stale page.
- Row 31 note (accepted): the Observer and candidate replays now include a reject. The anonymous replays now include a card-detail or notes read and a conversation read.
- Row 32 note (accepted): Ingrid's isolation from Tomas's J2 conversation is now also checked by replaying Rafael's read of it in her session, not only by its absence from her list.
- Row 35 P3 (accepted): protocol D and hro_restart now include per-person unread counts.

The scripted golden driver (25 groups) passes with no page errors. It now also asserts the reject replay statuses (Observer 403, candidate 404) and that unread counts are unchanged after a real restart. It already asserted the other 403, 404, 409 and 401 statuses. The public grader-term and criterion-id checks pass. Rows 11, 40 and 42 remain open because no configured judge run exists. That is not evidence of a portal pass, an Oracle score or any model score.
