# Seed records, archive, and replay

Import every workbook board, score, applied history, redo history, revision,
and completed match on first database creation. The accounts
intentionally start differently; do not replace them with generic empty state.

Archive every win or draw exactly once for its round. Show the total record
count and the latest ten newest first with result and move count. Each provides a separate read-only 42-cell
replay with empty step, every move, a range step control, Previous, Next, and
Close; every replay control must be keyboard usable.
Replay cells name their coordinates and state and never replace or mutate the
active board. Undoing a terminal move removes that round; redoing it restores
exactly one identical entry. Archive data survives New game, reload, sign-out,
and later sign-in and stays account-scoped.

Show revision, archive, and replay clearly. At 375 pixels wide the active board,
archive, replay, and all controls remain usable without horizontal overflow.
