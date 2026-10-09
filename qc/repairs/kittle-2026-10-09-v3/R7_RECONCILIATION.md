# Kittle QC round r7: reconciliation

This round reviewed the v3.2 candidate (source 2eb075cc, input 641f1533…).

It ran 54 independent reviews: 53 quality rows in separate fresh contexts plus 1 deterministic review. Row 34 dropped on a proxy error and was relaunched once in a fresh context.

Status: BLOCKED.
- Quality: 47 Pass, 4 Fail (rows 26, 28, 30, 46), 1 Note (row 50), 1 Not exercised (row 11).
- Deterministic: 48 Pass. Two risks: individual mode, and the client's private list of known builds was unavailable.
- Preflight "judge header:functional" still shows as failed (lead-authorised individual mode).

## Owner decisions (9 Oct 2026, recorded)

- **Stop rule:** zero Fail, Notes accepted, at most 3 rounds from r7.
- **No provider spend.** The owner runs hosted after QC. That accepts row 11 (Not exercised: per-criterion judge time unmeasured) as an owner-accepted runtime risk.
- **Row 46** (judge cwd /app lets planted /app/.claude or CLAUDE.md influence grading): kept set aside by the owner as a template-level item. The r7 reviewer proposed a task-level mitigation (`cwd = "/tests"` in each judge.toml). It is not applied because it changes template judge headers; it is raised to the owner.

## Confirmed findings and fixes (r7_fixes.py, r7_harness.py)

| Row | Finding | Fix |
|---|---|---|
| 26 | Durable earlier versions and the 1-day timer option were never graded | timer_changes checks the control offers off, 1, 7 and 30 days. Persistence step c includes JUDGE-S0's earlier version when the app shows versions, and it is compared after the restart |
| 28 | The highlight was graded in both message_links and polish link_highlight | Removed from message_links. link_highlight owns it for both the search route and a copied message link, and is self-contained |
| 30 | transcript_print could pass on an empty transcript; Dev's search had no positive control | transcript_print requires "Survey booked for Friday." to be listed. wall_every_route leg 2 requires Dev's "Survey booked" search to find it |
| 31/32 (hardening) | It was unclear which view Dev's second context and Gwen sit on when reading the unread count; the scroll position was not noted | Both now sit on M-11; the judge notes the top message before the live changes |

## Evidence after the fixes

- The scripted golden passes 24/24, with a real restart.
- The public checks pass.

These fixes change the task bytes, so the r7 clearance does not carry over.
