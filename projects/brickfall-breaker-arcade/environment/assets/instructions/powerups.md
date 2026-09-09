# Bricks and power-ups

Normal bricks break for 100 base points. Strong bricks take two hits: the first
visible damage hit is worth 75 base points and destruction is worth 250. Solid
bricks never take damage or score. Workbook `drop` values deterministically
select which destroyed bricks release an item; missed items have no effect.

An effect lasts exactly 20 seconds of unpaused simulation time. Recollecting
the same type only resets its timer; it does not stack or repeat its immediate
spawn. Collecting a different type first removes the old effect. Losing the
last ball clears the effect and all falling items.

- `wide` makes the paddle 50% wider, then restores its normal width.
- `slow` scales current ball speed to 70%, then restores level-bounded speed.
- `multiball` creates exactly one extra ball; replacement or expiry keeps only
  the designated primary ball, and recollection never creates a third ball.
- `sticky` captures the next paddle contact until Launch; expiry releases a
  held ball automatically.

Show the active name and a visibly decreasing timer rounded up to whole seconds.
