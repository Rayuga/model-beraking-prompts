# Kittle matter chat, final build, 9 October 2026

- Archive: kittle-matter-chat.zip
- SHA256: 0536e37e590b32baa00c769bdb28a598d6af09d74a3176acc4aa7b46797ea6a6
- Source commit: 3654fc9d on task/kittle-matter-chat-hard. 32 files, LF, byte-identical to the committed task. `.sh` files are executable. Category: Messaging & Chat Interfaces, unchanged since v1.
- The template-controlled files are byte-identical to the template: test.sh, both Dockerfiles, .dockerignore, scoring.toml, score.py, restart_mcp.py and solve.sh. The functional judge uses individual mode at the lead's request: 16 criteria x 550 s + 900 + 900 = 10600 s, inside the 11100 s scored budget.

## What the task is

A law firm's matter chat. Ethical walls hold on every route, including live updates. Disappearing-message timers run against a fixed clock, and legal holds override them. Threaded replies are at least three levels deep. Edits keep earlier versions and refuse stale saves. Formatting renders safely, message links show previews, and @mentions, unread counts with a "new messages" line, duplicate-safe sends, live updates, search and transcripts all work. Everything survives a restart. The golden app is library-free vanilla JavaScript.

## Checks on these bytes

- **Scripted golden:** 19 of 19 checks pass on one database around a real kill and restart: the constraints gate, all 16 functional criteria in order, and two polish checks (qc/repairs/kittle-2026-10-08/results/golden-run.log).
- **Public checks:** criterion IDs, grader terms and network policy all pass on the extracted archive.
- **QC history:** four full single-per-row rounds, each with 53 independent row reviewers plus 1 deterministic reviewer. Reports are under qc/runs/kittle-2026-10-09-r1..r4.

  | Round | Pass | Fail | Note | Not exercised | Deterministic Fail |
  |---|---|---|---|---|---|
  | r1 | 27 | 19 | 5 | 2 | 0 |
  | r2 | 40 | 9 | 2 | 2 | 0 |
  | r3 | 42 | 6 | 3 | 2 | 0 |
  | r4 | 39 | 10 | 2 | 2 | 1 |

  - Every confirmed finding from r1 to r4 is fixed except row 46.
  - The r4 fixes are wording changes to the criteria and brief. They went into commit 3654fc9d and the golden run was repeated (19/19). By the owner's decision there was no fifth review round, so the r4 fixes have not been re-reviewed.

## Known open items

- **Row 46 (template-level, set aside by the owner's decision):**
  - The defect: the judge runs as root with /app as its working directory, so a planted `/app/.claude` hook or `CLAUDE.md` can influence grading. Reproduced in r1 and r3.
  - The fix needs a change to the shared harness or the judge headers, which should be raised with the lead.
- **Not measured:**
  - judge duration per criterion (row 11)
  - reward discrimination and ranking (rows 40 and 42)
  - a full configured verifier run
  - Oracle and model scores
