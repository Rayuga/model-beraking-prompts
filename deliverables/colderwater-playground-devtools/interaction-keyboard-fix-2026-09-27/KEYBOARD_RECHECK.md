# Colderwater: keyboard coverage and golden follow-through

The existing Polish criterion now observes the promised pointer-free workflow. Its four binary criteria still total 4; Functional remains 33 criteria with total weight 49.5. This is a coverage correction, not a new exact keyboard binding or a repeated Functional shortcut/persistence test.

## Change and independent review

`labelled_controls_and_focus` now begins at an ordinary desktop viewport and prepares one recognisable harmless record through the UI. Empty libraries are valid. Its graded read flow uses keyboard events only: leave the editor, use the example picker, observe a different example, load the judge's own saved record from the library, and return to the editor. Main enabled controls must be reachable with visible focus. Native dropdown keys and an app-documented editor escape are accepted; legitimate disabled controls need not be tab stops, and ordinary unsaved-work warnings may be handled by keyboard. No fixed labels, layout, binding, database identity, or shortcut implementation is prescribed. No mutation is required after preparation.

The Polish prompt permits this one preparation independently of the global persistence prerequisite. The separate shared-context owner aligned the injected app context with that permission. Another agent independently reviewed the wording, including desktop state, disabled controls, and injected-context consistency.

## Proven golden gap and minimal repair

The baseline browser probe proved that CodeMirror's existing Escape, then Tab sequence already left the editor without changing source. However, the UI documented Tab indentation without telling users how to leave the editor. The golden now adds that escape hint to the existing footer and attaches it to the editor through `aria-describedby`. No key handlers, runtime semantics, server code, CSS, dependencies, or installer logic changed.

The build used the existing lockfile with `npm ci --ignore-scripts --no-audit --no-fund`, followed by `npm run build`: Vite 7.1.7 and TypeScript 5.9.2. `keyboard-built-inputs.json` records the actual compiler inputs and outputs. `keyboard-evidence-binding.json` asserts every recorded input/output matches the final task source, and verifies the only solution changes are `src/app.tsx`, `public/index.html`, and replacement of the old JavaScript asset with `index-XwoWsDAE.js`. The CSS asset is byte-identical.

## Fresh observations

The exact flow ran against a new, isolated golden installation and empty SQLite database in Chromium 152.0.7977.8. All five groups in `keyboard-proof-results.json` passed:

1. The editor's accessible description points to visible keyboard help. Browser-served JavaScript and CSS hashes match the pinned build and final source.
2. An initially empty library was populated with one dedicated snippet using normal UI actions. The criterion depended on no previous judge record.
3. Thirty-one real keyboard events left the editor, reached primary controls with visible focus, opened the native example picker, selected `counter.html`, opened the prepared record from the saved library, and returned to the editor. The original title, filename and source were restored. There were no pointer actions, programmatic focus calls, DOM clicks, or API calls during that route, and no writes during the route. A native unsaved-work dialog was not needed in this golden flow; the rubric permits one for implementations that use it.
4. An authored Run after returning to the editor still rendered its marker and printed it in the console.
5. The updated help was readable at 1440-pixel desktop and 390-pixel mobile widths in both themes. It wrapped to two lines on mobile, stayed within the viewport after ordinary scrolling, and caused no horizontal page overflow. Measured text contrast was 7.56:1 in dark mode and 4.56:1 in light mode. Screenshots were also visually inspected.

No browser page errors occurred. The proof records the full action/focus trace and saves screenshots of selection, library focus, editor return, and each viewport/theme.

## Evidence scope

The fresh checks above cover the changed UI and Polish workflow. Previous full golden/runtime, backend, restart, privacy, and installer evidence is reused only for unchanged files, as listed by `keyboard-evidence-binding.json`. The semantics agent separately supplies fresh proof for the revised completed-preview interaction wording. This report does not claim a hosted Oracle score or repeat every unchanged functional test; no paid judge or model run was made.

Both task-owned disposable keyboard containers were stopped and removed after evidence capture; earlier shared containers and databases were untouched.
