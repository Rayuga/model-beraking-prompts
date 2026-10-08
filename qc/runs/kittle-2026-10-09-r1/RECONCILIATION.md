# Kittle QC round r1 (2026-10-09) — reconciliation

- **Candidate:** input_sha256 `6cefe0c6…44a7` (commit after `19ad44be` plus the integration.md rename).
- **Mode:** single-per-row: 53 separate row reviewers plus 1 deterministic reviewer, all with fresh contexts.
- **Status from `qc_pipeline.py reconcile`:** BLOCKED. All 54 reviews are valid. Preflight is false, but only because of `judge header:functional` (individual mode, the lead's instruction).
- **Tally:** 27 Pass, 19 Fail, 5 Note, 2 Not exercised (rows 11 and 40). Deterministic: 46 Pass and 2 Notes; no Fails.
- **Encoding repair:** rows 01 and 20 were saved as Windows-1252 rather than UTF-8. I re-encoded them as UTF-8 with no change to their content. The original bytes are kept next to them as `*.json.cp1252-original`.
- **Runtime evidence gaps (no measured record):** reward discrimination, ranking, timeouts fitting the work, and the verifier image grading. No configured judge run, Oracle or model score exists.

## Confirmed defects, to be fixed in a new candidate (none outvoted)

1. **The unread line in `unread_and_new_messages_line` fails the golden.** Raised by rows 6, 18, 27, 32, 37 and 42. The criterion never has Dev open M-13 first. Fix: add that catch-up step and the 10 s waits from row 34.
2. **The brief leaves out the runtime contract** (rows 4 and 23, plus the deterministic note):
   - the app is launched from a different working directory;
   - the agent must hand over without a test database;
   - symlinks in `/app` zero the reward;
   - `instruction.md` never mentions `/app`.
3. **Holds** (rows 6, 30, 31 and 32):
   - add a successful delete in the same criterion before the refused one;
   - add a reply under the held message to show the hold does not spread to it;
   - a non-partner tries to place a hold and is refused (row 26).
4. **Timer wording** (rows 18, 27, 32 and 33): move Sian's replay after the timer is set back to 30 days, and make it a different value.
5. **Brief promises nobody checks** (row 26): the permission refusals for holds, walls, and editing or deleting someone else's message; plus the small extra checks, each either added or trimmed from the brief.
6. **Double grading and chained criteria** (rows 28, 38, 44 and 48):
   - grade each observable once;
   - make search, versions and live updates create their own test messages;
   - polish judges placement only;
   - write down one weight rule;
   - restore the template sentence "and continue after any failure".
7. **Persistence** (rows 31 and 35): before the restart, add a wall and a timer value that differ from the seed. After it, check every message deleted during the run.
8. **A read-only fake clears the floor** (rows 29 and 39): the constraints gate needs a save and a check from a fresh browser context, and the read-only criteria need a positive control that depends on a saved message. **The owner wanted a plain reload, so this needs their decision.**
9. **Timing and separate sessions** (row 34):
   - add waits to the unread steps;
   - polish `refusal_in_place` waits 10 s;
   - `app_context.md` explains how to open a separate browser context.
10. **Golden:** a refusal shown on a message is wiped when the thread re-renders (rows 17 and 34). Keep it.
11. **Visual anchors** (row 27): the top scores describe the golden's own layout. Make them general.
12. **Seed:**
    - K-16 is a live script payload; make it inert markup (rows 14 and 52);
    - rename the seed to `seed_data.json` (row 50).
13. **Wording:**
    - the live-wall wording (row 6);
    - say that a mention of someone walled off is still allowed to post (row 42);
    - drop the sibling-task names from the `judge.toml` comment (row 48).

## Template-level, outside this task's control

- **Row 46 (P0, reproduced in a container):** the judge runs as root with its working directory in `/app`. A planted `/app/.claude/settings.json` hook runs as root and can rewrite the files under `/tests`. Fixing it needs changes to `test.sh` and the judge settings, which the template controls. Escalate to the lead; do not patch the shared harness locally.

## Budget constraint while fixing

Row 11 measured nothing, and its estimate is 300–750 s per heavy criterion. The new legs have to fit inside the existing 17 sessions at 520 s each. Removing the duplicates gives back the time.
