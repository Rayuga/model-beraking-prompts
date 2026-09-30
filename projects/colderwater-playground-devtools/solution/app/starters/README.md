Starters
========

Five files that ship with the playground and load as examples. Three work, two
are here because they misbehave and the playground has to cope.

  hello.js       Prints twelve lines and logs once.
  counter.html   A whole document: markup, a little CSS and a script together.
  sheet.css      A stylesheet for the built-in sample page.
  broken.js      Throws a TypeError on line 4. `forEeach` is not a function.
  slow.js        An infinite loop. It must be stopped and reported as stopped,
                 not left to hang the tab.

Language is decided by the extension, not by a dropdown the user has to remember
to set: .js runs as script, .html replaces the whole preview document, .css styles a built-in sample page.

How the playground has to run them
----------------------------------

Isolation, the five-second budget, error reporting and the console are written up
in running-code.md, in this folder. broken.js and slow.js are here so that
behaviour has something to be tested against.
