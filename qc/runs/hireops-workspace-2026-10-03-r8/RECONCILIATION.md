# Recruiting workspace, round 8 reconciliation

**BLOCKED.** 54 of 54 valid reports on input `74f3c8aa…`. Quality rows: Fail on 26 and 31; Note on 6; Not exercised on 11, 40 and 42; the rest Pass. Deterministic: 40 Pass, 8 Note, 0 Fail. This is the fewest failures so far (by round: 11, 9, 9, 5, 4, 5, 4, 2).

Fixed in the next candidate:

- Row 6 (P2 note, accepted): in protocol U, Tomas's page could still be open on his conversation from T, so Rafael's new message was seen at once and hro_seen could false-fail a correct app. U now moves Tomas's page to his applications list before Rafael sends.
- Row 31: the role replays sampled only some write routes. The Observer, candidate and anonymous replays now also cover a multi-card move and an undo, and the anonymous replays also cover the Activity read. hro_observer_readonly, hro_candidate_no_staff and hro_anonymous list them.
- Row 26, partly fixed, partly refuted:
  - Fixed: hro_stale_refused now also requires Rafael's board to show F where Mei put it within 15 seconds after the refusal, without reload.
  - Refuted, as in round 2: on-screen naming for a UI-initiated stale move is not added. A conforming app may catch up instantly, so the grader cannot reliably put the page into a stale state. The rules require the refusal itself to identify who changed the card, and that is graded through the replay.

The scripted golden driver (25 groups) passes. It now also asserts that a multi-card move and an undo are refused for the Observer and a candidate (403, or 404 for a candidate asking about cards that are not theirs), and with 401 when signed out. The public grader-term and criterion-id checks pass. Rows 11, 40 and 42 remain open because no configured judge run exists. That is not evidence of a portal pass, an Oracle score or any model score.
