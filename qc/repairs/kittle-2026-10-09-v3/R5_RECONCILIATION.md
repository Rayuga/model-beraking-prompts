# Kittle QC round r5: reconciliation

This round reviewed the v3 candidate (source commit 3682ee36, input hash d7a61354…).

It had 54 independent reviews: 53 quality rows, each in its own fresh context, plus one review of all 48 deterministic rows. Two reviewers (rows 47 and 49) dropped on proxy errors before writing anything; each was restarted once in a fresh context.

The pipeline status is BLOCKED, for two reasons:
- six quality rows failed;
- preflight "judge header:functional" fails, as it did in r4. That is the functional judge's lead-authorised individual mode.

## Tally

| Part | Pass | Fail | Note |
|---|---|---|---|
| Quality (53 rows) | 45 | 6 | 2 |
| Deterministic (48 rows) | 48 | 0 | 0 |

Two deterministic rows carry risk: check-rubric-schema (individual mode) and check-scoring-policy (budget unmeasured on v3).

## Confirmed findings and fixes

Each fix is in the next candidate (r5_fixes.py and r5_harness.py).

| Row | Finding | Fix |
|---|---|---|
| 6, 27 | polish link_highlight required the highlight 10 s later; the brief only said it highlights | The brief now says it "stays highlighted until you open something else"; the criterion keeps the wait and says "without opening anything else" |
| 26 | `*` was never searched and partial words were never checked, so GLOB or FTS apps could pass | Part C adds "X*9" vs "XY9" and the partial-word search "urvey booked" |
| 26 (P3) | Cross-matter reply was only tested with a walled matter | Adds a reply aimed from M-11 at an M-13 parent that Dev can see; it must be refused |
| 30, 42 | persistence credited features that never worked (no positive controls), so its scores did not rank apps correctly | Step c is now a list of positive controls that must hold before restart_app; the durability-only waiver is removed |
| 30 (P3) | timer_changes never confirmed that "off" reads off | Leg 3 checks it reads off; leg 4 checks lengthening to 30 days brings nothing back |
| 32 | The edit-hijack replay carried a stale version, so a 409 conflict masked missing author checks | Sian replays with the current version she reads from her own thread request |
| 32 (P3) | The wall-lift replay assumed a user identifier | The replay is adapted to whatever identifies Sian's wall |
| 32, 6 (P3) | Replays could keep a dedup key or drop an idempotency header | The functional prompt records identifying headers and changes any duplicate-send key when the text changes |
| 31 (Note) | The transcript sent time was only checked for messages stamped with the clock time | Part B requires "Survey booked for Friday." to show 2026-05-08 15:00 |
| 37 (P3) | Sian's refusals could be explained by a leftover wall | Sian opens M-13 first (positive control) in timer_changes leg 5 and edits leg 3 |
| 18 (risk) | The cross-matter reply refusal text was not the plain not-available | The golden now answers "Not available." when the parent is not in the matter |
| 44 (comment) | The weight-rule comment did not explain the 3.0 and 4.0 weights | The comment now explains the parts |
| 49 (Note) | The brief promised about 5 s for live updates; the criteria allow about 10 s | The brief now says about ten seconds in both notes |

## Not changed

- **Row 17 note:** an open search or mentions view does not live-refresh after a wall is added. The brief's live promise covers an open matter, which works.
- **Row 46:** the r1/r3 /app/.claude finding is template-level and was set aside by the owner. This round's row 46 reviewer passed it.
- **Runtime risks:** rows 7, 10, 11, 21, 23, 24, 29, 35, 39, 40, 43, 51 and the deterministic budget row note that no configured judge run exists on v3. A hosted run is the measurement.

## Evidence after the fixes

- The scripted golden run passes 24/24: the constraints gate, 16 functional criteria, persistence_before, persistence and 6 polish. See results/golden-run.log.
- The public criterion-ID, grader-term and network-policy checks pass.
- The reviewer leftovers are removed: the row 19 Docker container and image, and `__pycache__` in the frozen cache.

These fixes change the task bytes, so the r5 clearance does not carry over to the new candidate.
