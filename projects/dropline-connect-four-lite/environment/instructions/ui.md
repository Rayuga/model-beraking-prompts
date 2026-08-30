# Interface

Represent the board as an accessible grid of 42 cells whose accessible names
identify row, column, and whether the cell is empty, Red, or Yellow. Include
`winning` in the accessible names of the four pieces that complete a win.

Provide seven visible buttons named `Drop in column 1` through
`Drop in column 7`. Support pointer play and keyboard play: Left and Right move
focus among the column buttons, Home and End move to the first and last column,
and Enter or Space drops in the focused column. Keep focus usable as play
continues.

Show `Red's turn` or `Yellow's turn` during play and keep result and invalid
move feedback easy to notice. At a 375-pixel viewport, the full board, all seven
column controls, status, and `New game` control must remain visible and usable
without horizontal page scrolling.
