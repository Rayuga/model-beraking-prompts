# Match persistence

Persist the complete match in browser storage after every accepted change.

Reloading an unfinished round must restore the same board, turn, history,
Undo/Redo availability, starter, and scores. Reloading a completed round must
restore its result and winning cells without counting the result again.
Undo/Redo must remain usable and score-correct after a completed round is
restored.
