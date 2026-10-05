# Colderwater strict candidate v11, 5 October 2026

- Archive: `colderwater-playground-devtools.zip`
- SHA256: `a2939d182306409fd7e914eef27faeaa8d62431d41699c22e33f48f392bcb2c3`
- Files: 43, single root `colderwater-playground-devtools/`; source commit bc472699 on `task/colderwater-editor-strict`, byte-identical to the committed task.
- Criteria: 1 render gate, 2 constraints gates, 43 Functional (weight 59.0), 6 Polish, 3 Visual.

Portal run on v10 (export in `run-outputs/coldwater-playground-devtools/runs-export`):
- Oracle 0.9681: gates pass, Functional 0.9746 (only `cw_newer_run_supersedes` failed: the judge could not replace the draft within the four-second window, twice), Polish 1.0, Visual 0.9167 (layout 4 of 5: revision history briefly below the fold after opening a snippet).
- Luna 0, not a valid measurement: the agent was killed after about 5 minutes with a network error, and the scored judge then crashed on Polish with "unrecognized_model" for z-ai/glm-5.3-flashx. Luna's app passed both gates.
- nop 0.

Changes from v10:
- Golden: focus returns to the code area after Run, so select-all and typing straight after Run replace the draft.
- Golden: the saved-snippet list scrolls on its own at desktop width, so revision history stays in view.
- `cw_newer_run_supersedes` tells the judge to do Run, replace and Run in one code-runner action with real key presses, using a one-line new draft.
- Judge notes: typing helpers that only work on form fields do not work on the custom editor; type with real key presses.

Scripted golden on v11: 52 of 52 gate, Functional and Polish checks, including a new check that typing straight after Run replaces the draft; hygiene checks pass. No reviewer round on v11. Not measured: Oracle and Luna on v11.
