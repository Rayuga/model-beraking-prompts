# Recruiting workspace, round 3 reconciliation

**BLOCKED.** 54 of 54 valid reports on input `f53d9ed6…`. Quality rows: Fail on 17, 26, 27, 28, 30, 31, 32, 33 and 49; Note on 6, 48 and 50; Not exercised on 11 and 40; the rest Pass. Deterministic: 39 Pass, 9 Note, 0 Fail.

Process note: row-reviewer-25 wrote its report in Windows-1252 (an em dash, byte 0x97), so the first reconcile rejected it. The bytes were re-encoded to UTF-8 without changing any content; the verdict is Pass with risk flagged. The original sha256 was `51b2aea1…`.

Fixed in the next candidate:

- Row 17 (golden): the move and multi-card move routes told a signed-in candidate whether another application existed. They answered 403 for an existing id and 404 for a missing one. Now a candidate gets 404 for any application that is not theirs, and 403 only for their own; observers are refused before any card is looked up. The driver checks both cases.
- Row 26: three stated rules are now graded. A note added to A2 before its undo must not block the undo (hro_undo_restores). A message arriving while the conversation is open at its newest must not raise the count or the total (hro_unread_counts). Mei must not see Rafael's unsaved reply or note draft on the same browser, and his drafts must survive her visit (hro_pol_session_resume).
- Rows 27, 31, 48: Activity no longer asks for lines for notes, since notes are not part of the rules' Activity list.
- Row 28: hro_interview_full owns only the single-card route; overfill by a multi-card move belongs to hro_bulk_places and overfill by undo to hro_undo_full. A candidate's reply is graded only in hro_msg_exchange. Activity lines added by refused actions are deducted only in hro_activity_refusals.
- Row 30: hro_candidate_no_staff now has a same-session control. The candidate's own data must load first, and a candidate who cannot sign in scores 0 on this row.
- Row 32: Mei's expected unread count is now derived from the observed sequence. The draft-privacy leg uses a second, still-unsent draft, so it can actually fail.
- Row 33: every binary criterion now ends with "Fails if any condition stated above does not hold", so each criterion has a single target.
- Row 49: in protocol K the card-detail replay must be refused. Only the board and Activity reads may answer with the candidate's own data.
- Row 6 (P3): the rules now say a person is told when a message was not sent. Row 35 (P3): the notes read in N happens in an independent context.

The scripted golden driver passes 20/20 after the changes, and the public grader-term and criterion-id checks pass. Rows 11, 40 and the other risk-flagged rows remain open because no configured judge run exists. That is not evidence of a portal pass, an Oracle score or any model score.
