# Running code and keeping work

## Runs and the last good preview

JavaScript runs against a fresh preview document. A complete HTML file replaces that document. CSS runs in a fresh isolated context based on the last successful rendered document and its styles, applying the new stylesheet without rerunning that document's old scripts or inheriting its old JavaScript globals, timers or event handlers. Before any successful render, CSS may use a simple built-in preview document.

Every new run has its own execution state. Starting another run cancels pending work from the previous one, and Stop cancels the current run. Say plainly why work stopped. A stopped or superseded run cannot later add console output, change the current preview or report itself as the current success.

Supported source code and its scheduled callbacks share a five-second execution budget; a callback does not get a fresh five seconds. Literal loops, function bodies and timer or Promise callbacks are part of that budget. Stop work that exceeds it, show a time-limit reason, and keep the surrounding editor usable. The supported execution boundary is described in security.md.

The current run can show its candidate render while it is working. Only a run that completes without an uncaught error becomes the last successful preview. An error, explicit Stop or timeout restores the previous successful render, rather than keeping half of a failed change or clearing it. Report uncaught synchronous errors, timer errors and unhandled Promise rejections in the console. Include the message and the one-based line in the exact user-authored source: HTML line numbers refer to the full entered HTML document, including lines before a script tag, not to an injected wrapper.

Capture console.log, warn, error and info in call order and identify their levels. Objects and arrays can be expanded to inspect their values. Keep prior console entries across runs until Clear console is used. Show a measured run duration. Follow new entries when the view is at the bottom; when someone has scrolled up, leave their view where it is.

Auto-run waits for a brief pause in typing before running, and a later edit resets that waiting period. It should respond within about two seconds of typing stopping. Turning it off cancels an already queued automatic run as well as future ones. Manual Run works with auto-run either on or off.

## The saved library

A snippet has a stable identity, a title, a filename and its exact source text. Save updates the loaded saved snippet; a new draft or duplicate creates a different record. Loading returns all three fields without silently modifying the code. Titles are nonempty and unique after trimming surrounding whitespace, with case-sensitive comparison. Source filenames are single filenames ending in .js, .html or .css, case-insensitively. Invalid filenames or a title already used by another record are refused with a useful message.

Renaming changes only the selected record's title. Duplicating creates a separate record with the chosen new title and the same filename and source; later editing either copy does not alter the other. Cancelling a delete confirmation leaves the library alone. Confirming deletes only the selected record.

Each successful saved change has a revision. An editor sends the revision it loaded when it saves, renames or deletes. If another editor has saved a newer revision, refuse the stale operation without changing any field or revision. Keep the user's unsaved draft so they can compare it with the latest saved content, reload the latest record, then explicitly reapply and save their edit. A stale editor cannot delete newer work or recreate a record that has already been deleted. A rejected title collision or invalid filename is equally atomic: neither record changes.

## Unsaved work and files

Show the loaded snippet's identity and whether there are unsaved changes to its title, filename or source. Warn before loading another snippet, starting a new draft, choosing an example or importing over dirty work. Cancelling the warning keeps the current draft exactly; accepting it actually changes the workspace. A browser reload or leaving the page with dirty work uses the browser's native leave-page warning after the user has interacted with the editor.

Export downloads the current source with its actual filename and exact text. Importing a supported source file brings its filename and exact text into an editable draft that can be saved. Reject unsupported extensions with a useful message and leave the existing draft unchanged. The imported file does not execute until Run or an enabled auto-run requests it. Saving, importing and exporting never execute code on the server.