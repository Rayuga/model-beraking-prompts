# Recruiting workspace, round 11 reconciliation

**BLOCKED.** 54 of 54 valid reports on input `4bd1eea4…`. Quality rows: Fail on 26 (P3), 28 and 31; Note on 50; Not exercised on 11 and 40; the rest Pass. Row 42 now reads Pass, with risk flagged. Deterministic: 41 Pass, 7 Note, 0 Fail. Row 33, which failed in round 10, passes. Failures by round: 11, 9, 9, 5, 4, 5, 4, 2, 3, 2, 3.

Fixed in the next candidate:

- Row 28 (P2): hro_candidate_no_staff required the candidate's own conversations to load as its control, which hro_candidate_view already grades, so one defect could cost two rows. Its session control is now the candidate's own applications list only.
- Row 31 (P2): hro_bulk_all_or_none only used a refused set whose offending card came first in board order, so an app that validates only the first card would pass. Protocol B adds step (10a): select V (Interview) first and then W (Screen) and try Applied, by UI and by replay. V would skip Screen and is later in board order.
- Row 26 (P3), three of four gaps accepted:
  - hro_msg_compose: Rafael's first T message contains `<b>plain</b>`, which must show as literal characters.
  - hro_move_one_stage: the mover's own page must show a successful move at the first look, without a reload or another person's update.
  - hro_add_email_rules: the typed name and email must both stay after a refused address.
- Row 26 G1, refuted for the third time (rounds 2, 8, 11): on-screen naming for a stale move started from the UI. A conforming app may re-read a card or catch up before acting, so the grader cannot force a stale refusal through the UI. Blocking an app's live channel would be app-specific. The rules require the refusal itself to name the person, and that is graded by replay in hro_stale_refused.
- Row 32 P3 (accepted): protocol U closes Bill's context before Tomas's last message, so only Rafael can be its reader.

The scripted golden driver (25 groups) passes with no page errors. It now also asserts:
- A multi-card move whose offending card is later in board order is refused (409) and nothing moves.
- A message containing `<b>plain</b>` renders as plain text.
- The typed email stays after a refused duplicate.

The public grader-term and criterion-id checks pass. Rows 11 and 40 remain open, and row 42 still carries its risk flag, because no configured judge run exists. That is not evidence of a portal pass, an Oracle score or any model score.
