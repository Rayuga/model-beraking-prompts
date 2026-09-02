# Gameplay

Use a board with seven columns and six rows. A new round contains 42 empty
cells, starts with Red, and visibly says `Red's turn`. Activating a column drops
the current color into its lowest empty cell. Every accepted move alternates
Red and Yellow.

A move into a full column changes neither the board nor the turn and reports
`Column N is full`, using the attempted one-based column number. Detect lines
of four horizontally, vertically, and along both diagonal directions for both
colors.

On a win, show exactly `Red wins` or `Yellow wins`, identify exactly four cells
in the winning line, increment that color's match total once, and reject later
moves without changing the board, result, markers, or totals. When all 42 cells
are occupied without a winner, show exactly `Draw`, increment Draws once, mark
no winning cells, and reject later moves.

New game clears the board, result, feedback, and winning treatment and returns
to `Red's turn`. It preserves Red wins, Yellow wins, and Draws.
