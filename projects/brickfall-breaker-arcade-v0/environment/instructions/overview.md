# Game overview

Brickfall is a single-player brick-breaker game attached to a signed-in player profile. A run starts with three lives and a selected unlocked level. Clearing
every breakable brick advances; solid bricks never count toward completion.
Finishing level 10 completes the run and records the result.

The workbook has `Users`, `Levels`, `Bricks`, `Leaderboard` and `Constants`.
Each row is a record; Constants rows use `key` and `value`. Import every row
on first database creation. Players may start at level 1 or replay any level
their profile has unlocked, but a new run always starts at score zero, three
lives, combo x1, no power-up and one waiting ball. In the mechanics lab show
all levels with name, base/capped speed, accent and brick-type totals.
Its digest is lowercase SHA-256 of UTF-8 signatures sorted by row then column:
`${row}:${column}:${type}:${drop}` records joined with `|`. Show every
workbook Constant there too, preserving its exact key and value.

The game has `menu`, `ready`, `playing`, `paused`, `life-lost`,
`level-complete`, `game-over` and `completed` states. Make transitions
visible and require an intentional launch, continue or restart action. No
audio, registration, multiplayer or payments are needed.
