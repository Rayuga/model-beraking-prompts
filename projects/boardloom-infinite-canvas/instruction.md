# Boardloom

Our design reviews have moved to a whiteboard tool that logs everyone into the
same shared workspace, and it has stopped working for us — people open it and
find someone else's half-finished diagram, and nobody trusts that what they drew
is still there tomorrow. I want our own.

Boardloom is an infinite canvas for diagrams, wireframes and sticky notes. You
sign in, you get your boards and nobody else's, and it starts empty — no demo
content, no sample project, nothing we have to delete before we can think.

I have written the rest down in `/instructions/`: `overview.md` is what it is
for, `behaviour.md` is how the canvas has to behave, `security.md` is what must
never leak, `integration.md` is sharing and getting work out, `ui.md` is what it
should feel like, and `policy.md` is how we run things here.
Read all six before you start — they are one description split up, not a menu.

`/app` is empty. Everything is yours to write: the server, the client, the
storage, and the `start.sh` we boot it with. Keep the state on the server, not
in the browser.
