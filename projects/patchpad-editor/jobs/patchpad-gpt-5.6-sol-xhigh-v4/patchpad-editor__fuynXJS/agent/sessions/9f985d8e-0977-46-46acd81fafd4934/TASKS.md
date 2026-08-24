# Task List

1. ✅ Inspect repository, seed schema, and existing application structure
Empty /app; seed at /assets/incident_seed.json has structured metadata and generated/tail sections.
2. ✅ Implement SQLite initialization, idempotent seed, revisions, and conflict-safe APIs
Node built-in SQLite, transactional idempotent seed, strict save/restore revision checks.
3. ✅ Implement custom DOM editor model, rendering, input, selection, clipboard, undo/redo, and multi-carets
Virtualized normal-DOM editor with owned model, pointer/keyboard selection, clipboard, atomic history, and carets.
4. ✅ Implement find/replace, save status, revision preview/restore, and visible errors
Find cycle, replace actions, save/dirty/conflict UI, and non-destructive history previews/restores.
5. ✅ Add package start command and APP_MANIFEST.md
Start command, DB path, and routes documented.
6. ✅ Run automated tests and manually verify critical API/editor behavior
Syntax checks and isolated API assertions passed: 1,226-line seed, restart idempotency, unchanged saves, stale/mismatch/unknown rejection, restore history, and forbidden-surface scan.
