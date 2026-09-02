# Scoring, progression and persistence

Combo starts at x1. Each damaging breakable-brick contact awards its base
points times the current combo, then raises the combo by one up to x5. Paddle
contact resets it to x1. Level completion adds `1000 × completed level`.

Grant exactly one extra life when a score first crosses each 20,000-point
threshold. Record the next threshold in the saved run so reload, undo-like
retries or repeated submissions cannot award it twice. Completing a level
unlocks the next one for that account and increases the next level's starting
ball speed according to the workbook, without exceeding its speed cap.

Save a complete run snapshot to SQLite after meaningful state changes and at a
reasonable throttled interval during play. Restore level, score, lives, combo,
next-life threshold, bricks, paddle, every ball and drop, active power-up and
remaining simulation time. On game over or level-10 completion, update best
score, insert one leaderboard result, clear the resumable run, and return the
global top ten ordered by score descending then earlier achievement.
