# Lessons from Colderwater (8 Oct 2026): making a task tougher without breaking QC

Colderwater went through v5–v16. GPT-5.6 Luna moved from 0 (broken apps) into the target band (0.44 on v14, 0.57 on v15), and Oracle reached 1.0. These are the lessons that cost us portal tries.

## Making it tougher (getting the model into 0.1–0.7)

1. **Add requirements to the brief, never hidden ones.** Every stricter criterion needs a matching sentence in the brief or notes. Hidden or golden-only demands fail QC rows 6, 27 and 31, and the customer audit asks exactly this question.
2. **Don't touch weights to steer the band.** Keep one documented weight scheme (we used 1.0/1.5/2.0 by importance). Tighten criteria instead. The customer audit compares the average weight of failed criteria against passed ones and recomputes with equal weights.
3. **Luna's real weaknesses are edge cases inside core features, not missing features.** Good levers: multi-caret and undo semantics, exact boundaries, stale and concurrent writes, idempotent replays, restart durability, recovery after errors and timeouts. Luna typically builds in 5–10 minutes and never tests in a browser.
4. **Keep gates simple: load, reload, server-backed.** A hard gate makes the reward all-or-nothing. Luna scored 0 twice because its editor broke the gate. Do the strictness inside scored criteria.
5. **One line in the brief helped Luna land in band:** "Before you hand it over, please check it yourself the way I'll use it: type…, run…, save…, and make sure nothing breaks." It nudged Luna to test, and the result was 0.44–0.57 instead of 0.

## The judge (AI browser judge, batched)

6. **Put the checker-not-fixer rule in every prompt.md (the boss asked for this).** Check only the named feature as delivered; never repair, patch or work around; a feature that doesn't work scores 0.
7. **Timing races fail correct apps.** Any "do X within N seconds" step must run in one Playwright code-runner action: click Run, wait until a start line appears, then click Stop. Give the timer a visible marker so a void attempt can be decided, and allow up to two repeats. Fail only if every attempt is void. Apply the same fix to every similar criterion, not just the one that failed.
8. **Modifier-clicks:** tell the judge in app_context to hold the key during the click (click-tool modifiers, or keyboard.down / mouse.click / keyboard.up). Oracle dropped to 0.944 on v14 because the judge pressed and released Alt before clicking.
9. **The judge over-passes:** it skipped steps on 4 criteria worth 6/59. Require it to report each step and to fail any step it skipped.
10. **Prompt size limit is 128 KB.** Our largest assembled prompt (prompt.md + app_context + all criteria) was ~51 KB. Measure it before each upload.
11. **Judge infra crashes happen** (`unrecognized_model`, timeouts). They zero a dimension, so check the export before blaming the task.

## Portal QC flags we hit (check your task for every instance, not just the flagged one)

12. **Row 1: notes read like an acceptance checklist.** Each tightening round added "must / must not" edge cases that mirrored the criteria one-to-one. Fix: write the notes in the requester's voice with reasons ("I use multiple carets a lot…", "My connection drops now and then, so…"), keeping the same requirements. Never tell the builder how to build something just so the grader can test it; give a user reason or drop it.
13. **Row 25: no public internet address in judge prompts.** "A public https address of your choice" was flagged because grading depended on an outside site. Use local addresses only, such as localhost and 127.0.0.1.
14. **Row 32: undefined repeat or void handling in timing steps.** See lesson 7.
15. **Row 35: a weak restart/persistence check.** Re-reading one record saved once lets a fake app pass. Build several revisions, note each one's exact content, really restart (restart_app), and re-read every one.
16. **Row 28: don't grade one thing twice.** When we made the restart check also grade restore and replay, the full round flagged a double penalty. Grade other features' behaviour relative to a before-restart baseline, or say "scored elsewhere".

## Process

17. **Run a full 53-row round before every upload** after accumulated changes. Our last full round was on v9, and the drift over v10–v15 caused the four portal flags. Quick rounds on touched rows miss drift.
18. **Each fix can create a new issue.** Re-review the rows a fix touches. On v16 our fixes introduced the Ctrl+A gap, an unstated save-transport line and a new Stop race, all caught by re-review.
19. **Keep a scripted golden harness** (Docker: build, install with solve.sh, launch like test.sh, a real restart, Playwright checks). Rerun it after every change and extend it with every new criterion leg. It's how we know Oracle stays at 1.0 before spending a try.
20. **Reproduce the model's failures on its exported app** (run artifacts/app in Docker plus Playwright). It tells you whether a 0 is the model, the judge or the task, and it's the evidence the customer audit wants.
21. **Never rerun an unchanged task hoping for a better roll.** Fix the cause, then upload.
