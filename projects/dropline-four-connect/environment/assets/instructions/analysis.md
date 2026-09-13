# Explore a completed game

After a match, I want to explore alternatives without changing its result.
Let me choose any replay step, including zero or the final move, and create
a named analysis there. Trim surrounding whitespace from names; accept 1 to
60 characters. Separate analyses may have the same name. Start with no seeded
analyses. Keep them private to the signed-in account and show a saved-analysis
list so I can reopen one, rename it, or return to the ordinary game.

Freeze the source match identifier, chosen step and that exact applied-move
prefix in the new analysis. Its root is that position, with the same gravity,
turn, result and winning cells as the replay. The source label and step should
remain visible. Even if undoing the competitive win later removes its archive
entry, an existing analysis retains its source snapshot. Do not accept a
browser-supplied board, winner, move prefix or account identity as authority.

## A tree of alternatives

Show a separate 7-column, 6-row practice board, turn/result, full selected-line
history, analysis revision and a selectable variation tree. Each node is a
saved position. The root cannot be undone past its source step. Dropping a
piece adds one child with the normal game rules, including full-column
rejection, wins, draws and terminal locking. Analysis Undo selects the parent;
Redo selects a direct child. If there is more than one child, let me choose
the continuation instead of silently discarding or choosing one.

Undoing then choosing another column keeps both alternatives. This must work
at nested positions too, not just the root. Selecting any tree node restores
its exact board, history, turn/result and winning markers. Playing the same
column again from the same parent reopens its existing child rather than
duplicating that edge. Show parent/child relationships and the selected node;
identify moves by their number, color and cell. Preserve all branches,
selection and name through reload, sign-out/sign-in and ordinary server
restart. A comparison is not a cursor change.

Practice creation, moves, selections, undo/redo, renaming and comparisons must
never change the active competitive board, history, revision, redo stack,
scores or completed-match archive, even when practice reaches a win or draw.

## Compare positions

Let me choose any two nodes in the same analysis. Show both complete boards,
the number of shared opening moves (including the frozen source prefix), and
the exact cells whose occupants differ. Identify differences by row/column
and a visible non-color-only marker with accessible wording. Comparing a
position to itself shows its full move count as the common prefix and no
differences. Swapping left and right swaps boards but not the differing-cell
set. Do not create moves or change any saved state while comparing.

## Save safely

Store analyses and their immutable nodes in SQLite. The server derives their
positions from the source prefix and legal moves, and checks ownership for
every read, write, source match and comparison. Reject another account's
identifiers without leaking its data. Never allow a node from a different
analysis to be selected, redone or compared. Use the same bearer sessions and
account-wide sign-out revocation as the main game.

Give each analysis its own integer revision, starting at zero. Every accepted
edit (move, Undo, Redo, tree selection or rename) advances it exactly once,
including reopening an existing child. Creation, reads and comparisons do
not advance another analysis or the competitive game. Require the expected
analysis revision on edits. A stale edit returns a conflict without a partial
write; show a useful message and the latest saved analysis so I can retry
with a new operation identifier.

Use a new opaque, high-entropy operation identifier on every newly intended
creation or edit. Save receipts for accepted operations and rejected operations
that have a valid identifier. An exact retry must return its original status
and response even after later edits or a restart, without reapplying it.
Reusing an identifier for different input is a conflict, not a second edit.
Missing or malformed identifiers and revisions, non-integer/out-of-range
columns or source steps, blank/overlong names, unknown actions and additional
identity/state fields must receive controlled 4xx responses, not 500s. A
rejected action must not alter nodes, selection, revision or names. A full
column, terminal move, Undo at the root, Redo without a continuation or an
ambiguous Redo without a chosen child is rejected without a write.

No particular route names or JSON field names are required. Document your
actual analysis routes in APP_MANIFEST.md, alongside the existing game routes.

## Usable during study

Make ordinary match controls, read-only replay and editable analysis clearly
distinct. Label the name fields, tree controls, branch choice and both
comparison selectors. Give each board 42 accessible cells naming row, column,
occupant and any winning/difference state. All enabled analysis controls must
be keyboard reachable with visible focus and no trap; Enter/Space activate
buttons. Analysis column controls support Left/Right, Home and End like the
ordinary board. Keep useful focus after saving, disable duplicate pending
actions, and announce saved, invalid and conflict feedback without color alone.
At 375 pixels wide, keep the tree, boards, history and controls readable and
reachable without horizontal page overflow; stacking comparison boards and
ordinary vertical scrolling are fine. Respect reduced motion here as elsewhere.
