# Move history, undo, and redo

Show the current round's applied moves in chronological order. Each entry names
its move number, color, one-based column, and one-based landing row. An accepted
move is added only after the server persists it.

Undo removes the most recent applied move and gives the turn back to that
piece's color. Redo restores the exact undone move. Support repeated undo and
redo, keep both actions account-scoped, and make their availability clear.

Undoing a winning or drawing move returns the round to active play, clears its
winning treatment, and reverses that one score increment. Redoing it restores
the same result, markers, and score exactly once.

After an undo, any new accepted move clears the redo stack. New game clears the
board, result, feedback, applied history, and redo stack while preserving match
totals. Refused undo or redo attempts change nothing.
