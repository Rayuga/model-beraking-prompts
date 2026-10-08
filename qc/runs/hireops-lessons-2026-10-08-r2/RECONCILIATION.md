# HireOps, Colderwater-lessons round 2 reconciliation

**BLOCKED.** 54 of 54 valid reports on input `ccf245cd…`. Quality rows: Fail on 23, 28, 31, 32, 33; Note on 14, 26, 34, 50; Not exercised on 11, 40, 42; the rest Pass. Deterministic: 41 Pass, 7 Note (applied manually because no harness checker executable exists in the workspace), 0 Fail.

Reviewers for rows 26, 27, 39, 46, 47 and 53 were cut off by proxy errors (ERR_PROXY_TUNNEL). Each was relaunched in a fresh context, except row 53, whose report was already complete and valid on disk before the error. No reviewer saw another's report.

Fixed in the next candidate (all in the task's own prompts, criteria and notes; no harness, template, weight or budget change):

- **Row 32 (P1), my own L1 rule:**
  - The timed-observation block no longer reloads a watched page to confirm a negative. A reload re-opens a conversation at its newest message, which made a conforming app fail hro_unread_scrolled_up.
  - A negative count or seen mark is now confirmed once in a fresh independent context of the same person, without opening that conversation.
  - The K rejection reason carries a unique suffix that is searched for in every candidate response.
- **Row 33, hro_refused_put_back:** each of the three accepted designs now has the same three legs: the card is in its real place, the reason is shown on or for that card, and focus is on a control of that card.
- **Row 28 (lesson-16 pattern; every instance fixed):** hro_observer_readonly, hro_candidate_no_staff and hro_anonymous now leave out any request kind whose staff control never succeeded, so a dead feature is scored only in its own rows. "Or the staff control did not succeed" is removed. The Observer row gains a sign-in and board-load session control.
- **Row 31:**
  - Protocol R has Rafael try to reopen a Screen-rejected card to Applied and to Interview; both must be refused with the card unchanged.
  - hro_reopen now says the check is made in both directions.
  - The golden driver asserts the same thing.
- **Row 34:** hro_pol_live_board makes the board scroll first (up to twelve cards) before opening details and typing the note. The polish "workable order" says the same.
- **Row 26:** protocol K now takes Tomas's J2 card through reject, reopen and then each stage to Hired, so Offer and Hired candidate wording is read.
- **Row 23:**
  - The reviewer's case was already covered by notes section 8.
  - integration.md now also says: "We start it as node /app/server.js from a different working directory under a locked-down account, so find your files relative to the app itself and write only under /app or wherever DB_PATH points."
- **Rows 48 and 49 notes:**
  - "Do not open a job" in the constraints gate now reads "Do not create a new job".
  - Protocol S says J1 takes any title and team.
  - "Do not sign in as Lena again in this review" replaces "before K".
  - Mei's unread parenthetical now reads "every later message by anyone other than Mei".
- **hro_add_candidate:** any email or source the app shows must match what was entered.

Not acted on, with reasons:
- **Row 14 (P3):** seeded read markers sit before some of the reader's own later messages. Unread counts only messages by others, so the count is unaffected, and the seed is left as is.
- **Row 50 (P3):**
  - board.js and threads.js are untracked in git; they will be committed when the user asks.
  - solution/app/src/seed_data.json duplicating the assets seed is a known false positive.
- **Rows 11, 40 and 42:** no configured judge run, measured discrimination or ranking exists. These need the user's authorised run and are not waived.
- **Row 7 note:** a CRUD-only stub could score near the 0.05 floor. This should be checked in a measured run.

Evidence after the fixes:
- The golden was installed with solve.sh into an empty /app and launched as uid 65534 from another working directory with a real restart (via-solve.sh). It passes all 26 driver groups with no page errors, including the new two-way reopen refusal.
- The public grader-term and criterion-id checks pass, and a 10-word overlap scan finds nothing.
- Assembled prompt sizes: functional 51.3 KB, polish 14.0 KB, visual 8.4 KB, render 4.7 KB, constraints 5.4 KB.
- None of this is a judge, Oracle or model measurement.

These changes invalidate this round's clearance. A fresh full round on the new bytes follows.
