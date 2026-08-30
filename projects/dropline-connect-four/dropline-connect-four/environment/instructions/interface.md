# Interface

Keep turn, terminal result, invalid-move feedback, Red wins, Yellow wins, and
draws easy to scan. Give Undo, Redo, Next Round, and Reset Match familiar,
visible controls with correct disabled states.

Each board cell needs an accessible name that identifies its row, column, and
empty, Red, or Yellow state. Tokens should also include a non-color identity so
that color is not the only way to understand the board. While a result is
active, the four winning cells must also identify themselves as winning in
their accessible names.

Use a short, finite drop transition for accepted pieces and a clear treatment
for winning pieces. Respect reduced-motion preferences by suppressing
nonessential motion without changing game behavior.

The board and primary controls must remain visible and usable without
horizontal page overflow at a 375-pixel viewport. Use a restrained game-focused
visual design with clear hover and focus states.
