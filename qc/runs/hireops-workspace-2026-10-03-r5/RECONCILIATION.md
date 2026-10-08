# Recruiting workspace, round 5 reconciliation

**BLOCKED.** 54 of 54 valid reports on input `8e9a1732…`. Quality rows: Fail on 17, 26, 30 and 32; Note on 6, 27, 49 and 50; Not exercised on 11, 40 and 42; the rest Pass. Deterministic: 46 Pass, 2 Note, 0 Fail.

Process note: the first row-27 reviewer could not read the workbook, so reconcile rejected that review as unattested. A fresh reviewer re-ran row 27 with the workbook read and replaced the report. That verdict is a Note at P3.

Fixed in the next candidate:

- Row 17 (golden): when a candidate signed in again on the same browser, the app reopened the conversation they last had open and marked it read, against the rule that signing in opens nothing. Candidates no longer have an open conversation restored at sign-in; staff behaviour is unchanged. The driver now covers signing out after reading and signing back in after a new message: the count stays 1.
- Row 26: nothing checked that the seeded internal notes and seeded card order were loaded. Protocol Z now reads the seeded Platform Engineer order and Noor Haddad's seeded note before anything changes, and D re-reads them after restart; hro_restart grades both. The driver checks the same facts.
- Row 30: hro_candidate_no_staff now requires Rafael's identical move, add-candidate, open-job and note requests to succeed as same-kind controls. The candidate card-detail replay in hro_candidate_private now has Rafael's successful read as its control.
- Row 32:
  - Protocol K now reads a candidate event stream or socket, if the page keeps one open, while Tomas's card is rejected and reopened.
  - hro_stale_refused accepts the person identified by name, or by an identifier that the app's own staff data shows belongs to them.
  - hro_pol_live_board says what to do when nothing scrolls at the viewport.
- Row 27 (P3): job values, card email and the rejected-from stage are graded wherever the app shows them, or by behaviour. One Activity line naming every card of a multi-card move with its stages also satisfies that move.

The scripted golden driver passes 22/22, and the public grader-term and criterion-id checks pass. Rows 11, 40 and 42, and the other risk-flagged rows, stay open because no configured judge run exists. That is not evidence of a portal pass, an Oracle score or any model score.
