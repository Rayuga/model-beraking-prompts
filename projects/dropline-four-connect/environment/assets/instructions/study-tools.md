# Reuse variations and understand threats

I want to reuse a useful continuation at another position, and understand why
a move is forced rather than trust an unexplained suggestion. Put these tools
in the saved-analysis workspace. They are study tools, not a computer opponent.

## Preview and transplant a branch

From the open analysis, choose any non-root node as the source branch. Choose
any saved analysis of my account and any of its nodes as the destination. The
destination may be in the same analysis, including below the chosen source.
Copy the chosen node's incoming column move and its entire descendant tree onto
the destination. Copy column choices, not source colors or absolute cell rows:
derive gravity, alternating turns, wins and draws afresh from the destination.

Preview before saving. Show the relative column path and resulting position
for every copied node, and the counts of new and reused nodes. An existing
child with the same parent and column is reused, recursively, without replacing
its identity or deleting unrelated children. Preview must not change either
analysis, its selected position or revision, or any competitive data. Internal
saved preview metadata is allowed and must survive restart until committed.

If any copied move is illegal, show its exact relative column path and reason,
and do not allow committing a partial tree. Inspect siblings by ascending
column, depth first; report the first illegal move in that deterministic order.
Full columns and moves after a win/draw are illegal. Choosing the source root,
unknown/foreign studies or nodes, and extra browser-supplied state/identity
fields must be rejected safely. Never trust a supplied board or node mapping.

Commit the valid preview in one transaction. Preserve all original nodes,
both names, frozen source snapshots and selected cursors. Advance only the
destination revision, exactly once, even when every edge is reused. For a
same-analysis transplant there is only one revision increment. Return/show
a mapping from each copied source node to its actual destination node.
Do not recursively recopy nodes just created by this operation.

Bind previews to both source and destination revisions. Any intervening edit,
even just a rename or selection, requires a fresh preview and must cause the
old commit to conflict without writing nodes. Show refresh/re-preview guidance.
An exact commit retry with the same opaque operation identifier returns its
original response after later edits or restart; save rejected commit receipts
too, as for other analysis operations. A newly intended reuse of an already
committed preview is rejected. Preview identifiers are private to the owner.

## Bounded tactical reports

For any saved node choose a search depth from 1 through 4 plies (one ply is one
piece drop). Show a result for every legal first column, in ascending order,
from the player-to-move's perspective. Recompute exact legal positions; do not
substitute an evaluation heuristic, random choice or wall-clock cutoff.

Results are forced win, forced loss, forced draw, or not established within
the search depth. A win or loss also shows its distance in plies. After every
move, switch perspective: the other player's win is this player's loss.
At a terminal node, score the actual win/draw before checking the depth limit.
At a nonterminal depth-zero node the outcome is unknown, never a draw.

At each nonterminal position, examine every legal child. Any child giving the
current player a proven win establishes a win; use the shortest winning
distance. If every child is a proven loss, report loss and the longest distance
(best resistance). If there are no winning or unknown children and at least
one draw, report draw. Otherwise report not established. These rules apply
recursively to the opponent too. Count the first move in each column's reported
distance. Full columns are excluded. A terminal root shows the actual result
with no playable-column recommendations.

Let me browse the full bounded explanation tree: every legal reply at each
nonterminal node, in ascending column order, until a terminal or depth boundary.
Identify whose perspective each outcome uses, distinguish terminal leaves from
unresolved horizon leaves, and let me inspect the exact 42-cell position at any
proof node. Label each explanation node by its relative column path, player,
outcome and any win/loss distance. Never confuse identical boards reached by
different move paths. Repeating a report at the same saved position/depth gives
the same ordered results and proof, including after reload or server restart.

Compute reports on the local server from the authenticated account's saved
node, not a client-supplied board. Reports are read-only: no game/study revision, selection, nodes, scores, archive
or receipts change. Authenticate all reports and enforce study/node ownership.
Reject missing, string, fractional or out-of-range depths, foreign node IDs,
and additional identity/board fields with controlled 4xx responses. Label the
saved node and revision used by the report; clear stale results when the user
switches or edits the open analysis.

## Presentation

Make source branch, destination analysis/position, preview, commit and search
depth clearly labelled and keyboard reachable with visible focus. While an
operation is pending prevent duplicate activation. Announce success, illegal
path and conflict messages without relying on color. Keep useful focus after
an action; ordinary scrolling is fine. Clearly distinguish unsaved preview,
committed mapping, and read-only tactical proof from the saved game and study.
Use the same legible type, palette and component styling as the rest of the
product. At 375 pixels wide, stack tables/boards or use contained table scrolling
without horizontal page overflow, clipped controls or inaccessible proof nodes.
Honor reduced motion. Document the actual tool routes in APP_MANIFEST.md.
