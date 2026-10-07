# Colderwater strict candidate v14, 7 October 2026

- Archive: colderwater-playground-devtools.zip
- SHA256: 1e683f4c0aae55a4f3603c3cddf2afc55db81f5aca8a8e7ca4d250d6fff021de
- Source commit: 641fad52 on task/colderwater-editor-strict; 43 files, LF, byte-identical to the committed task.

Why: the v13 portal run gave GPT-5.6 Luna 0 at the constraints gate. Luna's editor threw on every keystroke and paste (insertText called normalizeSelections() with no argument), so the app was shipped without being tried once.

Change from v13 (only instruction.md): one sentence appended asking the builder to check the app the way the user will use it: type into the editor, run the code and save a snippet, and make sure nothing breaks. No criterion, gate, prompt or golden file changed.

Checks on these bytes:
- Scripted golden: 53 of 53 (21 editor, 15 runtime, 9 persistence with a real restart, 8 polish/layout), no page errors.
- Five static checks pass (criterion ids, grader terms, network policy, structural, current).
- Quick review qc/runs/coldwater-strict-2026-10-07-v14-quick, rows 1, 2, 5 and 6 (instruction text): all Pass, no risk. Row 6 notes an internal workbook annotation saying "with no network"; the shipped row and skill allow public network, which the self-check relies on.

Not measured: Oracle and Luna on v14. The sentence is a nudge, not a guarantee that Luna tests its app.
