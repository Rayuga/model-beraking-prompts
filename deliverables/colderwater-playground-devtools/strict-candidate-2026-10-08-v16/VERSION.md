# Colderwater strict candidate v16, 8 October 2026 (final build)

- Archive: colderwater-playground-devtools.zip
- SHA256: f407efa0b0f84c52fec97564c0426ade6598fdddae012d33eced400ec8cc2422
- Source commit: 7a606512 on task/colderwater-editor-strict; 43 files, LF, byte-identical to the committed task. Category: programming (unchanged since v1).
- Supersedes the earlier v16 build of this folder (29e5edc1...), which must not be uploaded.

Why: hosted portal QC on v15 failed rows 1, 25, 32 and 35.

Changes from v15 (golden solution unchanged):
- Row 1: all six notes rewritten in the requester's voice with the same requirements; the HTTP line asks only for restores (what is graded), with a user reason.
- Row 25: no address outside the machine anywhere; preview isolation probes localhost and 127.0.0.1; security.md states that boundary.
- Row 32: every Stop or newer-run leg runs in one code-runner action, waits for a start line before Stop, uses a visible timer marker to decide void attempts, and allows up to two repeats.
- Row 35: cw_save_reload_restart builds three revisions (save, save, restore), re-reads every revision's source after the real restart, and grades restore idempotency only relative to a replay before the restart (no double penalty with the restore criteria).
- Also from our own review: Ctrl/Cmd+A and backwards Find wrap stated in ui.md; history check gives revision one its own title and filename.

Checks on these bytes:
- Scripted golden 53 of 53, including: 127.0.0.1 preview fetch blocked; three revisions and their sources surviving a real restart; snapshot shows its own title and filename; replay before and after restart adds no revision.
- Five static checks pass. Largest assembled judge prompt (functional) is about 51 KB, under half the 128 KB limit.
- Full QC round coldwater-strict-2026-10-08-v16-full (53 rows one after another plus deterministic): 49 Pass, 3 Note (rows 2, 26, 31; P3), 1 Fail (row 28, double penalty in the restart check) fixed in 7a606512 and golden-verified; deterministic 35 Pass, 9 Note, 4 N-A, 0 Fail. The row 28 fix was not re-reviewed by a fresh QC round, by the owner's decision.

Not measured: Oracle and Luna on v16.
