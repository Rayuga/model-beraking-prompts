# Recruiting workspace, round 6 reconciliation

**BLOCKED.** 54 of 54 valid reports on input `cefa38a9…`. Quality rows: Fail on 26, 28, 30, 31 and 32; Note on 33 and 37; Not exercised on 11, 40 and 42; the rest Pass. Deterministic: 41 Pass, 7 Note, 0 Fail.

Fixed in the next candidate:

- Row 32 (P1): rule and role replays reused captured requests whose card version was already out of date. A server with no role, skip or capacity checks would still have answered "changed by someone else", and that stale-card refusal earned the refusal rows. Every rule or role replay now first reads the cards' current version and sends it. A refusal that only reports the card as changed or out of date no longer counts as that rule's refusal; protocol C's deliberate out-of-date move is the only exception.
- Row 30:
  - hro_undo_conflict now has a same-kind control: the undo goes ahead when another person changes only a different card of the job. A reject by another person is now one of the cases that blocks undo.
  - hro_undo_full now has a same-kind control: after a place is freed, the same undo goes ahead.
- Row 31: rejecting, reopening and multi-card moves must work through ordinary controls; drag-only fails those rows.
- Row 26:
  - The Observer must read the Activity lines.
  - Seen marks are also tested when the job's hiring manager (Bill) opens the conversation.
  - The entered source must be shown wherever card details appear.
  - The manager may reject from Offer and reopen to Offer, and is refused re-ordering within Applied and reopening a card rejected from Screen.
- Row 28: unsaved-note persistence is graded only in hro_pol_session_resume. The polish prompt now says not to deduct one defect in more than one row.
- Row 37 (P3): the polish prompt says never to use Lena Fischer's conversation.
- Row 17 (P3, round-6 Pass note, golden): the card-detail and note routes now answer 404 to a candidate asking about an application that is not theirs, and 403 for their own.

The scripted golden driver now has 25 groups, all passing. The new groups cover:
- manager Offer reject and the refused manager actions;
- undo going ahead after an unrelated change, and being blocked by a reject;
- undo into Interview after a place is freed;
- the hiring manager's view marking a message seen;
- the candidate 404s.

The public grader-term and criterion-id checks pass. Rows 11, 40 and 42 stay open because no configured judge run exists. That is not evidence of a portal pass, an Oracle score or any model score.
