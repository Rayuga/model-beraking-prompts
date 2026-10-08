# Colderwater strict candidate v16, 8 October 2026

- Archive: colderwater-playground-devtools.zip
- SHA256: 29e5edc1816f4b9d5a3183818acf2b8ddc1d086161826b2d87298f7a6888a844
- Source commit: 501d01af on task/colderwater-editor-strict; 43 files, LF, byte-identical to the committed task. Category: programming (unchanged since v1).

Why: hosted portal QC on v15 failed rows 1, 25, 32 and 35.

Changes from v15 (golden solution unchanged):
- Row 1: ui.md and behaviour.md rewritten in the requester's voice with the same requirements; the HTTP line now gives a user reason and covers restores only (what is graded).
- Row 25: no public internet address; cw_preview_isolation probes http://localhost:3000/api/health and http://127.0.0.1:3000/api/health. security.md states the boundary as the playground's own address under both names.
- Row 32: Stop legs (cw_stop_cancels_pending_work, cw_last_good_recovery, cw_output_before_failure_kept) click Run, wait for a start line, then Stop in one code-runner action; a visible timer marker decides void attempts; up to two repeats.
- Row 35: cw_save_reload_restart needs two revisions with different sources and re-reads the first revision's source after the real restart.
- Row 6 (found in our review): ui.md now states Ctrl/Cmd+A select-all and backwards Find wrap, which a criterion relies on.

Checks on these bytes:
- Scripted golden 53 of 53, including new legs: 127.0.0.1 fetch blocked from the preview, both revisions' sources survive a real restart.
- Five static checks pass.
- Quick QC rounds v16-quick, v16-quick2, v16-quick3 (rows 1, 2, 5, 6, 25, 26, 27, 32, 35): every row Pass in its latest round; fails found along the way (6, 26, 32, then 26) were fixed and re-reviewed.

Not measured: Oracle and Luna on v16. Trade-off: the brief no longer asks the preview to block the whole internet, only the playground's own server, because an internet probe made grading depend on an outside site.
