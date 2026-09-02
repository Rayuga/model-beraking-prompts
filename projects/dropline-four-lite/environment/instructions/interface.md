# Interface and accessibility

Expose the board as one accessible grid with exactly 42 grid cells. Every
cell's accessible name includes its one-based row, one-based column, and
`empty`, `Red`, or `Yellow` state. A winning cell's name also includes
`winning`; other cell names do not.

Provide seven visible controls named `Drop in column 1` through
`Drop in column 7`. Pointer activation attempts a move. While a column control
has focus, Left and Right move focus one column without wrapping, Home moves to
column 1, End moves to column 7, and Enter or Space drops in the focused column.
Keep focus usable after a keyboard move.

Keep identity, sign-out, current turn or result, invalid-move feedback, Red
wins, Yellow wins, Draws, New game, move history, Undo, and Redo readable and
discoverable. At 375 pixels wide, both sign-in and the complete game must stay
usable without horizontal page scrolling, clipped controls, or overlapping
text. Honor `prefers-reduced-motion` while keeping changes understandable.
