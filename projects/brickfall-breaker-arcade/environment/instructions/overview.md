# Game overview

Brickfall is a single-player brick-breaker game attached to a signed-in player
profile. A run starts with three lives and a selected unlocked level. Clearing
every breakable brick advances to the next level; solid bricks never count
toward completion. Finishing level 10 completes the run and records the result.

The authoritative workbook contains `Users`, `Levels`, `Bricks`, `Leaderboard`
and `Constants` sheets. Each row is a record; `Constants` uses `key` and
`value`. Load every supplied record on first database creation. Players may start at level 1
or replay any level their profile has unlocked, but a new run always begins
with zero score, three lives, combo x1, no power-up and one waiting ball.

The game has `menu`, `ready`, `playing`, `paused`, `life-lost`,
`level-complete`, and `game-over` states. Make transitions visible and require
an intentional launch, continue or restart action rather than advancing behind
an overlay. No audio, registration, multiplayer or payments are needed.
