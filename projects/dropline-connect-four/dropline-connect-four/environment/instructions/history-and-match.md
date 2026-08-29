# History and match controls

Show every accepted move in order with its move number, player color, and
one-based column. Rejected moves do not belong in history.

Provide visible Undo and Redo controls. Undo removes exactly the latest piece
and its history entry, then returns the turn to the player whose piece was
removed. Redo restores that exact piece and advances the turn again. A
different accepted move after Undo invalidates the abandoned Redo.

Undo and Redo must restore the complete board and match state consistently,
including when a move completes a round.

After a completed round, Next Round clears the board and round history while
preserving the scoreboard. The starting color alternates from one round to the
next. Reset Match clears the board, history, Redo state, and every score, then
returns to a first round started by Red.
