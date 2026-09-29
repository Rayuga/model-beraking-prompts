# Running code and keeping work

## The preview

A JavaScript run starts with a fresh preview document. A complete HTML file replaces it. For CSS, use a fresh isolated copy of the last successful document and its styles, then apply the new stylesheet. Don't rerun that document's old scripts or keep its active timers or event handlers. Before anything has rendered successfully, a simple built-in document is fine for trying CSS.

Starting another run cancels whatever the previous one still had pending. Stop does the same for the current run; when I use it, show that I stopped the run. Old work mustn't come back later with a log entry, replace the current preview or claim to be the current success.

Give each run five seconds altogether, including its scheduled callbacks. A timer doesn't get a new five seconds when it fires. This covers source-written loops, functions and timer or Promise callbacks. If it takes too long, stop it, show a time-limit reason and leave the editor usable. The limits of that promise are in /instructions/security.md.

Keep the current successfully completed preview interactive until I stop it, it fails or another run replaces it. I might leave it there for a while before clicking a button or typing into a field. A stopped, timed-out or replaced preview must never start working again.

It's fine to show a run's candidate preview while it works. It becomes the last good preview only when it finishes without an uncaught error. If it fails, is stopped or runs out of time, bring back the previous successful render. I don't want half of the failed attempt left behind. That restored picture can be static; I can run the source again when I want its handlers back.

Errors need the message and a one-based line number from the source I actually entered. For HTML, count from the beginning of the complete document, including the lines before a script tag. The same applies to errors thrown later by a timer and to unhandled Promise rejections; both belong in the console and should restore the good preview.

## Console and automatic runs

Capture log, warn, error and info calls in order and make their levels clear. I need to open up objects and arrays to inspect their values. Keep the old entries between runs until I use Clear console, and show how long each run took.

Auto-run should wait for a short pause in typing, with each later edit starting that wait again. About two seconds after I stop typing is plenty. Switching it off should cancel a queued automatic run too. The ordinary Run action works whether auto-run is on or off.

## Saved snippets

A saved snippet has an identity, a title, a filename and its exact source. Save updates the record I'm editing. A new draft makes a separate record. Loading should bring back the title, filename and source unchanged.

Titles can't be empty. Trim spaces at their edges and keep them unique, comparing capitals as written: `Sketch` and `sketch` are different titles, while ` Sketch ` and `Sketch` aren't. Use .js, .html or .css source filenames, case-insensitively. Explain a rejected title without changing any saved record.

Two editors may have the same saved snippet open. Each successful saved change gets a revision, and Save refers to the revision that editor loaded. If another editor has moved it on, refuse the old operation without changing any field or revision. Keep my unsaved work so I can compare it with the latest copy, reload that copy and deliberately reapply my edit.
