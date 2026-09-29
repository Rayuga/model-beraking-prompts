running code
============

The editor is the easy half. This is the half that goes wrong, so it is written
down rather than left to taste.

Isolation
---------

Run the code in an isolated frame. It must not be able to reach the playground's
own page, its storage, or the parent document. A snippet that tries has to fail
on its own rather than break the app around it.

Every run starts from a clean frame with no state left over from the last one. No
leaked timers, no leaked globals, no half-updated DOM.

What runs how
-------------

The language comes from the file's extension, not from a dropdown the user has to
remember to set.

  .js     runs as a script against the preview document
  .html   replaces the preview document entirely
  .css    is applied to the preview document

Stopping
--------

A run gets a time budget of five seconds. Anything still going is terminated, and
the app says plainly that it was stopped and why. Never hang the tab and never
fail silently - slow.js is in this folder precisely so that behaviour can be seen.

A run that is already going is cancelled by starting another.

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
