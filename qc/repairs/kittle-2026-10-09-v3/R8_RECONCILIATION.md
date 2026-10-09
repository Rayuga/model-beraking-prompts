# Kittle QC round r8: reconciliation

This round reviewed the v3.3 candidate (source 948a8012, input f328e4b6…).

It ran 54 independent reviews: 53 quality rows in fresh contexts plus 1 deterministic review. Row 44 dropped on a proxy error and was relaunched once.

Status: BLOCKED.
- Quality: 45 Pass, 5 Fail (rows 27, 28, 30, 31, 32), 1 Note (row 48), 2 Not exercised (rows 11 and 40: judge timing and reward discrimination are unmeasured; accepted under the owner's no-spend decision).
- Deterministic: 48 Pass. Two risks: individual mode needs the lead's authorisation on record, and the time budget is unmeasured.

Process note: the v3.4 fixes were applied to the live task folder before row 21 reported. Row 21 grades test.sh, which v3.4 does not touch, and every reviewer grades the frozen .qc-cache copy, which was not modified. So the verdict is unaffected, but it is recorded here.

## Confirmed findings and fixes (r8_fixes.py, r8_harness_and_renames.py)

| Row | Finding | Fix |
|---|---|---|
| 27 | safe_formatting required the script and javascript parts inside a reply quote or snippet that the brief allows to be short | A shortened quote or snippet is fine; whatever part it shows must appear literally |
| 28 | The "edited" mark was a required positive control in timer_changes and persistence as well as in edits | timer_changes checks the edited text; persistence checks the edited text and only compares the mark across the restart |
| 30 | wall_added_live had no positive control for Sian's other matters | Sian keeps M-11 and M-13 and can open M-11. Persistence checks that Sian can still open M-13. Signin Part B checks that Harriet's M-12 load works |
| 31 | Only the sign-in refusal reason was ever checked | The stale-edit refusal must show a reason next to the edit box that is still there about 10 s later |
| 32 | The signin Part B cross-post replay kept its duplicate-send key, so dedupe-first apps were mis-graded | Replay with new text (JUDGE-CS2). The functional prompt changes the key when the text, target matter or parent changes |
| 48 (Note) | Misleading names | transcript_print → transcript_phone; phone_chambers → phone_thread; "library of messages" → "set of messages" |

## Evidence after the fixes

- The scripted golden passes 24/24.
- The public checks pass.

These fixes change the task bytes, so the r8 clearance does not carry over.
