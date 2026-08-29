# Gameplay

Use a board with exactly seven columns and six rows. Red starts the first
round, and accepted moves alternate between Red and Yellow. Selecting a column
drops one piece into its lowest free cell, so pieces stack without floating or
leaving gaps.

A full column must reject another move visibly without changing the board,
turn, history, or scores. After each accepted move, detect horizontal,
vertical, and both diagonal forms of four connected pieces. Keep the four
winning cells visibly recognizable. A full board without a winner is a draw.

Once a round is won or drawn, refuse further board moves until the result is
undone, the next round starts, or the match is reset. Record a terminal result
in the running score exactly once.
