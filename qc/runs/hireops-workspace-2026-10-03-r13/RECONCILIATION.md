# Recruiting workspace, round 13 reconciliation

**BLOCKED.** 54 of 54 valid reports on input `12bf37ab…`. Quality rows: Fail on 26 and 28; Note on 11 and 42; Not exercised on 40; the rest Pass. Deterministic: 40 Pass, 8 Note, 0 Fail. Row 33, which failed in round 12, passes. Failures by round: 11, 9, 9, 5, 4, 5, 4, 2, 3, 2, 3, 2, 2.

Fixed in the next candidate (rubric wording only; golden and driver unchanged):

- Row 28 (P2): hro_job_open accepted team, manager and places "evidenced by behaviour (the manager's own moves in R, the places limit in L)". That made a broken places limit or manager role cost this row too, unless the app happened to print the value. The row now grades only what it alone observes: the job appears with its title, any team, manager or places value the app shows matches the input, an independent context sees it, and invalid inputs are refused. Places and manager behaviour are graded only in hro_interview_full and the manager rows.

Refuted, for the fourth time (rounds 2, 8, 11, 13):

- Row 26 asks for an on-screen check of a stale move started from the UI. The mover's page would have to name the colleague and put the card back.
- This round's suggested mechanism: block the page's live-update requests (as the polish failed-send check aborts a send), have Mei move F, then move F through the UI.
- It does not work for every conforming app:
  - The polish check aborts one known request. A live channel is app-specific, and an already-open WebSocket keeps delivering updates after new requests are blocked.
  - A conforming app may also re-read a card before acting.
  - So the stale state cannot be forced, and the leg would grade apps by transport choice.
- The public rule's server half is graded by replay in hro_stale_refused: refused, nothing changes, the refusal names who changed the card. hro_refused_put_back grades the on-screen put-back and reason for a UI-path refusal (the full-Interview move).

The public grader-term and criterion-id checks pass. A 10-word overlap scan of the test files against the public files finds nothing. Rows 11, 40 and 42 remain open because no configured judge run exists. That is not evidence of a portal pass, an Oracle score or any model score.
