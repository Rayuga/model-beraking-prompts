# Recruiting workspace, round 9 reconciliation

**BLOCKED.** 54 of 54 valid reports on input `c5cd697a…`. Quality rows: Fail on 26, 28 and 32; Note on 34 and 50; Not exercised on 11, 40 and 42; the rest Pass. Deterministic: 39 Pass, 9 Note, 0 Fail. Failures by round: 11, 9, 9, 5, 4, 5, 4, 2, 3.

Fixed in the next candidate:

- Row 28: the board catch-up leg added to hro_stale_refused in round 8 was also graded by hro_live_board. It has been removed from hro_stale_refused, and hro_live_board owns it alone.
- Row 26: nothing checked that a sent reply stays cleared. Protocol T now reloads after the Enter send, and hro_msg_compose fails if the sent text reappears in the box.
- Row 32 (P2): hro_arrive_bottom, hro_bulk_move and hro_undo_restores were read only on the mover's page, which shows moves optimistically. Protocols M and B now read the resulting order again as Mei Lin in an independent context, and the three criteria fail if that read differs.
- Row 34 (P3 note, accepted): the seen steps on Tomas's page in protocol U and hro_seen now state the same 15-second wait without reload that Rafael's leg has.
- Deterministic note (accepted): hro_bulk_move was reworded to remove a 10-word run copied from the public rules. A local 10-word overlap scan of every test prompt and judge file against the public files now finds none.

Not acted on: row 31's P3 notes (Noor's second application is not named for the judge, and the distance of Y's move in B(12) is not specified) affect no grade. The row 50 note is the known duplicate seed_data.json false positive.

The scripted golden driver (25 groups) passes with no page errors. It now also reloads after a send and asserts that the box is empty. The public grader-term and criterion-id checks pass. Rows 11, 40 and 42 remain open because no configured judge run exists. That is not evidence of a portal pass, an Oracle score or any model score.
