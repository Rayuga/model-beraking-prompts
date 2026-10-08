# Recruiting workspace, round 1 reconciliation

**BLOCKED.** 54 of 54 valid reports on input `6ca9ee73…`: 37 Pass, 11 Fail, 3 Note, 2 Not exercised; deterministic 47 Pass, 1 Note. No reviewer found a criterion the golden cannot pass. All Fails concern rubric wording, ordering or coverage. Fixed in the next candidate:

- Rows 4, 27, 33: criteria demanded that refused actions are "not offered". They now grade only server refusal with nothing changed; hiding is optional.
- Row 26: open-job and add-candidate by non-recruiters, a non-manager chosen as hiring manager, and a candidate message being seen are now graded; "dragging" is optional in the brief.
- Row 28: bulk arrival removed from hro_arrive_bottom.
- Row 30: hro_pol_live_thread and hro_candidate_private name their positive controls; other refusal rows name the successful action.
- Row 32: UI refusals of capacity, skip and bulk moves are now followed by a replay so the server's refusal is observed; hro_refused_put_back accepts a UI that refuses before moving.
- Row 34: unread, seen and new-message readings wait up to 15 seconds without reload or click.
- Rows 31, 37, 49: the starting-unread check moved to Lena Fischer (read first, by an account no other review uses); the unread criterion names Tomas's new J2 conversation.
- Row 43 note: the render gate no longer requires a visible wrong-password message.

Rows 11, 40 and 42 remain Not exercised or risk-flagged for want of a configured judge run.
