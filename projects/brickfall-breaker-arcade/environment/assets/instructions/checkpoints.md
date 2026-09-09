# Seeded checkpoints and mechanics lab

On first database creation import the scenario file's exact Mira and Dev paused
checkpoints, including revision, trajectory and next outcome. Time away never
advances either checkpoint.

The signed-in mechanics lab offers `Brick types`, `Power relay`, `Multiball`,
`Sticky catch`, `Extra life`, `Last ball` and `Final wall`. The scenario
file is authoritative for every drill's initial state and each stated Advance
outcome. Loading a drill creates a paused, non-scoring state and never changes
a save, revision, unlock, best score, run history or leaderboard.

`Advance 1 second` requests up to 120 fixed steps through the same engine and
returns to paused, stopping early only at a stated outcome. Show telemetry with
phase, score, lives, combo, ball identity/state/velocity, ordered item details,
each brick state, paddle width, effect and whole-second timer.

Import all guest and Polly terminal fixtures. Keep only Polly's newest ten
personal snapshots, but retain every result globally; the top ten still omits
DVP 6,200 and the lower fixtures.
