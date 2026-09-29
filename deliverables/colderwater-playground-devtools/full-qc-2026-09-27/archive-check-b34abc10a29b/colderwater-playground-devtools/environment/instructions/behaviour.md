# Running code and keeping work

## The preview

A JavaScript run starts with a fresh preview document. A complete HTML file replaces it. For CSS, use a fresh isolated copy of the last successful document and its styles, then apply the new stylesheet. Don't rerun that document's old scripts or bring along its globals, timers or event handlers. Before anything has rendered successfully, a simple built-in document is fine for trying CSS.

Starting another run cancels whatever the previous one still had pending. Stop does the same for the current run; when I use it, show that I stopped the run. Old work mustn't come back later with a log entry, replace the current preview or claim to be the current success.

Give supported code five seconds altogether, including its scheduled callbacks. A timer doesn't get a new five seconds when it fires. This covers source-written loops, functions and timer or Promise callbacks. If the run takes too long, stop it, show a time-limit reason and leave the editor usable. The limits of that promise are in /instructions/security.md.

It's fine to show a run's candidate preview while it works. It becomes the last good preview only when it finishes without an uncaught error. If it fails, is stopped or runs out of time, bring back the previous successful render. I don't want half of the failed attempt left behind.

Errors need the message and a one-based line number from the source I actually entered. For HTML, count from the beginning of the complete document, including the lines before a script tag. The same applies to errors thrown later by a timer and to unhandled Promise rejections; both belong in the console and should restore the good preview.

## Console and automatic runs

Capture log, warn, error and info calls in order and make their levels clear. I need to open up objects and arrays to inspect their values. Keep the old entries between runs until I use Clear console, and show how long each run took. Follow new entries when I'm at the bottom; if I've scrolled up to read something, leave the view there.

Auto-run should wait for a short pause in typing, with each later edit starting that wait again. About two seconds after I stop typing is plenty. Switching it off should cancel a queued automatic run too. The ordinary Run action works whether auto-run is on or off.

## Saved snippets

A saved snippet has an identity, a title, a filename and its exact source. Save updates the record I'm editing. A new draft or duplicate makes a separate record. Loading should bring back the title, filename and source unchanged.

Titles can't be empty. Trim spaces at their edges and keep them unique, comparing capitals as written: `Sketch` and `sketch` are different titles, while ` Sketch ` and `Sketch` aren't. Source filenames are single filenames with .js, .html or .css extensions, case-insensitively. Explain a rejected title collision or unsupported filename without changing either saved record.

Rename changes only the selected record's title. A duplicate starts with its chosen new title and the original filename and source, but subsequent edits to either copy stay independent. Ask before deleting; cancelling leaves the library alone, and confirming removes only that record.

Two editors may have the same saved snippet open. Each successful saved change gets a revision, and saving, renaming or deleting refers to the revision that editor loaded. If another editor has moved it on, refuse the old operation without changing any field or revision. Keep my unsaved work so I can compare it with the latest copy, reload that copy and deliberately reapply my edit. An old editor mustn't delete newer work or recreate something that's already been deleted.

## Unsaved work and files

Make it clear which snippet I'm editing and whether its title, filename or source has unsaved changes. Warn before loading another snippet, choosing an example, starting a new draft or importing over that work. Cancelling keeps the exact draft; accepting really moves to the chosen destination. After I've interacted with the editor, a browser reload or leaving the page should also show the browser's own leave-page warning for dirty work.

Export downloads the current source under its actual filename, with the text unchanged. Import brings a supported file's filename and exact text into an editable draft that I can save. Refuse unsupported extensions with a useful message and leave my existing draft alone.

Importing isn't permission to execute a file. With auto-run off, it stays unrun until I choose Run. Enabled auto-run can request it in the usual way. Saving, importing and exporting must never execute my source on the server.
