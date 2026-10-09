# Kittle matter chat v3.5, 9 October 2026

- Archive: kittle-matter-chat.zip
- SHA256: 65e2d2137a9904e220c3c6b9bdf907e75d1c738a50a5a8a0ad1669e9f042920e
- Source commit: 7a1f6ffc on task/kittle-matter-chat-hard. 32 files, LF, built from git blobs; `.sh` files are mode 755. Category: Messaging & Chat Interfaces.

## Change from v2 (9766459f)

v2's hosted runs gave Oracle 0.9917, Luna 0.8114 and nop 0. v3 aims to bring Luna's score down by making the task harder. Most of the change is in the functional grading.

- **Brief additions:**
  - `@` suggestions only list people who can see the matter.
  - Mentions are matched in any case and follow edits and deletes.
  - Replies cannot cross matters.
  - Editing a message does not make it younger for the timer.
  - Search treats `% _ *` literally.
  - Deleting asks for confirmation, and a linked message stays highlighted.
  - Enter, Shift+Enter and Escape behave as specified.
- **Seed:** new message K-18 in M-13.
- **Golden updates:** a people endpoint, refusal of cross-matter parents, the delete confirmation, the key handling and mention suggestions, and the search placeholder fix for the 390 px clipping.
- **Functional criteria:** still 16, total weight 44.0. They are rewritten to be stricter, and each refusal is paired with a positive control.
- **Polish and visual criteria:** polish is now enter_sends, escape_closes, delete_confirm, link_highlight, transcript_phone and refusal_in_place. Visual is matter_sidebar, retention_marks, transcript_page and phone_thread.
- **Functional judge:** individual mode at 550 s per criterion (16 × 550 + 900 + 900 = 10600 s, against an 11100 s budget). This is lead-authorised and recorded in `tests/scored/functional/judge.toml`.

Shared harness files (`test.sh`, `scoring.toml`, `tests/tools/*`, both Dockerfiles, `solve.sh`) are unchanged from the template.

## QC

Rounds r5 to r9 ran in single-per-row mode: 53 fresh row reviewers plus one deterministic reviewer per round. Each round's fixes went into a new candidate.

r9, on v3.4, came back with:
- 50 Pass
- 2 Fail: rows 30 and 42
- 1 Not exercised: row 40
- deterministic 48/48

v3.5 fixes both Fails:
- **Row 30:** polish escape_closes now also checks that a normal save and a normal send work.
- **Row 42:** functional persistence only requires its own core items to work before the restart. Items graded elsewhere only have to stay the same across the restart, so a durable app no longer ranks below one that does not persist.

At the owner's direction (9 Oct), v3.5 is packaged without a fresh QC round. The r9 clearance therefore covers v3.4, not these two criterion edits.

## Evidence and gaps

- The scripted golden (Playwright, real kill and restart) passes 24/24 on v3.5: the gate, 16 functional, persistence before and after, and 6 polish.
- There has been no configured judge run on v3 bytes. Judge timing under the 550 s cap, the render and visual scores, and how well the reward discriminates between apps are all unmeasured; the hosted run will measure them. No Oracle, Luna or portal score is claimed.
- Owner-accepted: row 46 (judge cwd `/app`).
- Notes carried forward from r9:
  - Hold release is not probed by the message's author.
  - A schema retry of timer_changes or hold_scope_and_release would find the seed items they need already consumed.
  - The thread's sideways scroll at 390 px is graded only on the visual likert scale.
