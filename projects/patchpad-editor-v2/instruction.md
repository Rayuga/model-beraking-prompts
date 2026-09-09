# PatchPad Editor

I want to build PatchPad, a browser-based editor for long incident reports. The
main work is the editing experience, revision history, and safe persistence.

The brief is split into these files under `/instructions/`:

- `overview.md` - product scope, seed data, stack, and editor foundation
- `editing.md` - everyday editing, selection, clipboard, and multiple carets
- `persistence.md` - find and replace, saving, and revision history
- `conflict-safety.md` - concurrent and invalid save protection
- `interface.md` - visible controls and feedback

Please read all of them before starting. Seed data is available at
`/assets/incident_seed.json`.
Network access is available during setup and development. The seed and required
dependencies are provided in the image. Keep the delivered app self-contained:
opening or running it must not fetch network assets or install packages.
Put the finished app in `/app` and start it with `npm start` on port `3000`.
Include `APP_MANIFEST.md` with the start command and SQLite database path.
