## Application

Name: Colderwater Playground, a browser code playground
URL: http://localhost:3000

## Accounts

There is no sign-in. The public app has one shared saved-snippet library. No participant starter implementation or saved user snippets are supplied. The app's own examples provide an immediately working starting state.

## Key screens

The editor, preview and console workspace; title and filename fields; Run, Stop, Auto-run and Clear console; the examples and saved-snippet library; save, rename, duplicate, delete, import and export actions; and a theme toggle. Controls may use any usable layout. Separate browser contexts are not required for revision checks: two independently captured versions of the same saved record also work.

## Runtime expectations

A .js or .html run starts isolated; CSS applies to a fresh copy of the last successful document without rerunning its old script. Supported literal source and callbacks have a five-second budget. eval/Function, WebAssembly, new workers and dynamic imports are unsupported and must be refused. The app remains useful after failure, Stop or timeout. Error line numbers refer to the exact entered source.

External fonts, scripts and CDN assets used by the app are allowed. The separate snippet boundary prevents user-authored preview code from fetching external resources or using network services; it is not an app-wide network restriction.

## Library and state

Saved title, filename, source and revision are durable. Titles are unique after trimming, case-sensitive; source extensions are .js/.html/.css case-insensitively. Rejected stale saves, stale renames, stale deletes, title collisions and invalid filenames leave all saved records unchanged. Before scored dimensions, Render proves a basic authored Run and Constraints creates one snippet with a unique "CW gate " title and proves server retrieval from an independent clean browser context. The record remains in the continuing database. Judges do not share browser storage or generated identities. Each functional criterion creates its own distinct titles; it must not assume an empty library, alter the gate record or reset data. The last persistence criterion creates its own controls and invokes the verifier restart tool once. Polish and Visual do not add, edit or remove saved records.
