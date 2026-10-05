# Colderwater strict candidate v12, 5 October 2026

- Archive: `colderwater-playground-devtools.zip`
- SHA256: `ecb807c05c07706464695a8e75b37fdb6cec8d3848cf455f8f460953ef3beb7b`
- Files: 43, single root `colderwater-playground-devtools/`; source commit b71fdd92 on `task/colderwater-editor-strict`, byte-identical to the committed task.
- Criteria: 1 render gate, 2 constraints gates, 43 Functional (weight 59.0), 6 Polish, 3 Visual.

Quick review of v11 (`qc/runs/coldwater-strict-2026-10-05-r17-quick`, rows 18, 28, 32, 33, 48): 4 Pass, 1 Fail.
- Row 18 drove the v11 golden with the judge's own tool (playwright-mcp 0.0.79): the supersede step now works as instructed in four of four attempts, both gates pass, and a reload with unsaved text raises no dialog.
- Row 18 Fail: v11 had turned off the library's own scrolling at desktop width, so with many snippets and a revision selected the revision details and Restore were clipped and unreachable.

Change from v11: the library scrolls on its own again at desktop width; the snippet list stays capped so history is usually in view. A new scripted layout check selects a revision among six and confirms Restore is reachable by the mouse wheel inside the library.

Scripted golden on v12: 53 of 53 checks (52 gate, Functional and Polish plus the layout check); hygiene checks pass. Observed once in about fifteen runs: the console line written just before an endless loop was missing (`cw_output_before_failure_kept`); it passed on every rerun.

Not measured: Oracle and Luna on v12. v11 is superseded.
