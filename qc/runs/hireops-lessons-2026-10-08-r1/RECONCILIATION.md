# HireOps, Colderwater-lessons round 1 reconciliation

**STALE (golden fixed mid-round) and BLOCKED.** 54 of 54 valid reports on input `f3019705…`. Quality rows: Fail on 2, 6, 18, 26, 28, 31, 32, 34; Note on 1, 27, 33, 36, 40, 42, 49, 50; Not exercised on 11; the rest Pass. Deterministic: 38 Pass, 10 Note, 0 Fail.

This candidate applied the Colderwater lessons (simple gate, single-action timed observations, step reporting, one weight scheme, a "check it yourself" brief line, notes in the requester's voice, a modifier-key note).

Fixed in the next candidate:

- **Row 18, golden:** the source showed the golden's nav unread total could lag about 300 ms behind a conversation marked read on arrival. app.js now repaints the nav totals whenever a view marks a conversation read locally. The driver now asserts the nav total never rises while the conversation is open at its newest message. That assertion also passed on the pre-fix golden in our environment, so the race was not reproduced; the fix is kept as defensive.
- **Rows 32, 34 and 36 (timed observations):**
  - Other facts are read 2 s after the expected change appears.
  - A negative step ("does not change") is watched for the full 15 s, then confirmed once after a reload.
  - Text created in a timed action carries a unique suffix.
- **Row 32 (put-back):** hro_refused_put_back also passes when the UI does not offer the move into a full Interview and the card shows why. Earlier successful moves are the control.
- **Rows 1 and 2 (voice):** notes section 8 and the integration.md symlink paragraph are now in the requester's voice. integration.md's "honoring" is template text and is kept.
- **Rows 6 and 27 (candidate view):** the notes now say a candidate sees each application's unread count and whether their own last message was seen. The golden already does both.
- **Row 26:**
  - The typed source must survive a refused email.
  - Protocol M adds undoing a rejection, now in hro_reject_reason.
  - The public wording on stale moves now matches what is graded: "the refusal should say who" (brief) and "the refusal itself says the card was changed and by whom" (notes), graded by replay in hro_stale_refused.
- **Row 28:** when a candidate cannot send, Mei Lin sends the messages the U and live-thread legs need. Only hro_msg_exchange deducts.
- **Row 31:** protocol K and hro_candidate_view name each candidate's seeded applications: Noor's Platform Engineer and Product Designer, Tomas's Data Analyst.
- **Row 33 notes (accepted):** hro_mgr_late_stages wording, the Activity parenthetical, and the pol_live_thread ownership sentence.
- **Row 35 note (accepted):** protocol D re-reads after restart in a fresh independent context.

Not acted on:
- Row 49: /assets is listed as unavailable at runtime, but the template harness copies it. Template-controlled and harmless.
- Rows 40 and 42: no measured discrimination or ranking.
- Row 11: no measured judge duration.

Evidence:
- The golden, installed with solve.sh into an empty /app and launched as uid 65534 from another working directory with a real restart (via-solve.sh), passes all 26 driver groups with no page errors. The groups now also cover undoing a rejection, the kept source field and the nav total.
- The public grader-term and criterion-id checks pass, and a 10-word overlap scan finds nothing.
- The largest assembled prompt is 48.6 KB.
- None of this is a judge, Oracle or model measurement.
