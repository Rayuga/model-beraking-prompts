# Interface

Keep the editor usable in a normal browser. Show the seeded report, editing
surface, save state, revision, cursor position, and clear feedback when an
action or save fails.
Keep the supplied report title, "Northwind API Incident Report", visible in
the editor interface while the report is open, so people can identify what
they are editing.

Make Save, Undo, Redo, Find Next, Replace Current, Replace All, and revision
history easy to discover. Keep labels, keyboard focus, errors, and history
entries readable and consistent. Nothing should depend on hidden routes, magic
element ids, or separate usage instructions.

Give PatchPad a coherent visual design: readable typography, clear contrast,
consistent spacing and alignment, and a clear hierarchy between the report
title, editing controls, document, feedback and revision history. Carry the
same component styling through history entries and previews.

Keep the interface readable at desktop size (1280 by 800).
Controls and history can wrap; long report
lines and previews may scroll inside their own areas. Avoid page-wide overflow,
clipped controls and overlapping text. A single well-designed theme is enough.
