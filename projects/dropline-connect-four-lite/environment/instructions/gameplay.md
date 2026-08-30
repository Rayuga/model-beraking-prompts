# Gameplay

Use a standard board with seven columns and six rows. Red moves first, Red and
Yellow alternate after every accepted move, and each piece occupies the lowest
empty cell in its selected column. Attempting a full column changes neither the
board nor the turn and visibly reports `Column N is full`.

Detect four connected pieces horizontally, vertically, and along both diagonal
directions. A win shows `Red wins` or `Yellow wins`, identifies exactly four
winning pieces, and prevents later moves. A full board without a winner shows
`Draw` and also prevents later moves. A `New game` control clears the board and
returns to `Red's turn`.
