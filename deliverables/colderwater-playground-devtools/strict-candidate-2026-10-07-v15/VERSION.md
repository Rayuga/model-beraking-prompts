# Colderwater strict candidate v15, 7 October 2026

- Archive: colderwater-playground-devtools.zip
- SHA256: 6d542e9db39b3e52723405e3fceb56494948b4917749c4407973aaba5af4098d
- Source commit: 4f93e7cd on task/colderwater-editor-strict; 43 files, LF, byte-identical to the committed task.

Why: the v14 hosted Oracle scored 0.9441 (Functional 0.9068; Polish, Visual and both gates 1.0). It lost only cw_multi_caret_typing_atomic, cw_multi_caret_delete and cw_same_line_carets: the judge reported every Alt/Ctrl/Meta+Click "just moved the single caret". Locally the golden adds carets with the click tool's modifiers option, keyboard.down plus mouse.click, Meta and ControlOrMeta; only pressing and releasing Alt before an ordinary click gives one caret. Earlier Oracle runs passed these criteria, so this is judge input variance.

Change from v14 (only tests/app_context.md): one note saying a modifier-click holds the key during the click, how to do it with the click tool or the code runner, and to aim at the character position and count carets before typing. No criterion, gate, brief or golden file changed.

Checks: five static checks pass; golden code unchanged since the v14 scripted run (53 of 53). Quick review qc/runs/coldwater-strict-2026-10-07-v15-quick rows 25, 32, 48: all Pass (row 32 risk only because no judge run has exercised the note yet).

Not measured: Oracle and Luna on v15.
