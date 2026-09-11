# What must not leak, and what must not move

Boards belong to the account that made them. Another signed-in person asking for
one of mine is turned away, not handed a copy.

Anything smaller than 20 across is a mis-drag, not a shape. Refuse it, and say so.

Locking is what stops the person zooming out from nudging the diagram somebody
spent an hour on. Once an object is locked, it cannot be moved — not by dragging
it, not by any other route — and the app says plainly that it is locked rather
than failing quietly or, worse, moving it anyway. Unlock it and it moves again.

Archiving works the same way. An archived board is read-only: nothing can be
added to it or changed on it, and the app explains why rather than just refusing.
Restore it and it accepts changes again.

Both of these should fail closed. A refusal that does not say what rule it broke
leaves the person staring at a board wondering what they did wrong.
