## Application

Name: Colderwater Playground, a browser code playground
URL: http://localhost:3000

## Accounts

There is no sign-in. The public app has one shared saved-snippet library. No participant starter implementation or saved user snippets are supplied. The app's own examples provide an immediately working starting state.

## Key screens

The editor, preview and console workspace; title and filename fields; Run, Stop, Auto-run and Clear console; examples, a saved-snippet library, New and Save; and a theme toggle. Controls may use any usable layout. Stale Save has independent server-refusal and dirty-editor recovery outcomes. Use two actual editors with recorded dirty title, filename and source. An enabled UI attempt or clear proactive conflict prevention with exact draft retention is valid. Do not force disabled controls. A request replay alone cannot prove dirty-editor behavior; replay the observed old-revision request separately when prevention suppresses it. No specific recovery control is required.

## Runtime expectations

Auto-run preparation: when another criterion says to turn Auto-run off, disable it if that control is available. Its absence belongs to the Auto-run outcomes and must not by itself fail Render, Constraints or unrelated checks. Use the actual manual Run and observed stable source/output for those checks; do not infer a product failure merely because this convenience setting is missing. This does not excuse a broken manual Run or missing required output.

A .js or .html run starts isolated; CSS applies to a built-in sample page. Supported literal source and callbacks share a five-second budget. A timed-out run shows a time-limit reason; stopped, timed-out or replaced work cannot later affect the current preview, console or run status. Judge these bounded visible effects with the required successful execution controls, not hidden execution-state claims. The current successfully completed preview stays interactive until stopped, failed or replaced: ordinary click, key and input handlers remain usable after an idle interval. Pending candidate changes may be shown or kept hidden behind the last-good render, and further preview input may be temporarily ignored or blocked. Restoring a successful render after failure or Stop may produce a static snapshot without live handlers. Stop on a completed preview retains its actual successful visible picture while preventing its old handlers from affecting the workspace. eval/Function, WebAssembly, new workers and dynamic imports are unsupported and must be refused. The app remains useful after failure, Stop or timeout. Error line numbers refer to the exact entered source.

External fonts, scripts and CDN assets used by the app are allowed. The separate snippet boundary prevents user-authored preview code from fetching external resources or using network services; it is not an app-wide network restriction.

## Library and state

Saved title, filename, source and revision are durable. Titles are unique after trimming, case-sensitive; source extensions are .js/.html/.css case-insensitively. Rejected stale saves and invalid titles leave all saved records unchanged. Before scored dimensions, Render proves a basic authored Run and Constraints creates one snippet with a unique "CW gate " title and proves server retrieval from an independent clean browser context. The record remains in the continuing database. Judges do not share browser storage or generated identities. Functional follows the shared scenario plan with distinct scenario-owned titles. Several independent outcomes may use the same actually observed fixture or fact; never inherit another outcome's verdict. Keep valid sibling observations after a failure, but refresh invalidated record state and revisions before proceeding. Do not assume an empty library, alter the gate record or reset data. The early process-restart scenario follows basic save/load, creates its own ordinary New/Save controls, and invokes the verifier restart tool once. Polish may create one dedicated harmless snippet as setup for its keyboard navigation check; it must leave existing records unchanged and performs no other saved-record mutations. Visual does not add, edit or remove saved records.

## Evidence failures

Score observed application behavior independently. Retry a transient evaluator operation once when safe; never repeat a completed saved write or the single process restart. If observation remains unavailable, state exactly what could not be observed and distinguish a tool failure from a product failure. Do not invent a pass or a special reasoning prefix. Return supported outcomes for the remaining criteria; an unavailable observation must not erase unrelated observed credit. The standard RewardKit/scorer handles returned results. This does not guarantee recovery from a whole judge-process timeout.
