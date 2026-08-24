# Task List

1. ✅ Inspect repository, seed data, and existing application architecture
Workspace is empty; seed inspected; Node 22 built-in SQLite is available.
2. ✅ Implement SQLite schema, idempotent seed, APIs, revisions, history, and conflict-safe saves
SQLite schema, idempotent seed, strict validation, history APIs, immutable revisions, and cell-level conflict merge implemented.
3. ✅ Implement custom spreadsheet grid, selection, editing, clipboard, fill, undo/redo, find/replace, and navigation
100x26 div grid, floating cell editor, keyboard/mouse range selection, clipboard, clear, grouped fill, undo/redo, find/replace, and name box implemented.
4. ✅ Implement formula parser/evaluator and formula editing assistance
Parser supports arithmetic, references, ranges, five functions and visible errors; suggestions and grid reference insertion/highlighting implemented.
5. ✅ Implement seeded-user login, live presence, remote updates, merging, and conflict UX
Seeded user switcher, independent SSE sessions, per-user view counts, distinct selection colors, multi-color overlaps, remote merges and conflict drafts implemented.
6. ✅ Implement autosave states, revision history, preview, and undoable restore drafts
Debounced autosave and explicit save states, revision list, timed previews, and grouped undoable restore drafts implemented.
7. ✅ Add APP_MANIFEST.md and verify startup contract
Manifest documents fenced start command, /app/gridforge.sqlite, and all main API routes.
8. ✅ Run automated and manual-oriented verification for core behavior and security boundaries
Clean revision-1 startup, static syntax, formula suite, idempotency, save deduplication, merge/conflict, invalid id/base, and metadata rejection checks pass.
