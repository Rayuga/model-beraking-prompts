# Colderwater strict candidate v13, 7 October 2026

- Archive: colderwater-playground-devtools.zip
- SHA256: 21bf8868f64d4054c92aaf3158747b13f075204635affd5481b7949088fed956
- Source commit: 06f79bf7 on task/colderwater-editor-strict; 43 files, byte-identical to the committed task.

Why: the v12 portal run gave GPT-5.6 Luna 0 at the render gate. Luna's editor loses focus when clicked, so typed keys did not land; its constraints gate passed. Reproduced locally on Luna's exported app.

Changes from v12 (gates only, nothing made harder):
- Render gate is now load and reload only (cw_workspace_loads_and_reloads); no typing.
- The in-dimension gate of Functional, Polish and Visual only requires the workspace to load with a code editing area.
- Constraints gate: text may be typed or pasted; the editor-surface check inspects the source already shown if neither works.
- Typing is now graded only inside the scored criteria.

Scripted golden: 53 of 53; static checks pass. No reviewer round on v13. Not measured: Oracle and Luna on v13.
