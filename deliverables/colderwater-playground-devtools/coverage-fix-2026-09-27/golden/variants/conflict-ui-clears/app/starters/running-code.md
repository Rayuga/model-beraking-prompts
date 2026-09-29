running code
============

The editor is the easy half. This is the half that goes wrong, so it is written
down rather than left to taste.

Isolation
---------

Run the code in an isolated frame. It must not be able to reach the playground's
own page, its storage, or the parent document. A snippet that tries has to fail
on its own rather than break the app around it.

JavaScript and HTML runs start with a fresh document. CSS runs use a fresh copy
of the last successful document and styles without rerunning its scripts. No
old event handlers, timers or globals carry into the new frame. Authored snippets
cannot request external resources or network services.

What runs how
-------------

The language comes from the file's extension, not from a dropdown the user has to
remember to set.

  .js     runs as a script against the preview document
  .html   replaces the preview document entirely
  .css    styles a fresh copy of the last successful preview document

Stopping
--------

Supported JavaScript includes literal loops and functions, ordinary DOM changes,
timers and Promise callbacks, plus inline classic scripts in complete HTML.
Dynamic eval/Function execution, WebAssembly, additional workers and dynamic
imports are outside this playground and must be refused clearly. Those words
remain valid in ordinary strings, comments and HTML text.

A supported run has one five-second budget, including time spent waiting for its
timers and callbacks. Work still running at that limit is stopped with a clear
reason while the surrounding app stays usable. slow.js demonstrates a supported
literal infinite loop. This is not a promise to interrupt arbitrary native
operations or unsupported generated code.

Starting another run cancels the previous run and prevents its late output from
replacing the new result. Stop cancels the active run, explains why it stopped
and restores the last completed successful preview.

Errors
------

An uncaught error is reported in the console with its message and its line number
in the user's code, not in whatever wrapper the playground put around it.

The preview keeps showing the last good render rather than going blank. A broken
edit should not lose what was on screen a second ago.

The console
-----------

It captures log, warn, error and info, in the order they happened.

Objects and arrays are expandable rather than printed as [object Object].

It shows how long the run took, it can be cleared, and it stays scrolled to the
newest entry unless the user has scrolled up - in which case leave them where
they are.

Auto-run
--------

Runs as the user types, debounced, with a switch to turn it off and run manually.
The switch has to actually stop the debounce rather than just hiding the
indicator.
