# Recruiting workspace, round 4 reconciliation

**BLOCKED.** 54 of 54 valid reports on input `d2912713…`. Quality rows: Fail on 6, 25, 26, 28 and 29; Note on 27, 31, 33, 50 and 53; Not exercised on 11, 40 and 42; the rest Pass. Deterministic: 40 Pass, 8 Note, 0 Fail.

Process note: row-reviewer-51 compiled Python, which created a `__pycache__` inside the frozen `.qc-cache` input, and then removed it. Reconcile recomputed the frozen hashes with preflight passing, and no `__pycache__` remains.

Fixed in the next candidate:

- Row 6 (P1, golden): the candidate page opened a candidate's only conversation automatically. That marked it read, so Lena's starting unread count of 1 could never be observed and the reference failed its own protocol Z. The auto-open is removed. The rules now say a conversation opens when the candidate chooses it and signing in does not open one. A driver check signs Lena in and confirms her count stays 1.
- Row 25: the functional prompt is assembled separately from the other prompts and lacked the "NOT EXERCISED" rule for steps a judge never reached. It now carries the same paragraph as the other four prompts.
- Row 26: a re-order inside the same stage now blocks undo too. In protocol B step 14, Mei only re-orders W after Rafael moves Y and W together, and Rafael's undo must be refused; this is graded in hro_undo_conflict. The golden already refused it, and the driver now checks it.
- Row 28: hro_candidate_view no longer grades whether other people's applications appear; only hro_candidate_private does. Clearing the box after sending is graded only in hro_msg_compose, not in hro_drafts. The typography anchors no longer mention alignment.
- Row 29: the gate restated in the scored prompts insisted on the Observer, while the real constraints gate allows any working staff account. An app with an Observer-only defect would have been zeroed. The restated gate now matches the real one.
- P3 notes, rows 27, 31, 33 and 48:
  - The candidate card-detail replay targets a card that is not his.
  - hro_activity checks "what changed" instead of always "the stages", and protocol A covers every board action before A, by any account.
  - Whether the Observer is offered controls is recorded but not graded.
  - A local not-sent marker is acceptable after a failed send.
  - hro_pol_live_thread now lists "the view stays at the newest message" as a pass condition.

The scripted golden driver passes 21/21, and the public grader-term and criterion-id checks pass. Rows 11, 40 and 42, and the other risk-flagged rows, remain open because no configured judge run exists. That is not evidence of a portal pass, an Oracle score or any model score.
