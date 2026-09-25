# Club night: long games and interrupted saves

We leave several games open during club night. Two games can involve the same
players and still need their own cards, turn, dealer, scores and hand number.
Reopening or advancing one must not change the other. Keep completed results
available as history, with exactly one ladder update per finished game.

The `club_series` practice in `practice-deals.json` is a complete match from
zero to 121. Its `rounds` list cycles until somebody wins. For each new hand,
use that round's `a` cards for the current dealer and `b` cards for the other
player, with its listed cut. Seat A deals hand one; seats and member identities
stay fixed while the dealer alternates. Keep the first four and discard the
last two for the exercise. Ordinary games and other practices may still
shuffle later hands. The series must continue after reopening or restarting.

These two new single-hand practices settle awkward pegging finishes:

- `tail`: B plays AS, A TS, B 2H, A JH, B 3D, B 4C, A QD, A KC.
  A cannot fit a card at 26, so B continues to 30. B gets one go point;
  B has run out, so A leads the new count and plays its last two cards.
  A gets one last-card point. Pegging ends at A=1/B=1.
- `last31`: B plays 5S, A 6H, B TD, A TC, B 8S, A 9H, B 7D, A 7C.
  A's first TC makes 31 and a pair, for four points. B's 7D completes
  a run for three. A's final 7C makes 31 and a pair, for another four.
  Pegging ends at A=8/B=3, with no additional last-card/go point.

Reset a count when play must continue. When pegging is over, keeping the final
count visible or clearing it is fine. The points and next game phase must be
correct. Go may be automatic or use a labelled control that cannot claim a go
while a legal card remains. Turning the cut and showing the counts may be
automatic or use labelled controls; never cut before both players discard,
and preserve the ordered show until Next hand.

Save after every accepted action. Reloading or restarting after one discard,
both discards, a go, the show, or a winning move must preserve that exact stage,
including card privacy and whose turn comes next. Scores, results and ladder
updates must commit together: no half-finished win or repeated win credit.

Sometimes someone has an old copy of the table open in another tab. Every game
read must expose a nonnegative integer revision. Creating a game starts at 0;
each accepted game mutation advances it exactly once, independently per game.
Game actions carry the revision the player saw. Missing, invalid or stale
revisions must be refused without changing either game or the ladder. Show a
clear message and refresh the stale table; never silently apply its old move
to the new state. Choosing cards and scoring at the bench do not advance it.

A connection can drop after the server has saved a move but before we hear
back. Each new game or game action must carry a stable client-generated action
identifier. Retrying the identical request, even after another move or a
process restart, returns its original acceptance without applying it twice.
Reusing an accepted identifier with different input, a different target game
or another action must refuse without mutation. A genuinely new action gets
a new identifier and must still pass all normal game rules and revision checks.
Never treat two independently started games as duplicates just because their
players and settings match. Preserve accepted receipts together with game data.

During a pending save, prevent repeated activation and show its status. If the
response is lost, keep the same pending action across page reload, offer a
labelled retry, and reuse its identifier and original input. Once confirmed,
read the latest table: an old acceptance must not roll the display back over
a newer move. Do not queue further moves behind an unconfirmed save. The
scoring bench remains read-only and needs no action identifier or revision.

Document in `APP_MANIFEST.md` how the browser sends the action identifier and
expected revision and how reads expose revisions, plus the historical-summary
read route. Header names, field names and action routes are your choice.
