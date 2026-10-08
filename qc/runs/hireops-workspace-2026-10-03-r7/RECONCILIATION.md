# Recruiting workspace, round 7 reconciliation

**BLOCKED.** 54 of 54 valid reports on input `88507720…`. Quality rows: Fail on 26, 27, 28 and 32; Note on 6, 18, 31 and 50; Not exercised on 11, 40 and 42; the rest Pass. Deterministic: 39 Pass, 9 Note, 0 Fail.

Fixed in the next candidate:

- Rows 6, 18, 27 (seen by the hiring manager): in protocol U, Rafael's page was still open on Tomas's conversation at its newest message. A conforming app therefore marked Tomas's next message seen before Bill opened it, and hro_seen would have false-failed a correct app. U now moves Rafael's page to the Board, and keeps Mei out of the conversation, before Tomas sends the message Bill opens.
- Row 32 (role replays): even with a fresh version, a replay could be refused for an unrelated reason, such as a duplicate email or a skipped stage, and still look like a role refusal. Every role replay must now be an otherwise legal request:
  - a new unique name, email or title;
  - new note text;
  - a one-step stage move.

  Rafael's identical fresh request is the control. A refusal for a duplicate, a skip or a full stage does not count as the role refusal.
- Row 28: the A2 undo in B(12) is graded only in hro_undo_conflict; hro_undo_restores no longer counts it.
- Row 26: the server's refusal of conversation writes is now graded even when the UI hides the send box. Rafael's observed send is replayed with new text as the Observer, as Ingrid (another job's manager) and as Noor (another candidate, answered as not found). Nothing may be added, and Rafael's send is the control.
- Row 31 (P3):
  - Protocol B step 14 now says "move W one place, up or down", so it can always be performed.
  - A backward skip (Interview to Applied) is now tried and graded in hro_move_one_stage.
- Row 29 risk: the `browser_run_code_unsafe` tool the prompts name does exist in the verifier image's @playwright/mcp; this was checked by grepping the installed package.

The scripted golden driver (25 groups) passes. It now also checks:
- a message sent as another job's manager is refused (403);
- a message sent by a candidate to a conversation that is not theirs is answered as not found (404);
- the backward skip is refused.

The public grader-term and criterion-id checks pass. Rows 11, 40 and 42 stay open because no configured judge run exists. That is not evidence of a portal pass, an Oracle score or any model score.
