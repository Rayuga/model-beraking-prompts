# Task List

1. ✅ Inspect environment and design PatchPad architecture
Empty /app; seed at /assets; Node 22 built-in SQLite available. Chose custom focusable DOM line renderer with owned model and overlays.
2. ✅ Implement SQLite persistence, idempotent seeding, revisions, and conflict-safe API
Built Node HTTP server, transactional SQLite schema/seeding, revision APIs, strict stale/mismatched/unknown ID rejection.
3. ✅ Implement custom DOM editor model and interaction behavior
Implemented owned string/range model, line renderer, pointer/keyboard selection, multicarets, clipboard, autoscroll, and snapshot undo/redo.
4. ✅ Implement find/replace, saving, revision preview/restore, and UI states
Added discoverable controls, dirty/conflict states, find/replace, revision list, non-destructive preview and restore-as-unsaved flow.
5. ✅ Test startup, API invariants, and browser-facing assets
Verified 1,223-line render, typing, multicaret one-step undo, replace-all undo, revision persistence, stale conflict UI/API, ID rejection, and restart idempotency.
6. ✅ Add APP_MANIFEST and finalize package metadata
Added required fenced start block, DB path, routes, npm start, and gitignore.
