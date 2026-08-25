# PatchPad editor

Build PatchPad, a browser-based editor for long incident reports. It should
feel like a real editor, not a CRUD form around a text field.

The complete brief is in `/instructions/`. Read every file before starting:

- `overview.md` - product scope, seed data, stack, and custom editor rules
- `editing.md` - cursor, selection, clipboard, undo/redo, and multi-caret behavior
- `persistence.md` - find/replace, saving, and revision history
- `conflict-safety.md` - stale and malformed save protection
- `interface.md` - visible controls and feedback

These files are one brief split by topic. None of them is optional.

Seed data is under `/assets/incident_seed.json`. Nothing in the finished app
should depend on somebody knowing a hidden route, request shape, or element id.
