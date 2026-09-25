Gambit Hollow — the club machine
================================

Alec set this box up and left these notes. Nothing here is a preference; it is
what the box will actually run.

Where it goes
-------------

`/home/build/gambit-hollow-board-games`. That exact path — the backup script walks it by name.

What to build it with
---------------------

Plain HTML, CSS and JavaScript on the browser side. No framework, no build step:
the machine has no network once it is up and nobody here can debug a toolchain.
The board and the cards are drawn as inline SVG, which prints properly and which
Marion can read on the big screen.

Express on the server, SQLite on disk. Node is already installed.

How it starts
-------------

    node serve.js

On port 3000. It serves the browser side out of `www/index.html` and keeps its
database at `gambit.db`, both under the root above.

What else is in here
--------------------

`scored-hands.js` — forty hands and their correct totals, with a note on the rule
each one is there to catch. Check your scorer against every line of it.

`house-rules.md` — muggins, the go, and what we do about a tie.

`records/gambit_seed_data.json` — the ladder as it stands. Load it exactly; the
member numbers are on the noticeboard.
