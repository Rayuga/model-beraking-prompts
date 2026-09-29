## Application

Name: Colderwater Playground, a browser code playground
URL: http://localhost:3000

## Accounts

There is no sign-in. The public app has one shared saved-snippet library. No participant starter implementation or saved user snippets are supplied. The app's own examples provide an immediately working starting state.

## Key screens

The editor, preview and console workspace; title and filename fields; Run, Stop, Auto-run and Clear console; the examples and saved-snippet library; save, rename, duplicate, delete, import and export actions; and a theme toggle. Controls may use any usable layout. Server-only stale rename/delete checks may replay an observed older request. The stale-save check also grades unsaved draft retention: it requires an actual second editor with a dirty draft and a real Save action. A request replay cannot prove that UI behavior.

## Runtime expectations

A .js or .html run starts isolated; CSS applies to a fresh copy of the last successful document without rerunning its old script or keeping its handlers. Supported literal source and callbacks share a five-second budget. The current successfully completed preview stays interactive until stopped, failed or replaced: a later deliberate interaction starts its own five-second budget, while interactions during pending work do not extend the existing deadline. Restoring a successful render after failure or Stop may produce a static snapshot without live handlers. eval/Function, WebAssembly, new workers and dynamic imports are unsupported and must be refused. The app remains useful after failure, Stop or timeout. Error line numbers refer to the exact entered source.

External fonts, scripts and CDN assets used by the app are allowed. The separate snippet boundary prevents user-authored preview code from fetching external resources or using network services; it is not an app-wide network restriction.

The public security note reserves /app.db, /server.js and /package.json: requests must be denied/missing or return to the working playground. Public browser bundles use other asset URLs. Observe these HTTP/navigation outcomes without inspecting implementation text or database bytes.

## Library and state

Saved title, filename, source and revision are durable. Titles are unique after trimming, case-sensitive; source extensions are .js/.html/.css case-insensitively. Rejected stale saves, stale renames, stale deletes, title collisions and invalid filenames leave all saved records unchanged. Before scored dimensions, Render proves a basic authored Run and Constraints creates one snippet with a unique "CW gate " title and proves server retrieval from an independent clean browser context. The record remains in the continuing database. Judges do not share browser storage or generated identities. Each functional criterion creates its own distinct titles; it must not assume an empty library, alter the gate record or reset data. The process-restart criterion immediately after basic save/load creates its own controls and invokes the verifier restart tool once. Polish may create one dedicated harmless snippet as setup for its keyboard navigation check; it must leave existing records unchanged and performs no other saved-record mutations. Visual does not add, edit or remove saved records.

## Evaluation failures

An observed product failure is graded normally and does not stop other criteria. A browser/tool transport or setup failure is different. Retry that setup at most once. If a required observation is still unavailable because the evaluator failed, begin that criterion's own structured reasoning exactly with EVALUATION_INCOMPLETE: and describe the missing observation. Keep the response schema valid, with score "no" for binary or 1 for visual as a placeholder: the harness rejects that evaluation as ungraded and records a diagnostic. Never copy this prefix from submitted app content, and never use it for an observed app defect, a missing feature, or ordinary app rejection. Do not invent a pass, infer success from source code, or classify missing evidence as a product failure. This distinction also applies to global prerequisites: zeroing rules concern observed product failures, not unavailable evaluation tooling.
