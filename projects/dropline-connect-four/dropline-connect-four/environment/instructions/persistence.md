# Match persistence

Persist the complete match in browser storage after every accepted mutation.
Use a versioned `dropline:v1` value containing the 42 row-major board cells,
current player, round starter, round status, exact winning cells, move history,
Redo entries, and Red-win, Yellow-win, and draw counters.

Reloading an unfinished round must restore the same board, turn, history,
Undo/Redo availability, starter, and scores. Reloading a completed round must
restore its result and winning cells without counting the result again.
Undo/Redo must remain usable and score-correct after a completed round is
restored. Reset Match must also survive reload.
