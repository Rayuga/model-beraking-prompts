# Kittle QC round r6: reconciliation

This round reviewed the v3.1 candidate (source 69ba916d, input 3038f6b5…).

It ran 54 independent reviews: 53 quality rows in separate fresh contexts plus 1 deterministic review. Rows 42 and 52 dropped on proxy errors before writing anything, and each was relaunched once in a fresh context. No reviewer leftovers remain: the frozen cache has no `__pycache__`, and no r6 container or image is left.

Status: BLOCKED.
- Six quality rows failed.
- Preflight "judge header:functional" still fails because of the lead-authorised individual mode (same as r4 and r5).

## Tally

- Quality: 44 Pass, 6 Fail (rows 6, 27, 32, 37, 38, 42), 2 Note (rows 28, 33).
- Deterministic: 48 Pass. One risk flag (rubric-schema: individual mode).

## Confirmed findings and fixes (r6_fixes.py, r6_harness.py)

| Row | Finding | Fix |
|---|---|---|
| 6, 27 | wall_every_route W3 demanded a plain not-available, which the brief only asks for on walls and client scope, and assumed the golden's reply request shape | W3 passes if refused in any way, or if the reply lands under its own parent in M-13. It fails only if it shows in M-11 or under another matter. Plain not-available is still required for the M-12 routes, including W2 |
| 32 | timer_changes required a separate earlier-versions request, which an app that ships versions in the thread payload could not supply | Record whichever request returned the versions (dedicated or thread), and only if the app shows versions |
| 42 | The version viewer was a positive control in three criteria (9.0) while durability carried 2.0, so an in-memory app outranked a durable one with no viewer | The viewer is graded only in edits; persistence step c no longer needs it; persistence is weighted 4.0 (two core parts: walls and retention), total 44.0 |
| 37 | If Sian's refused 1-day timer replay were accepted by a weak app, it deleted K-8 and cascaded into message_links and live_updates | The replay uses "off", which never deletes; the setting must still read 30 days |
| 38 | A broken wall-lift in wall_added_live left Sian or Dev walled from M-13 and cascaded into three later criteria; escape_closes depended on enter_sends' message | wall_added_live walls and lifts Sian on M-12, which no later criterion needs; escape_closes posts its own message |
| 28 (Note) | Search-result navigation and transcript sent time were each graded twice | link_highlight grades only the highlight; sent_once_in_order grades only order |
| 33 (Note) | The polish prompt lacked the "Fails if never excuses a step" rule | Rule added; the enter_sends Fails-if line now lists the empty box |
| 18 (wording) | The M-12 "@Dev" was described as using the mention feature, although Dev is rightly never suggested there | The text is now typed as written |
| 26 (hardening) | message_links did not check the highlight; an escaped reply was not checked for posting nothing | Both added |
| 48 (wording) | app_context listed edit and delete on every message | Now "on your own messages" |

## Not changed

- **Row 34/26 note:** the thread at 390 px is judged by the visual phone_chambers criterion; the transcript keeps the strict scrollWidth check.
- **Row 44 note:** the 0.6/0.2/0.2 split can reward polish over access control. That split is set by the template.
- **Runtime risk:** rows 11, 21, 29, 35, 40 and the deterministic budget check note that per-criterion judge time on v3 is unmeasured. A configured run is the measurement.

## Evidence after the fixes

- The scripted golden passes 24/24, with a real restart.
- The public checks pass.

These fixes change the task bytes, so the r6 clearance does not carry over.
